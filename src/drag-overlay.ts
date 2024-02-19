// Adapted from https://gitlab.gnome.org/World/amberol/-/blob/main/src/drag_overlay.rs#L15
import Adw from "gi://Adw";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import { Window } from "./window";

type AddChild = Parameters<Gtk.Widget["vfunc_add_child"]>;

export class APDragOverlay extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "APDragOverlay",
        Template: "resource:///com/vixalien/decibels/drag-overlay.ui",
        Implements: [Gtk.Buildable],
        InternalChildren: ["overlay", "revealer"],
      },
      this,
    );
  }

  private _overlay!: Gtk.Overlay;
  private _revealer!: Gtk.Revealer;
  private _drop_target!: Gtk.DropTarget;

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);

    this._drop_target = new Gtk.DropTarget({
      actions: Gdk.DragAction.COPY,
      formats: Gdk.ContentFormats.new_for_gtype(Gdk.FileList.$gtype),
    });

    this._drop_target.connect(
      "notify::current-drop",
      this._notify_current_drop_cb.bind(this),
    );

    this._drop_target.connect("drop", this._drop_target_drop_cb.bind(this));

    this.add_controller(this._drop_target);
  }

  private _notify_current_drop_cb(drop_target: Gtk.DropTarget) {
    const reveal = drop_target.current_drop != null;

    this._revealer.reveal_child = reveal;

    if (reveal) {
      this._overlay.child.add_css_class("blurred");
    } else {
      this._overlay.child.remove_css_class("blurred");
    }
  }

  private get_window() {
    return this.get_root() as Window;
  }

  private _drop_target_drop_cb(
    _drop_target: Gtk.DropTarget,
    file_list: Gdk.FileList,
  ) {
    if (typeof file_list === "object" && file_list instanceof Gdk.FileList) {
      const file = file_list.get_files()[0];
      if (!file) {
        this.get_window().show_error(
          _("File Cannot Be Played"),
          new Error(_("Unable to access dropped files")),
        );
        return false;
      }

      void this.get_window().load_file(file);
      return true;
    }

    return false;
  }

  vfunc_add_child(...params: AddChild): void {
    if (params[2] === "content") {
      params[2] = null;
      this._overlay.vfunc_add_child(...params);
    } else {
      super.vfunc_add_child(...params);
    }
  }
}
