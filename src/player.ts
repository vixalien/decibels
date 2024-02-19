import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk?version=4.0";

import { Window } from "./window.js";
import { APHeaderBar } from "./header.js";
import { APWaveForm } from "./waveform.js";
import { APPlaybackRateButton } from "./playback-rate-button.js";
import { APVolumeButton } from "./volume-button.js";

GObject.type_ensure(APPlaybackRateButton.$gtype);
GObject.type_ensure(APVolumeButton.$gtype);

export class APPlayerState extends Adw.Bin {
  private _scale_adjustment!: Gtk.Adjustment;
  private _timestamp_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;
  private _volume_button!: Gtk.VolumeButton;
  private _playback_image!: Gtk.Image;
  private _playback_button!: Gtk.Button;
  private _waveform!: APWaveForm;
  private _scale!: Gtk.Scale;

  headerbar!: APHeaderBar;

  static {
    GObject.registerClass(
      {
        GTypeName: "APPlayerState",
        Template: "resource:///com/vixalien/decibels/player.ui",
        InternalChildren: [
          "scale_adjustment",
          "timestamp_label",
          "duration_label",
          "volume_button",
          "playback_image",
          "playback_button",
          "waveform",
          "scale",
        ],
        Children: ["headerbar"],
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }

  private initialize_player() {
    const window = this.get_root() as Window;

    if (!window || !(window instanceof Window)) return;

    window.stream.bind_property(
      "duration",
      this._scale_adjustment,
      "upper",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "duration",
      this._duration_label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        this._scale.grab_focus();
        return [true, micro_to_string(from)];
      },
      null,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "timestamp",
      this._scale_adjustment,
      "value",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        if ((this._scale.get_state_flags() & Gtk.StateFlags.ACTIVE) != 0) {
          return [false, null];
        }

        return [true, window.stream.timestamp];
      },
      null,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "timestamp",
      this._timestamp_label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        return [true, micro_to_string(from)];
      },
      null,
    );

    window.stream.bind_property(
      "cubic-volume",
      this._volume_button,
      "value",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "playing",
      this._playback_image,
      "icon-name",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: boolean) => {
        return [true, from ? "pause-symbolic" : "play-symbolic"];
      },
      null,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "playing",
      this._playback_button,
      "tooltip-text",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: boolean) => {
        return [true, from ? _("Pause") : _("Play")];
      },
      null,
    );

    // @ts-expect-error GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "timestamp",
      this._waveform,
      "position",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        if ((this._waveform.get_state_flags() & Gtk.StateFlags.ACTIVE) != 0) {
          return [false, null];
        }

        return [
          true,
          Math.max(Math.min(from / window.stream.duration || 0, 1), 0),
        ];
      },
      null,
    );

    Object.defineProperty(this._waveform, "peaks", {
      get() {
        const peaks = window.stream.peaks_generator.peaks;

        if (peaks.length > 0) {
          return peaks;
        }

        // show only the loaded peaks, and 0 for the other remaining
        const duration = window.stream.duration;

        if (duration <= 0) {
          return [];
        }

        const loaded_peaks = window.stream.peaks_generator.loaded_peaks.length;
        const total_peaks = Math.ceil(
          duration / window.stream.peaks_generator.INTERVAL,
        );

        return [
          ...window.stream.peaks_generator.loaded_peaks,
          new Array(Math.max(total_peaks - loaded_peaks, 0)).fill(0),
        ];
      },
    });

    window.stream.peaks_generator.connect("notify::peaks", () => {
      this._waveform.queue_draw();
    });
  }

  private scale_change_value_cb() {
    const window = this.get_root() as Window;
    const stream = window?.stream;

    if (!stream) return;

    stream.seek(this._scale_adjustment.value);
  }

  private scroll_cb(
    controller: Gtk.EventControllerScroll,
    dx: number,
    dy: number,
  ) {
    const window = this.get_root() as Window;
    const stream = window?.stream;
    let delta = 0.0;

    if (!stream) return;

    const unit = controller.get_unit();

    if (unit === Gdk.ScrollUnit.WHEEL) {
      delta = (dx === 0 ? dy : dx) * 10;
    } else {
      delta = dx === 0 ? dy : dx;
    }

    stream.skip_seconds(delta);
  }

  private key_pressed_cb(
    _controller: Gtk.EventControllerKey,
    keyval: number,
  ): boolean {
    const window = this.get_root() as Window;
    const stream = window?.stream;

    if (!stream) return Gdk.EVENT_PROPAGATE;

    if (keyval === Gdk.KEY_space) {
      stream.playing ? stream.pause() : stream.play();
    } else if (keyval === Gdk.KEY_Left) {
      stream.skip_seconds(-10);
    } else if (keyval === Gdk.KEY_Right) {
      stream.skip_seconds(10);
    } else {
      return Gdk.EVENT_PROPAGATE;
    }

    return Gdk.EVENT_STOP;
  }

  private waveform_position_changed_cb(_scale: Gtk.Scale, value: number) {
    const window = this.get_root() as Window;
    const stream = window?.stream;

    if (!stream) return;

    stream.seek(value * stream.duration);
  }

  vfunc_root(): void {
    super.vfunc_root();

    const window = this.get_root() as Window;

    let listener: number | null = window.connect("notify::stream", () => {
      this.initialize_player();
      if (listener) window.disconnect(listener);
      listener = null;
    });
  }
}

function seconds_to_string(seconds: number) {
  // show the duration in the format "mm:ss"
  // show hours if the duration is longer than an hour

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  seconds = Math.floor(seconds % 60);

  let string = "";

  if (hours > 0) {
    string += hours.toString().padStart(2, "0") + ":";
  }

  string += minutes.toString().padStart(2, "0") + ":";

  string += seconds.toString().padStart(2, "0");

  return string;
}

function micro_to_seconds(micro: number) {
  return micro / 1000000;
}

function micro_to_string(micro: number) {
  return seconds_to_string(micro_to_seconds(micro));
}
