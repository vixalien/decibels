import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { Window } from "./window.js";

export const Settings = new Gio.Settings({ schema: pkg.name });

export class Application extends Adw.Application {
  private window?: Window;

  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      application_id: "com.vixalien.decibels",
      flags: Gio.ApplicationFlags.HANDLES_OPEN,
    });

    const quit_action = new Gio.SimpleAction({ name: "quit" });
    quit_action.connect("activate", () => {
      this.quit();
    });

    this.add_action(quit_action);
    this.set_accels_for_action("app.quit", ["<Control>q"]);

    this.set_accels_for_action("win.open-file", ["<Control>o"]);

    const show_about_action = new Gio.SimpleAction({ name: "about" });
    show_about_action.connect("activate", () => {
      const aboutWindow = Adw.AboutWindow.new_from_appdata(
        "/com/vixalien/decibels/com.vixalien.decibels.metainfo.xml",
        "0.1.0",
      );
      aboutWindow.set_designers(["kramo https://kramo.hu"]);

      aboutWindow.present();
    });

    this.add_action(show_about_action);

    Gio._promisify(Gtk.UriLauncher.prototype, "launch", "launch_finish");
  }

  private present_main_window(): void {
    if (!this.window) {
      this.window = new Window({ application: this });
    }

    this.window.present();
  }

  vfunc_activate(): void {
    this.present_main_window();
  }

  vfunc_open(files: Gio.FilePrototype[], hint: string): void {
    this.present_main_window();

    const window = this.get_active_window();

    if (window && window instanceof Window && files.length > 0) {
      window.load_file(files[0]);
    }
  }
}
