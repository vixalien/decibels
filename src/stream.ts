import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gst from "gi://Gst";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";
import GstAudio from "gi://GstAudio";
import Gio from "gi://Gio";
import GstPbUtils from "gi://GstPbutils";

import type { AddActionEntries } from "./window.js";
import { APPeaksGenerator } from "./waveform.js";

if (!Gst.is_initialized()) {
  GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

  Gst.init(null);
}

type GTypeToType<Y extends GObject.GType> = Y extends GObject.GType<infer T> ? T
  : never;

type GTypeArrayToTypeArray<Y extends readonly GObject.GType[]> = {
  [K in keyof Y]: GTypeToType<Y[K]>;
};

class APPlaySignalAdapter extends GObject.Object {
  private static events = {
    "buffering": [GObject.TYPE_INT],
    "duration-changed": [GObject.TYPE_INT],
    "end-of-stream": [],
    "error": [GLib.Error.$gtype, Gst.Structure.$gtype],
    "media-info-updated": [GstPlay.PlayMediaInfo.$gtype],
    "mute-changed": [GObject.TYPE_BOOLEAN],
    "position-updated": [GObject.TYPE_DOUBLE],
    "seek-done": [GObject.TYPE_DOUBLE],
    "state-changed": [GstPlay.PlayState.$gtype],
    "uri-loaded": [GObject.TYPE_STRING],
    "video-dimensions-changed": [GObject.TYPE_INT, GObject.TYPE_INT],
    "volume-changed": [GObject.TYPE_INT],
    "warning": [GLib.Error.$gtype, Gst.Structure.$gtype],
  } as const;

  static {
    GObject.registerClass({
      GTypeName: "APPlaySignalAdapter",
      Signals: Object.fromEntries(
        Object.entries(this.events)
          .map(([name, types]) => [
            name,
            {
              param_types: types,
            },
          ]),
      ),
    }, this);
  }
  private _play: GstPlay.Play;

  get play(): GstPlay.Play {
    return this._play;
  }

  constructor(play: GstPlay.Play) {
    super();

    this._play = play;

    const bus = this._play.get_message_bus()!;
    bus.add_signal_watch();

    bus.connect("message", this.on_message.bind(this));
  }

  private on_message(_: GstPlay.Play, message: Gst.Message) {
    if (!GstPlay.Play.is_play_message(message)) {
      return;
    }

    const structure = message.get_structure()!;
    const type = structure.get_enum(
      "play-message-type",
      GstPlay.PlayMessage.$gtype,
    );

    if (!type[0] || structure.get_name()! !== "gst-play-message-data") {
      return;
    }

    switch (type[1] as GstPlay.PlayMessage) {
      case GstPlay.PlayMessage.URI_LOADED:
        this.emit_message("uri-loaded", [structure.get_string("uri")!]);
        break;
      case GstPlay.PlayMessage.POSITION_UPDATED:
        this.emit_message("position-updated", [
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.DURATION_CHANGED:
        this.emit_message("duration-changed", [
          GstPlay.play_message_parse_duration_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.STATE_CHANGED:
        this.emit_message("state-changed", [
          GstPlay.play_message_parse_state_changed(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.BUFFERING:
        this.emit_message("buffering", [
          GstPlay.play_message_parse_buffering_percent(message),
        ]);
        break;
      case GstPlay.PlayMessage.END_OF_STREAM:
        this.emit_message("end-of-stream", []);
        break;
      case GstPlay.PlayMessage.ERROR:
        const error = GstPlay.play_message_parse_error(message);

        this.emit_message("error", [error[0]!, error[1]!]);
        break;
      case GstPlay.PlayMessage.WARNING:
        const warning = GstPlay.play_message_parse_warning(message);

        this.emit_message("warning", [warning[0]!, warning[1]!]);
        break;
      case GstPlay.PlayMessage.VIDEO_DIMENSIONS_CHANGED:
        this.emit_message(
          "video-dimensions-changed",
          GstPlay.play_message_parse_video_dimensions_changed(message),
        );
        break;
      case GstPlay.PlayMessage.MEDIA_INFO_UPDATED:
        this.emit_message("media-info-updated", [
          GstPlay.play_message_parse_media_info_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.VOLUME_CHANGED:
        this.emit_message("volume-changed", [
          GstPlay.play_message_parse_volume_changed(message),
        ]);
        break;
      case GstPlay.PlayMessage.MUTE_CHANGED:
        this.emit_message("mute-changed", [
          GstPlay.play_message_parse_muted_changed(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.SEEK_DONE:
        this.emit_message("seek-done", [
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
    }
  }

  private emit_message<
    Name extends keyof typeof APPlaySignalAdapter["events"],
    Types extends typeof APPlaySignalAdapter["events"][Name],
  >(
    name: Name,
    args: GTypeArrayToTypeArray<Types>,
  ) {
    this.emit(name as string, ...args as GTypeToType<Types[number]>[]);
  }
}

export class APMediaStream extends Gtk.MediaStream {
  static {
    GObject.registerClass({
      GTypeName: "APMediaStream",
      Properties: {
        buffering: GObject.param_spec_boolean(
          "is-buffering",
          "Is Buffering",
          "Whether the player is buffering",
          false,
          GObject.ParamFlags.READABLE,
        ),
        media_info: GObject.param_spec_object(
          "media-info",
          "Media Info",
          "The media info",
          GstPlay.PlayMediaInfo.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        cubic_volume: GObject.param_spec_double(
          "cubic-volume",
          "Cubic Volume",
          "The volume that is suitable for display",
          0.0,
          1.0,
          1.0,
          GObject.ParamFlags.READWRITE,
        ),
        file: GObject.param_spec_object(
          "file",
          "File",
          "The file currently being played by this stream",
          Gio.File.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        tags: GObject.param_spec_boxed(
          "tags",
          "Tags",
          "The tags of the currently playing track",
          Gst.TagList.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        title: GObject.param_spec_string(
          "title",
          "Title",
          "The title of the currently playing song",
          null,
          GObject.ParamFlags.READWRITE,
        ),
        peaks: GObject.param_spec_variant(
          "peaks",
          "Peaks",
          "The peaks of the currently playing song",
          new GLib.VariantType("as"),
          null,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "error": {
          param_types: [GLib.Error.$gtype],
        },
        "peaks-generated": {
          param_types: [(Object as any).$gtype],
        },
      },
    }, this);
  }

  private discoverer: GstPbUtils.Discoverer;
  private peaks_generator: APPeaksGenerator;

  constructor() {
    super();

    this.discoverer = GstPbUtils.Discoverer.new(GLib.MAXINT32);
    this.discoverer.connect("discovered", (_source, info) => {
      this.tags = info.get_tags();
    });

    this.peaks_generator = new APPeaksGenerator();
    this.peaks_generator.connect(
      "peaks-generated",
      (_generator: APPeaksGenerator, peaks: number[]) => {
        this.emit("peaks-generated", peaks);
      },
    );

    this._play = new GstPlay.Play();

    const play_config = this._play.get_config();
    GstPlay.Play.config_set_seek_accurate(play_config, true);
    this._play.set_config(play_config);

    const adapter = new APPlaySignalAdapter(this._play);

    adapter.connect("buffering", this.buffering_cb.bind(this));
    adapter.connect("end-of-stream", this.eos_cb.bind(this));
    adapter.connect("error", this.error_cb.bind(this));
    adapter.connect("state-changed", this.state_changed_cb.bind(this));
    adapter.connect("position-updated", this.position_updated_cb.bind(this));
    adapter.connect("duration-changed", this.duration_changed_cb.bind(this));
    adapter.connect(
      "media-info-updated",
      this.media_info_updated_cb.bind(this),
    );
    adapter.connect("volume-changed", this.volume_changed_cb.bind(this));
    adapter.connect("mute-changed", this.mute_changed_cb.bind(this));
    adapter.connect("seek-done", this.seek_done_cb.bind(this));
    adapter.connect(
      "warning",
      (_object, error: GLib.Error) => {
        console.warn("player warning", error.code, error.message);
      },
    );

    const sink = Gst.ElementFactory.make("fakesink", "sink");

    if (!sink) {
      throw new Error("Failed to create sink");
    }

    this._play.pipeline.set_property("video-sink", sink);
  }

  // cubic volume

  get cubic_volume() {
    return get_cubic_volume(this.volume);
  }

  set cubic_volume(value: number) {
    this.volume = get_linear_volume(value);
  }

  // UTILS

  protected _play: GstPlay.Play;

  // PROPERTIES

  // property: file

  protected _file: Gio.File | null = null;

  get file() {
    return this._file;
  }

  private set file(file: Gio.File | null) {
    this._file = file;
    this.notify("file");
    this.notify("title");
  }

  // property: title

  protected _title: string | null = null;

  get title() {
    const tag_title = this.tags?.get_string("title");

    if (tag_title && tag_title[0] && tag_title[1]) {
      return tag_title[1];
    }

    const file_info = this.file?.query_info(
      Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    const file_name = file_info?.get_attribute_string(
      Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
    );

    if (file_name) {
      return file_name;
    }

    return this._play.uri ?? _("Unknown File");
  }

  private set title(title: string | null) {
    this._title = title;
    this.notify("title");
  }

  // property: tags

  protected _tags: Gst.TagList | null = null;

  get tags() {
    return this._tags;
  }

  private set tags(tags: Gst.TagList | null) {
    this._tags = tags;
    this.notify("tags");
    this.notify("title");
  }

  // property: media-info

  protected _media_info: GstPlay.PlayMediaInfo | null = null;

  get media_info() {
    return this._media_info;
  }

  set media_info(media_info: GstPlay.PlayMediaInfo | null) {
    this._media_info = media_info;
    this.notify("media-info");
  }

  // property: buffering

  protected _is_buffering = false;

  get is_buffering() {
    return this._is_buffering;
  }

  // property: duration

  get_duration() {
    if (!this._play.media_info) return 0;

    return this._play.media_info.get_duration() / Gst.USECOND;
  }

  // property: error

  private _error: GLib.Error | null = null;

  get error() {
    return this._error as GLib.Error;
  }

  // property: has-audio

  get has_audio() {
    if (!this._play.media_info) return false;

    return this._play.media_info.get_number_of_audio_streams() > 0;
  }

  // property: has-video

  get has_video() {
    if (!this._play.media_info) return false;

    return this._play.media_info.get_number_of_video_streams() > 0;
  }

  vfunc_play(): boolean {
    this._play.play();
    return true;
  }

  vfunc_pause(): boolean {
    this._play.pause();
    return true;
  }

  // get prepared() {
  //   const state = this.get_state();

  //   if (!state) return false;

  //   return state >= Gst.State.READY;
  // }

  // FUNCTIONS

  // error functions

  gerror(error: GLib.Error): void {
    this._error = error;
    this.notify("error");

    // TODO: cancel pending seeks
    this._play.stop();

    if (this.prepared) {
      this.stream_unprepared();
    }

    this.emit("error", error);
  }

  // seek

  vfunc_seek(timestamp: number): void {
    this.update(timestamp);
    this._play.seek(Math.trunc(timestamp * Gst.USECOND));
  }

  vfunc_update_audio(muted: boolean, volume: number): void {
    this._play.mute = muted;
    this._play.volume = volume;
    this.notify("cubic-volume");
  }

  // handlers

  private buffering_cb(_play: GstPlay.Play, percent: number): void {
    if (percent < 100) {
      if (!this.is_buffering && this.playing) {
        this.pause();

        this._is_buffering = true;
        this.notify("is-buffering");
      }
    } else {
      this._is_buffering = false;
      this.notify("is-buffering");

      if (this.playing) this.play();
    }
  }

  private position_updated_cb(_play: GstPlay.Play, position: number): void {
    if (this.seeking && position === 0) {
      return;
    }

    this.update(position / Gst.USECOND);
  }

  private duration_changed_cb(_play: GstPlay.Play): void {
    this.notify("duration");
  }

  private state_changed_cb(
    _play: GstPlay.Play,
    state: GstPlay.PlayState,
  ): void {
    if (state == GstPlay.PlayState.BUFFERING) {
      this._is_buffering = true;
      this.notify("is-buffering");
    } else if (this.is_buffering && state != GstPlay.PlayState.STOPPED) {
      this._is_buffering = false;
      this.notify("is-buffering");
    }

    if (state == GstPlay.PlayState.STOPPED) {
      if (this.prepared) {
        this.stream_unprepared();
      }
    } else {
      if (!this.is_prepared) {
        this.stream_prepared(
          this.has_audio,
          this.has_video,
          this.seekable,
          this.duration,
        );

        this.play();
      }
    }
  }

  private error_cb(_play: GstPlay.Play, error: GLib.Error): void {
    this.gerror(error);
  }

  protected eos_cb(_play: GstPlay.Play): void {
    if (this.loop) {
      this.seek(0);
      this.play();
    }

    if (this.prepared) {
      this.stream_ended();
      this.stream_unprepared();
    }
  }

  protected media_info_updated_cb(
    _play: GstPlay.Play,
    info: GstPlay.PlayMediaInfo,
  ): void {
    this._media_info = info;

    if (!this.prepared) {
      this.stream_prepared(
        info.get_number_of_audio_streams() > 0,
        info.get_number_of_video_streams() > 0,
        info.is_seekable(),
        this._play.get_duration() / Gst.USECOND,
      );

      this.play();
    }
  }

  private volume_changed_cb(_play: GstPlay.Play): void {
    this.notify("volume");
    this.notify("cubic-volume");
  }

  private mute_changed_cb(_play: GstPlay.Play): void {
    this.notify("muted");
  }

  private seek_done_cb(_play: GstPlay.Play, timestamp: number): void {
    this.seek_success();

    this.update(timestamp / Gst.USECOND);
  }

  private reset() {
    this.tags = null;
    this.discoverer.stop();
    this.discoverer.start();

    this.peaks_generator.restart();
  }

  set_uri(uri: string): void {
    this.reset();

    this.file = null;
    this._play.uri = uri;

    this.discoverer.discover_uri_async(uri);
    this.peaks_generator.generate_peaks_async(uri);
  }

  get_uri() {
    return this._play.uri;
  }

  set_file(file: Gio.File): void {
    this.reset();

    const uri = file.get_uri();

    this.file = file;
    this._play.uri = uri;

    this.discoverer.discover_uri_async(uri);
    this.peaks_generator.generate_peaks_async(uri);
  }

  stop() {
    this._play.seek(0);
    this.pause();

    this.notify("timestamp");
  }

  get_action_group() {
    const action_group = Gio.SimpleActionGroup.new();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "play",
        activate: () => {
          this.play();
        },
      },
      {
        name: "pause",
        activate: () => {
          this.play();
        },
      },
      {
        name: "play-pause",
        activate: () => {
          if (this.playing) {
            this.pause();
          } else {
            this.play();
          }
        },
      },
      {
        name: "skip-seconds",
        parameter_type: "i",
        activate: (_source, param) => {
          if (param) {
            this.seek(this.timestamp + param.get_int32() * Gst.MSECOND);
          }
        },
      },
    ]);

    return action_group;
  }
}

// compare numbers of different precisions
function compare_numbers(a: number, b: number): boolean {
  return Math.abs(Math.fround(a) - Math.fround(b)) < 0.00001;
}

export function get_linear_volume(value: number) {
  return GstAudio.stream_volume_convert_volume(
    GstAudio.StreamVolumeFormat.CUBIC,
    GstAudio.StreamVolumeFormat.LINEAR,
    value,
  );
}

export function get_cubic_volume(value: number) {
  return GstAudio.stream_volume_convert_volume(
    GstAudio.StreamVolumeFormat.LINEAR,
    GstAudio.StreamVolumeFormat.CUBIC,
    value,
  );
}
