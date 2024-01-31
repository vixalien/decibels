import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

export class APVolumeButton extends Adw.Bin {
  private _adjustment!: Gtk.Adjustment;
  private _menu_button!: Gtk.MenuButton;

  static {
    GObject.registerClass(
      {
        GTypeName: "APVolumeButton",
        Template: "resource:///com/vixalien/decibels/volume-button.ui",
        InternalChildren: [
          "adjustment",
          "menu_button",
        ],
        Properties: {
          value: GObject.param_spec_double(
            "value",
            "value",
            "The current value of the VolumeButton",
            0,
            1.0,
            0.5,
            GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE |
              GObject.ParamFlags.EXPLICIT_NOTIFY,
          ),
        },
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }

  get value() {
    return this._adjustment.value;
  }

  set value(val: number) {
    if (val === this.value) return;

    this._adjustment.value = val;
    this.set_tooltip(val);
    this.set_icon(val);

    this.notify("value");
  }

  private set_tooltip(value: number) {
    let tooltip;

    if (value === 1) {
      tooltip = _("Full Volume");
    } else if (value === 0) {
      tooltip = _("Muted");
    } else {
      tooltip = imports.format.vprintf(
        /* Translators: this is the percentage of the current volume,
         * as used in the tooltip, eg. "49 %".
         * Translate the "%d" to "%Id" if you want to use localised digits,
         * or otherwise translate the "%d" to "%d".
         */
        C_("volume percentage", "%d %%"),
        [Math.round(100 * value).toString()],
      );
    }

    this.set_tooltip_text(tooltip);
  }

  private set_icon(value: number) {
    let icon_name: string;

    if (value === 0) icon_name = "audio-volume-muted";
    else if (value === 1) icon_name = "audio-volume-high";
    else if (value <= 0.5) icon_name = "audio-volume-low";
    else icon_name = "audio-volume-medium";

    this._menu_button.icon_name = `${icon_name}-symbolic`;
  }

  private scale_change_value_cb(
    _scale: Gtk.Scale,
    _scroll: Gtk.ScrollType,
    value: number,
  ) {
    this.value = value;
  }
}
