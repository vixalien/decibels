import Adw from "gi://Adw";
import GObject from "gi://GObject";

export class APEmptyState extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "APEmptyState",
        Template: "resource:///com/vixalien/audio-player/empty.ui",
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }
}
