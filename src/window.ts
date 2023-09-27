import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { APMediaStream } from "./stream.js";

import { APHeaderBar } from "./header.js";
import { APEmptyState } from "./empty.js";
import { APErrorState } from "./error.js";
import { APPlayerState } from "./player.js";
import { MPRIS } from "./mpris.js";
import { Settings } from "./application.js";
import { APDragOverlay } from "./drag-overlay.js";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");

APHeaderBar;

// make sure that GObject registers these first
APEmptyState;
APErrorState;
APPlayerState;
APDragOverlay;

export type ActionEntry = {
  name: string;
  parameter_type?: string;
  state?: string;
  activate?: (
    _source: Gio.SimpleAction,
    parameter: GLib.Variant | null,
  ) => void;
  change_state?: (
    _source: Gio.SimpleAction,
    value: GLib.Variant | null,
  ) => void;
};

export type AddActionEntries = (entries: ActionEntry[]) => void;

export class Window extends Adw.ApplicationWindow {
  private _stack!: Gtk.Stack;
  private _error!: APErrorState;
  private _player!: APPlayerState;

  stream: APMediaStream;

  private file_dialog: Gtk.FileDialog;
  private mpris: MPRIS;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/decibels/window.ui",
        InternalChildren: ["stack", "error", "player"],
        Properties: {
          stream: GObject.param_spec_object(
            "stream",
            "Stream",
            "The APMediaStream currently playing",
            APMediaStream.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );

    Gtk.Widget.add_shortcut(
      new Gtk.Shortcut({
        action: new Gtk.NamedAction({ action_name: "window.close" }),
        trigger: Gtk.ShortcutTrigger.parse_string("<Control>w"),
      }),
    );
  }

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    const window_size = Settings.get_value("last-window-size");

    const width = window_size.get_child_value(0).get_int32();
    const height = window_size.get_child_value(1).get_int32();

    if (width > 0) this.default_width = width;
    if (height > 0) this.default_height = height;

    this.stream = new APMediaStream();

    this.insert_action_group("player", this.stream.get_action_group());

    this.stream.connect("loaded", () => {
      this.show_stack_page("player");
    });

    this.stream.bind_property(
      "title",
      this._player.headerbar,
      "title",
      GObject.BindingFlags.DEFAULT,
    );

    this.stream.bind_property(
      "artist",
      this._player.headerbar,
      "subtitle",
      GObject.BindingFlags.DEFAULT,
    );

    this.stream.bind_property(
      "title",
      this._error.headerbar,
      "title",
      GObject.BindingFlags.DEFAULT,
    );

    this.stream.bind_property(
      "artist",
      this._error.headerbar,
      "subtitle",
      GObject.BindingFlags.DEFAULT,
    );

    this.mpris = new MPRIS(this.stream);

    this.stream.connect("error", (_source, error) => {
      console.error(
        "error during playback",
        error.toString(),
        error.code,
        error.domain,
        error.message,
      );

      this.show_error(_("File Cannot Be Played"), error);
    });

    const filters = Gio.ListStore.new(Gtk.FileFilter.$gtype);
    filters.append(
      new Gtk.FileFilter({
        name: _("Audio files"),
        mime_types: ["audio/*"],
      }),
    );

    this.file_dialog = new Gtk.FileDialog({
      modal: true,
      title: _("Open File"),
      filters,
    });

    (this.add_action_entries as AddActionEntries)([
      {
        name: "open-file",
        activate: (_source, _param) => {
          this.open_file();
        },
      },
    ]);
  }

  load_uri(uri: string) {
    this.stream.set_uri(uri);
  }

  load_file(file: Gio.File) {
    this.stream.set_file(file);
  }

  open_file() {
    (this.file_dialog.open(this, null) as unknown as Promise<Gio.File>)
      .then((file) => {
        if (file) {
          this.load_file(file);
        } else {
          this.show_error(
            _("File Cannot Be Played"),
            _("The file could not be accessed"),
          );
        }
      })
      .catch((error) => {
        if (
          error instanceof Gtk.DialogError &&
          error.code === Gtk.DialogError.DISMISSED
        ) {
          return;
        }

        this.show_error("Couldn't read the file", error);
      });
  }

  private show_stack_page(page: "empty" | "error" | "player") {
    this._stack.visible_child_name = page;
  }

  show_error(title: string, error: any) {
    this.show_stack_page("error");

    this._error.show_error(title, error);
  }

  vfunc_close_request() {
    const window_size = GLib.Variant.new("(ii)", [
      this.get_width(),
      this.get_height(),
    ]);

    Settings.set_value("last-window-size", window_size);

    return super.vfunc_close_request();
  }
}
