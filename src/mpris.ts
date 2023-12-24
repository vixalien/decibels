import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { APMediaStream } from "./stream";

// bus_get
Gio._promisify(Gio, "bus_get", "bus_get_finish");

const MPRIS_XML = `
<!DOCTYPE node
  PUBLIC '-//freedesktop//DTD D-BUS Object Introspection 1.0//EN' 'http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd'>
<node>
  <interface name='org.freedesktop.DBus.Introspectable'>
    <method name='Introspect'>
      <arg name='data' direction='out' type='s' />
    </method>
  </interface>
  <interface name='org.freedesktop.DBus.Properties'>
    <method name='Get'>
      <arg name='interface' direction='in' type='s' />
      <arg name='property' direction='in' type='s' />
      <arg name='value' direction='out' type='v' />
    </method>
    <method name='Set'>
      <arg name='interface_name' direction='in' type='s' />
      <arg name='property_name' direction='in' type='s' />
      <arg name='value' direction='in' type='v' />
    </method>
    <method name='GetAll'>
      <arg name='interface' direction='in' type='s' />
      <arg name='properties' direction='out' type='a{sv}' />
    </method>
    <signal name='PropertiesChanged'>
      <arg name='interface_name' type='s' />
      <arg name='changed_properties' type='a{sv}' />
      <arg name='invalidated_properties' type='as' />
    </signal>
  </interface>
  <interface name='org.mpris.MediaPlayer2'>
    <method name='Raise'>
    </method>
    <method name='Quit'>
    </method>
    <property name='CanQuit' type='b' access='read' />
    <property name='Fullscreen' type='b' access='readwrite' />
    <property name='CanRaise' type='b' access='read' />
    <property name='HasTrackList' type='b' access='read' />
    <property name='Identity' type='s' access='read' />
    <property name='DesktopEntry' type='s' access='read' />
    <property name='SupportedUriSchemes' type='as' access='read' />
    <property name='SupportedMimeTypes' type='as' access='read' />
  </interface>
  <interface name='org.mpris.MediaPlayer2.Player'>
    <method name='Next' />
    <method name='Previous' />
    <method name='Pause' />
    <method name='PlayPause' />
    <method name='Stop' />
    <method name='Play' />
    <method name='Seek'>
      <arg direction='in' name='Offset' type='x' />
    </method>
    <method name='SetPosition'>
      <arg direction='in' name='TrackId' type='o' />
      <arg direction='in' name='Position' type='x' />
    </method>
    <method name='OpenUri'>
      <arg direction='in' name='Uri' type='s' />
    </method>
    <signal name='Seeked'>
      <arg name='Position' type='x' />
    </signal>
    <property name='PlaybackStatus' type='s' access='read' />
    <property name='LoopStatus' type='s' access='readwrite' />
    <property name='Rate' type='d' access='readwrite' />
    <property name='Shuffle' type='b' access='readwrite' />
    <property name='Metadata' type='a{sv}' access='read'>
    </property>
    <property name='Position' type='x' access='read' />
    <property name='MinimumRate' type='d' access='read' />
    <property name='MaximumRate' type='d' access='read' />
    <property name='CanGoNext' type='b' access='read' />
    <property name='CanGoPrevious' type='b' access='read' />
    <property name='CanPlay' type='b' access='read' />
    <property name='CanPause' type='b' access='read' />
    <property name='CanSeek' type='b' access='read' />
    <property name='CanControl' type='b' access='read' />
  </interface>
</node>
`;

export class DBusInterface {
  connection!: Gio.DBusConnection;

  constructor(private name: string, private path: string) {
    Gio.bus_get(Gio.BusType.SESSION, null)
      .then(this.got_bus.bind(this))
      .catch((e: GLib.Error) => {
        console.warn(`Unable to connect to session bus: ${e.message}`);
      });
  }

  private method_outargs = new Map<string, string>();
  private method_inargs = new Map<string, string[]>();
  private signals = new Map<
    string,
    { interface: string; args: Record<string, string> }
  >();

  private got_bus(connection: Gio.DBusConnection) {
    this.connection = connection;

    Gio.bus_own_name_on_connection(
      this.connection,
      this.name,
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
    );

    for (const iface of Gio.DBusNodeInfo.new_for_xml(MPRIS_XML).interfaces) {
      for (const method of iface.methods) {
        this.method_outargs.set(
          method.name,
          `(` + method.out_args.map((arg) => arg.signature).join("") + `)`,
        );

        this.method_inargs.set(
          method.name,
          method.in_args.map((arg) => arg.signature),
        );
      }

      for (const signal of iface.signals) {
        this.signals.set(signal.name, {
          interface: iface.name,
          args: Object.fromEntries(
            signal.args.map((arg) => [arg.name, arg.signature]),
          ),
        });
      }

      this.connection.register_object(
        this.path,
        iface,
        this._on_method_call.bind(this),
        null,
        null,
      );
    }
  }

  private _on_method_call(
    connection: Gio.DBusConnection,
    sender: string,
    object_path: string,
    interface_name: string,
    method_name: string,
    parameters: GLib.Variant,
    invocation: Gio.DBusMethodInvocation,
  ) {
    const args = parameters.unpack() as any[];

    this.method_inargs.get(method_name)!.forEach((sig, i) => {
      if (sig === "h") {
        const message = invocation.get_message();
        const fd_list = message.get_unix_fd_list()!;
        args[i] = fd_list.get(0);
      }
    });

    const method_snake_name = DBusInterface._camel_to_snake(method_name);

    let result;

    try {
      result = (this[method_snake_name as keyof this] as any)(...args);
    } catch (error) {
      invocation.return_dbus_error(
        interface_name,
        (error as string).toString(),
      );
      return;
    }

    result = [result].flat();

    const out_args = this.method_outargs.get(method_name)!;

    if (out_args != "()") {
      const variant = GLib.Variant.new(out_args, result);
      invocation.return_value(variant);
    } else {
      invocation.return_value(null);
    }
  }

  _dbus_emit_signal(signal_name: string, values: Record<string, any>) {
    if (this.signals.size === 0) return;

    const signal = this.signals.get(signal_name)!;

    const parameters = [];

    for (const [key, signature] of Object.entries(signal.args)) {
      const value = values[key];
      parameters.push(GLib.Variant.new(signature, value));
    }

    const variant = GLib.Variant.new_tuple(parameters as any);

    this.connection.emit_signal(
      null,
      this.path,
      signal.interface,
      signal_name,
      variant,
    );
  }

  static _camel_to_snake(str: string) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

export class MPRIS extends DBusInterface {
  MEDIA_PLAYER2_IFACE = "org.mpris.MediaPlayer2";
  MEDIA_PLAYER2_PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";

  private app = Gtk.Application.get_default()!;

  constructor(public stream: APMediaStream) {
    super("org.mpris.MediaPlayer2.Decibels", "/org/mpris/MediaPlayer2");

    this.stream.connect(
      "notify::title",
      this._on_current_song_changed.bind(this),
    );

    this.stream.connect(
      "notify::artist",
      this._on_current_song_changed.bind(this),
    );

    this.stream.connect(
      "notify::duration",
      this._on_current_song_changed.bind(this),
    );

    this.stream.connect(
      "notify::playing",
      this._on_player_state_changed.bind(this),
    );
    this.stream.connect(
      "notify::loop",
      this._on_repeat_mode_changed.bind(this),
    );

    this.stream.connect("notify::seeking", () => {
      if (!this.stream.seeking) {
        this._on_seek_finished(this as any, this.stream.timestamp);
      }
    });
  }

  _get_playback_status() {
    return this.stream.playing ? "Playing" : "Paused";
  }

  _get_loop_status() {
    if (this.stream.loop) {
      return "Track";
    } else {
      return "None";
    }
  }

  _get_metadata() {
    const song_dbus_path = this._get_song_dbus_path();

    const track_title = this.stream.title;

    if (!track_title) {
      return {
        "mpris:trackid": GLib.Variant.new_object_path(song_dbus_path),
      };
    }

    const length = this.stream.duration;

    const metadata: Record<string, GLib.Variant> = {
      "mpris:trackid": GLib.Variant.new_object_path(song_dbus_path),
      "mpris:length": GLib.Variant.new_int64(length),
      "xesam:title": GLib.Variant.new_string(track_title),
    };

    if (this.stream.artist) {
      metadata["xesam:artist"] = GLib.Variant.new("as", [this.stream.artist]);
    }

    return metadata;
  }

  _get_song_dbus_path() {
    return "/org/mpris/MediaPlayer2/TrackList/NoTrack";
  }

  _get_active_playlist() {
    return [false, ["/", "", ""]];
  }

  private _on_current_song_changed() {
    const properties: Record<string, GLib.Variant> = {
      Metadata: GLib.Variant.new("a{sv}", this._get_metadata()),
    };

    this._properties_changed(this.MEDIA_PLAYER2_PLAYER_IFACE, properties, []);
  }

  private _on_player_state_changed() {
    const status = this._get_playback_status();

    this._properties_changed(
      this.MEDIA_PLAYER2_PLAYER_IFACE,
      {
        PlaybackStatus: GLib.Variant.new_string(status),
      },
      [],
    );
  }

  private _on_repeat_mode_changed() {
    this._properties_changed(
      this.MEDIA_PLAYER2_PLAYER_IFACE,
      {
        LoopStatus: GLib.Variant.new_string(this._get_loop_status()),
      },
      [],
    );
  }

  private _on_seek_finished(_: Gtk.Widget, position: number) {
    this._seeked(Math.trunc(position));
  }

  // private _on_player_playlist_changed() {}

  /// methods

  /** Brings user interface to the front */
  _raise() {
    this.app.activate();
  }

  /** Causes the media player to stop running */
  _quit() {
    this.app.quit();
  }

  /** Skips to the next track in the tracklist */
  _next() {
    this.stream.skip_seconds(10);
  }

  /** Skips to the previous track in the tracklist */
  _previous() {
    this.stream.skip_seconds(-10);
  }

  /** Pauses playback */
  _pause() {
    this.stream.pause();
  }

  /** Play or Pauses playback */
  _play_pause() {
    if (this.stream.playing) {
      this.stream.pause();
    } else {
      this.stream.play();
    }
  }

  /** Stop playback */
  _stop() {
    this.stream.stop();
  }

  /**
   * Start or resume playback.
   * If there is no track to play, this has no effect
   */
  _play() {
    this.stream.play();
  }

  /**
   * Seek forward in the current track
   *
   * Seek is relative to the current player position
   * If the value passed in would mean seeking beyond the end of the track,
   * acts like a call to next
   */
  _seek(offset_variant: GLib.Variant) {
    const offset_msecond = offset_variant.get_int64();

    const new_position = this.stream.timestamp + offset_msecond;

    if (new_position < 0) {
      this.stream.seek(0);
    } else if (new_position <= this.stream.get_duration()) {
      this.stream.seek(new_position);
    } else {
      this.stream.seek(0);
      this.stream.pause();
    }
  }

  /**
   * Set the current track in microseconds
   */
  set_position(track_id: string, position_msecond: number) {
    const metadata = this._get_metadata();

    const current_track_id = metadata["mpris:trackid"].get_string()[0];

    if (current_track_id !== track_id) {
      return;
    }

    this.stream.seek(position_msecond * 1000);
  }

  /**
   * Open the URI given as an argument
   *
   * Not implemented
   */
  open_uri(_uri: string) {
    return;
  }

  /**
   * Indicate that the track position has changed.
   */
  _seeked(position: number) {
    // TODO: this doesn't work for some reason
    this._dbus_emit_signal("Seeked", {
      Position: position,
    });
  }

  _get<Property extends keyof ReturnType<typeof this._get_all>>(
    interface_name: GLib.Variant<"s">,
    property_name: GLib.Variant<"s">,
  ) {
    const iface = interface_name.get_string()[0];
    const prop = property_name.get_string()[0];

    try {
      return this._get_all(interface_name)?.[prop as Property];
    } catch (e) {
      const message = `MPRIS does not handle ${iface}.${prop}`;
      console.warn(message);
      throw new GLib.Error(GLib.LOG_DOMAIN, 0, message);
    }
  }

  _get_all(interface_name: GLib.Variant<"s">) {
    const iface = interface_name.get_string()[0];

    switch (iface) {
      case this.MEDIA_PLAYER2_IFACE:
        const application_id = this.app.get_application_id() ?? "";

        return {
          CanQuit: GLib.Variant.new_boolean(true),
          Fullscreen: GLib.Variant.new_boolean(false),
          CanSetFullscreen: GLib.Variant.new_boolean(false),
          CanRaise: GLib.Variant.new_boolean(true),
          HasTrackList: GLib.Variant.new_boolean(false),
          Identity: GLib.Variant.new_string("Decibels"),
          DesktopEntry: GLib.Variant.new_string(application_id),
          SupportedUriSchemes: GLib.Variant.new_strv([]),
          SupportedMimeTypes: GLib.Variant.new_strv([]),
        };
      case this.MEDIA_PLAYER2_PLAYER_IFACE:
        const position_msecond = Math.trunc(this.stream.timestamp);
        const playback_status = this._get_playback_status();

        return {
          PlaybackStatus: GLib.Variant.new_string(playback_status),
          LoopStatus: GLib.Variant.new_string(this._get_loop_status()),
          Rate: GLib.Variant.new_double(1.0),
          Shuffle: GLib.Variant.new_boolean(false),
          Metadata: GLib.Variant.new("a{sv}", this._get_metadata()),
          Position: GLib.Variant.new_int64(position_msecond),
          MinimumRate: GLib.Variant.new_double(1.0),
          MaximumRate: GLib.Variant.new_double(1.0),
          CanGoNext: GLib.Variant.new_boolean(true),
          CanGoPrevious: GLib.Variant.new_boolean(true),
          CanPlay: GLib.Variant.new_boolean(true),
          CanPause: GLib.Variant.new_boolean(true),
          CanSeek: GLib.Variant.new_boolean(true),
          CanControl: GLib.Variant.new_boolean(true),
        };
      case "org.freedesktop.DBus.Properties":
        return {};
      case "org.freedesktop.DBus.Introspectable":
        return {};
      default:
        console.warn(`MPRIS can not get, as it does not implement ${iface}`);
    }
  }

  _set(
    interface_name: GLib.Variant<"s">,
    property_name: GLib.Variant<"s">,
    new_value: GLib.Variant,
  ) {
    const iface = interface_name.get_string()[0];
    const prop = property_name.get_string()[0];

    switch (iface) {
      case this.MEDIA_PLAYER2_IFACE:
        if (prop === "Fullscreen") {
          return;
        }
        break;
      case this.MEDIA_PLAYER2_PLAYER_IFACE:
        switch (prop) {
          case "Rate":
          case "Volume":
            return;
          case "LoopStatus":
            switch (new_value.get_variant().get_string()[0]) {
              case "None":
                this.stream.loop = false;
                break;
              case "Track":
                this.stream.loop = true;
                break;
              case "Playlist":
                this.stream.loop = true;
                break;
            }
            break;
        }
        break;
      default:
        console.warn(
          `MPRIS can not set, as it does not implement ${interface_name}`,
        );
    }
  }

  _properties_changed(
    interface_name: string,
    changed_properties: Record<string, GLib.Variant<any>>,
    invalidated_properties: string[],
  ) {
    this._dbus_emit_signal("PropertiesChanged", {
      interface_name: interface_name,
      changed_properties: changed_properties,
      invalidated_properties: invalidated_properties,
    });
  }

  _introspect() {
    return MPRIS_XML;
  }
}

function hex_encode(string: string) {
  var hex, i;

  var result = "";
  for (i = 0; i < string.length; i++) {
    hex = string.charCodeAt(i).toString(16);
    result += ("000" + hex).slice(-4);
  }

  return result;
}
