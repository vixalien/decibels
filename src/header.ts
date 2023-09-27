import Adw from "gi://Adw";
import GObject from "gi://GObject";

export class APHeaderBar extends Adw.Bin {
  private _header_bar!: Adw.HeaderBar;

  static {
    GObject.registerClass(
      {
        GTypeName: "APHeaderBar",
        Template: "resource:///com/vixalien/decibels/header.ui",
        InternalChildren: ["header_bar"],
        Properties: {
          title: GObject.param_spec_string(
            "title",
            "Title",
            "The title of the header bar",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          subtitle: GObject.param_spec_string(
            "subtitle",
            "Subtitle",
            "The subtitle of the header bar",
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

  private _title: string | null = null;

  get title() {
    return this._title;
  }

  set title(title: string | null) {
    this._title = title;
    this.notify("title");
    this.render_title();
  }

  private _subtitle: string | null = null;

  get subtitle() {
    return this._subtitle;
  }

  set subtitle(subtitle: string | null) {
    this._subtitle = subtitle;
    this.notify("subtitle");
    this.render_title();
  }

  private render_title() {
    if (!this._title) {
      this._header_bar.set_title_widget(null);
    }

    let window_title: Adw.WindowTitle;

    if (this.has_title_widget()) {
      window_title = this._header_bar.title_widget as Adw.WindowTitle;
    } else {
      window_title = new Adw.WindowTitle();
      this._header_bar.title_widget = window_title;
    }

    window_title.set_title(this.title ?? "");
    window_title.set_subtitle(this.subtitle ?? "");
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }
}
