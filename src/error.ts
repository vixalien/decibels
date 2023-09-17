import Adw from "gi://Adw";
import GObject from "gi://GObject";

export class APErrorState extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "APErrorState",
        Template: "resource:///com/vixalien/audio-player/error.ui",
      },
      this,
    );
  }

  constructor(params?: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);
  }
}
