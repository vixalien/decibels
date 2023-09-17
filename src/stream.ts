import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gst from "gi://Gst";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";
import GstAudio from "gi://GstAudio";

if (!Gst.is_initialized()) {
  GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

  Gst.init(null);
}

type GTypeToType<Y extends GObject.GType> = Y extends GObject.GType<infer T> ? T
  : never;

type GTypeArrayToTypeArray<Y extends readonly GObject.GType[]> = {
  [K in keyof Y]: GTypeToType<Y[K]>;
};

class MuzikaPlaySignalAdapter extends GObject.Object {
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
      GTypeName: "MuzikaPlaySignalAdapter",
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
    Name extends keyof typeof MuzikaPlaySignalAdapter["events"],
    Types extends typeof MuzikaPlaySignalAdapter["events"][Name],
  >(
    name: Name,
    args: GTypeArrayToTypeArray<Types>,
  ) {
    this.emit(name as string, ...args as GTypeToType<Types[number]>[]);
  }
}

export class MuzikaMediaStream extends Gtk.MediaStream {
  static {
    GObject.registerClass({
      GTypeName: "MuzikaMediaStream",
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
          GObject.ParamFlags.READABLE,
        ),
      },
    }, this);
  }

  constructor() {
    super();

    this._play = new GstPlay.Play();

    const play_config = this._play.get_config();
    GstPlay.Play.config_set_seek_accurate(play_config, true);
    this._play.set_config(play_config);

    const adapter = new MuzikaPlaySignalAdapter(this._play);

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

  get volume(): number {
    return this._play.volume;
  }

  set volume(volume: number) {
    this._play.volume = volume;
    this.notify("volume");
    this.notify("cubic-volume");
  }

  // cubic volume

  get cubic_volume() {
    return get_cubic_volume(this.volume);
  }

  set cubic_volume(value: number) {
    this.volume = get_linear_volume(value);
  }

  get muted(): boolean {
    return this._play.mute;
  }

  set muted(muted: boolean) {
    this._play.mute = muted;
    this.notify("muted");
  }

  // UTILS

  protected _play: GstPlay.Play;

  get timestamp() {
    return super.timestamp;
  }

  // PROPERTIES

  // property: media-info

  protected _media_info: GstPlay.PlayMediaInfo | null = null;

  get media_info() {
    return this._media_info;
  }

  set media_info(media_info: GstPlay.PlayMediaInfo | null) {
    this._media_info = media_info;
    this.notify("media-info");
  }

  // property: state

  private _state = GstPlay.PlayState.STOPPED;

  get state() {
    return this._state;
  }

  // property: buffering

  protected _is_buffering = false;

  get is_buffering() {
    return this._is_buffering;
  }

  // property: duration

  get duration() {
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

  // property: playing

  protected _playing = false;

  get playing() {
    return this._playing;
  }

  set playing(value) {
    if (value) {
      this._play.play();
    } else {
      this._play.pause();
    }

    this._playing = value;
    this.notify("playing");
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  // property: playing

  // get prepared() {
  //   const state = this.get_state();

  //   if (!state) return false;

  //   return state >= Gst.State.READY;
  // }

  // property: seekable

  // first try to refresh URI when an error occurs

  protected refreshed_uri = false;

  protected async refresh_uri(): Promise<void> {
    this.refreshed_uri = true;
  }

  // FUNCTIONS

  // error functions

  gerror(error: GLib.Error): void {
    if (this.refreshed_uri === false) {
      this.refresh_uri();

      return;
    }

    this._error = error;
    this.notify("error");

    console.error(
      "error during playback",
      error.toString(),
      error.code,
      error.domain,
      error.message,
    );

    console.error(
      "error name",
      GstPlay.play_error_get_name(error as GstPlay.PlayError),
    );

    // TODO: cancel pending seeks
    this._play.stop();

    if (this.prepared) {
      this.stream_unprepared();
    }

    this._playing = false;
  }

  // seek

  vfunc_seek(timestamp: number): void {
    this.update(timestamp);
    this._play.seek(Math.trunc(timestamp * Gst.USECOND));
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
    this._state = state;

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
      }
    }
  }

  private error_cb(_play: GstPlay.Play, error: GLib.Error): void {
    this.gerror(error);
  }

  protected eos_cb(_play: GstPlay.Play): void {
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

    this.refreshed_uri = false;

    if (!this.prepared) {
      this.stream_prepared(
        info.get_number_of_audio_streams() > 0,
        info.get_number_of_video_streams() > 0,
        info.is_seekable(),
        this._play.get_duration(),
      );
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

  protected set_uri(uri: string): void {
    this._play.uri = uri;
  }

  stop() {
    this._play.stop();

    this.notify("timestamp");
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
