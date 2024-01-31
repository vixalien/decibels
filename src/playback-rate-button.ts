import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Window } from "./window.js";

export class APPlaybackRateButton extends Adw.Bin {
  private _adjustment!: Gtk.Adjustment;
  private _label!: Gtk.Label;

  static {
    GObject.registerClass(
      {
        GTypeName: "APPlaybackRateButton",
        Template: "resource:///com/vixalien/decibels/playback-rate-button.ui",
        InternalChildren: [
          "adjustment",
          "label"
        ],
        Properties: {},
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
      "rate",
      this._adjustment,
      "value",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // @ts-ignore GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "rate",
      this._label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        const rounded = from.toFixed(1);
        return [true, `× ${rounded}`];
      },
      null,
    );

    // @ts-ignore GObject.BindingTransformFunc return arguments are not correctly typed
    window.stream.bind_property_full(
      "rate",
      this._label,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
      (_binding, from: number) => {
        const rounded  = Math.round(from * 10) / 10
        return [true, rounded !== 1];
      },
      null,
    );
  }

  private scale_change_value_cb(
    _scale: Gtk.Scale,
    _scroll: Gtk.ScrollType,
    value: number,
  ) {
    const window = this.get_root() as Window;
    const stream = window?.stream;

    if (!stream) return;

    stream.rate = value;
  }

  private adjust_value(increase: boolean) {
    const window = this.get_root() as Window;
    const stream = window?.stream;

    if (!stream) return;

    stream.rate = increase
      ? this._adjustment.value + this._adjustment.step_increment
      : this._adjustment.value - this._adjustment.step_increment;
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
