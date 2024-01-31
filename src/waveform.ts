/*
 * Copyright 2013 Meg Ford
             2020 Kavan Mevada
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 *  Author: Meg Ford <megford@gnome.org>
 *          Kavan Mevada <kavanmevada@gmail.com>
 *
 */

// based on code from GNOME Sound Recorder

import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";
import Gst from "gi://Gst";

// @ts-expect-error This module doesn't import nicely
import Cairo from "cairo";

export enum WaveType {
  Recorder,
  Player,
}

const GUTTER = 4;

export class APWaveForm extends Gtk.DrawingArea {
  private _position: number;
  private dragGesture?: Gtk.GestureDrag;
  private hcId: number;
  private drag_start_position: number | null = null;

  static {
    GObject.registerClass(
      {
        GTypeName: "APWaveForm",
        Properties: {
          position: GObject.ParamSpec.float(
            "position",
            "Waveform position",
            "Waveform position",
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0.0,
            1.0,
            0.0,
          ),
          peaks: GObject.param_spec_boxed(
            "peaks",
            "Peaks",
            "The peaks of the currently playing song",
            (Object as any).$gtype,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Signals: {
          "position-changed": { param_types: [GObject.TYPE_DOUBLE] },
          "gesture-pressed": {},
        },
      },
      this,
    );
  }

  constructor(
    params: Partial<Gtk.DrawingArea.ConstructorProperties> | undefined,
    // type: WaveType,
  ) {
    super(params);
    this._position = 0;

    this.dragGesture = Gtk.GestureDrag.new();
    this.dragGesture.connect("drag-begin", this.dragBegin.bind(this));
    this.dragGesture.connect("drag-update", this.dragUpdate.bind(this));
    this.dragGesture.connect("drag-end", this.dragEnd.bind(this));
    this.add_controller(this.dragGesture);

    this.hcId = Adw.StyleManager.get_default().connect(
      "notify::high-contrast",
      () => {
        this.queue_draw();
      },
    );

    this.set_draw_func(this.drawFunc.bind(this));
  }

  get peaks(): number[] {
    return [];
  }

  private dragBegin(gesture: Gtk.GestureDrag): void {
    gesture.set_state(Gtk.EventSequenceState.CLAIMED);
    this.drag_start_position = this._position;
    this.emit("gesture-pressed");
  }

  private dragUpdate(_gesture: Gtk.GestureDrag, offset_x: number): void {
    if (this.drag_start_position != null) {
      const after = this.drag_start_position -
        (offset_x / (this.peaks.length * GUTTER));

      this._position = Math.max(Math.min(after, 1), 0);
      this.queue_draw();
    }
  }

  private dragEnd(): void {
    this.drag_start_position = null;
    this.emit("position-changed", this.position);
  }

  private drawFunc(
    _: Gtk.DrawingArea,
    ctx: Cairo.Context,
    width: number,
    height: number,
  ) {
    const peaks = this.peaks;
    const vertiCenter = height / 2;
    const horizCenter = width / 2;

    let pointer = horizCenter - (this._position * peaks.length * GUTTER);

    const styleContext = this.get_style_context();

    const rightColor = styleContext.lookup_color("dimmed_color")[1];

    const leftColor = this.safeLookupColor("accent_color");

    // Because the cairo module isn't real, we have to use these to ignore `any`.
    // We keep them to the minimum possible scope to catch real errors.
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    ctx.setLineCap(Cairo.LineCap.SQUARE);
    ctx.setAntialias(Cairo.Antialias.NONE);
    ctx.setLineWidth(2);

    this.setSourceRGBA(ctx, leftColor);

    ctx.moveTo(horizCenter, vertiCenter - height);
    ctx.lineTo(horizCenter, vertiCenter + height);
    ctx.stroke();

    ctx.setLineWidth(2);
    /* eslint-enable @typescript-eslint/no-unsafe-call */
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    // only draw the waveform for peaks inside the view
    let invisible_peaks = 0;

    if (pointer < 0) {
      invisible_peaks = -Math.floor(pointer);
      pointer = pointer + invisible_peaks;
    }

    for (
      const peak of peaks.slice(invisible_peaks / GUTTER)
    ) {
      // this shouldn't happen, but just in case
      if (pointer < 0) {
        pointer += GUTTER;
        continue;
      }

      if (pointer > this.get_width()) {
        break;
      }

      if (pointer > horizCenter) {
        this.setSourceRGBA(ctx, rightColor);
      } else {
        this.setSourceRGBA(ctx, leftColor);
      }

      /* eslint-disable @typescript-eslint/no-unsafe-call */
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      ctx.moveTo(pointer, vertiCenter + peak * height);
      ctx.lineTo(pointer, vertiCenter - peak * height);
      ctx.stroke();
      /* eslint-enable @typescript-eslint/no-unsafe-call */
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */

      pointer += GUTTER;
    }
  }

  set position(pos: number) {
    if (this.peaks.length > 0) {
      this._position = pos;
      this.queue_draw();
      this.notify("position");
    }
  }

  get position(): number {
    return this._position;
  }

  private setSourceRGBA(cr: Cairo.Context, rgba: Gdk.RGBA): void {
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    cr.setSourceRGBA(rgba.red, rgba.green, rgba.blue, rgba.alpha);
    /* eslint-enable @typescript-eslint/no-unsafe-call */
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  }

  public destroy(): void {
    Adw.StyleManager.get_default().disconnect(this.hcId);
    this.peaks.length = 0;
    this.queue_draw();
  }

  private safeLookupColor(color: string) {
    const styleContext = this.get_style_context();

    const lookupColor = styleContext.lookup_color(color);
    const ok = lookupColor[0];
    if (ok) return lookupColor[1];
    return styleContext.get_color();
    }
}

export class APPeaksGenerator extends GObject.Object {
  loaded_peaks: number[] = [];

  static {
    GObject.registerClass(
      {
        GTypeName: "APPeaksGenerator",
        Properties: {
          peaks: GObject.param_spec_boxed(
            "peaks",
            "Peaks",
            "The peaks of the currently playing song",
            (Object as any).$gtype,
            GObject.ParamFlags.READABLE,
          ),
        },
      },
      this,
    );
  }

  private _peaks: number[] = [];

  get peaks() {
    return this._peaks;
  }

  set peaks(peaks: number[]) {
    this._peaks = peaks;
    this.notify("peaks");
  }

  constructor() {
    super();
  }

  private started = false;

  restart() {
    this.started = true;
    this.loaded_peaks.length = 0;
    this.peaks.length = 0;
  }

  generate_peaks_async(uri: string): void {
    const pipeline = Gst.parse_launch(
      `uridecodebin name=uridecodebin ! audioconvert ! audio/x-raw,channels=1 ! level name=level interval=${this.INTERVAL} ! fakesink name=faked`,
    ) as Gst.Bin;

    const fakesink = pipeline.get_by_name("faked");
    fakesink?.set_property("qos", false);
    fakesink?.set_property("sync", false);

    const uridecodebin = pipeline.get_by_name("uridecodebin");
    uridecodebin?.set_property("uri", uri);

    pipeline.set_state(Gst.State.PLAYING);

    const bus = pipeline.get_bus();
    bus?.add_signal_watch();

    bus?.connect("message", (_bus: Gst.Bus, message: Gst.Message) => {
      switch (message.type) {
        case Gst.MessageType.ELEMENT: {
          const s = message.get_structure();
          if (s && s.has_name("level")) {
            const peakVal = s.get_value(
              "rms",
            ) as unknown as GObject.ValueArray;

            if (peakVal) {
              const peak = peakVal.get_nth(0) as number;
              this.loaded_peaks.push(Math.pow(10, peak / 20));
            }
          }
          break;
        }
        case Gst.MessageType.EOS:
          if (this.started) {
            this.peaks = [...this.loaded_peaks];
          }

          this.loaded_peaks.length = 0;

          pipeline?.set_state(Gst.State.NULL);
          break;
      }
    });
  }

  INTERVAL = 100000000;
}
