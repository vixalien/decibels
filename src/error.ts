import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { APHeaderBar } from "./header.js";

export class APErrorState extends Adw.Bin {
  private _statusPage!: Adw.StatusPage;
  private _headerbar!: APHeaderBar;

  static {
    GObject.registerClass(
      {
        GTypeName: "APErrorState",
        Template: "resource:///com/vixalien/decibels/error.ui",
        InternalChildren: ["statusPage", "headerbar"],
        Properties: {
          title: GObject.param_spec_string(
            "title",
            "Title",
            "The title of the header bar",
            null,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }

  get title() {
    return this._headerbar.title;
  }

  set title(title: string | null) {
    this._headerbar.title = title;
  }

  private show_message(message: string) {
    this._statusPage.set_description(message);
  }

  show_error(title: string, error: any) {
    this._statusPage.title = title;

    if (error instanceof Error) {
      this.show_message(error.message);
    } else if (error instanceof GLib.Error) {
      this.show_message(error.message);
    } else {
      console.error("error: ", error);
      this.show_message(
        error ? error.toString() : _("An unknown error happened"),
      );
    }
  }
}
