import Adw from "gi://Adw";
import GObject from "gi://GObject";

export class APHeaderBar extends Adw.Bin {
  private _header_bar!: Adw.HeaderBar;

  static {
    GObject.registerClass(
      {
        GTypeName: "APHeaderBar",
        Template: "resource:///com/vixalien/audio-player/header.ui",
        InternalChildren: ["header_bar"],
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

  private has_title_widget() {
    const title_widget = this._header_bar.title_widget;

    if (title_widget && title_widget instanceof Adw.WindowTitle) {
      return true;
    }

    return false;
  }

  get title() {
    if (this.has_title_widget()) {
      return (
        (this._header_bar.title_widget as Adw.WindowTitle)?.title ?? null
      );
    }

    return null;
  }

  set title(title: string | null) {
    if (title === null) {
      this._header_bar.set_title_widget(null);
    } else {
      if (!this.has_title_widget()) {
        this._header_bar.title_widget = new Adw.WindowTitle({ title });
      } else {
        (this._header_bar.title_widget as Adw.WindowTitle).title = title;
      }
    }
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }
}
