import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { APMediaStream } from "./stream.js";

import { APEmptyState } from "./empty.js";
import { APErrorState } from "./error.js";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");

// make sure that GObject registers these first
APEmptyState;
APErrorState;

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
  private _toastOverlay!: Adw.ToastOverlay;
  private _stack!: Gtk.Stack;
  private _error!: APErrorState;

  private stream: APMediaStream;
  private file_dialog: Gtk.FileDialog;

  static {
    GObject.registerClass(
      {
        Template: "resource:///com/vixalien/audio-player/window.ui",
        InternalChildren: ["toastOverlay", "stack", "error"],
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

    this.stream = new APMediaStream();

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

  load(uri: string) {
    this.stream.set_uri(uri);
    this.stream.play();
  }

  open_file() {
    (this.file_dialog.open(this, null) as unknown as Promise<Gio.File>)
      .then((file) => {
        if (file) {
          this.load(file.get_uri());
        } else {
          this.show_error(
            _("File Cannot Be Played"),
            _("The file could not be accessed"),
          );
        }
      }).catch((error) => {
        if (
          error instanceof Gtk.DialogError &&
          error.code === Gtk.DialogError.DISMISSED
        ) {
          return;
        }

        this.show_error("Couldn't read the file", error);
      });
  }

  private show_stack_page(page: "empty" | "error") {
    this._stack.visible_child_name = page;
  }

  private show_error(title: string, error: any) {
    this.show_stack_page("error");

    this._error.show_error(title, error);
  }
}
