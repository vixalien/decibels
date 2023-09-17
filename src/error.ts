import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

export class APErrorState extends Adw.Bin {
  private _statusPage!: Adw.StatusPage;

  static {
    GObject.registerClass(
      {
        GTypeName: "APErrorState",
        Template: "resource:///com/vixalien/audio-player/error.ui",
        InternalChildren: ["statusPage"],
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
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
