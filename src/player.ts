import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Window } from "./window.js";

export class APPlayerState extends Adw.Bin {
  private _scale_adjustment!: Gtk.Adjustment;
  private _timestamp_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;

  static {
    GObject.registerClass(
      {
        GTypeName: "APPlayerState",
        Template: "resource:///com/vixalien/audio-player/player.ui",
        InternalChildren: [
          "scale_adjustment",
          "timestamp_label",
          "duration_label",
        ],
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

    // @ts-ignore GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "duration",
      this._duration_label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        return [true, micro_to_string(from)];
      },
      null,
    );

    window.stream.bind_property(
      "timestamp",
      this._scale_adjustment,
      "value",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // @ts-ignore GObject.BindingTransformFunc return arguments are not correctly typed
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

function get_window() {
  return (Gtk.Application.get_default() as Gtk.Application).get_active_window();
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
