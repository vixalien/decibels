import GObject from "gi://GObject";


declare global {
  const pkg: {
    version: string;
    name: string;
  };

  function _(id: string): string;
  function C_(ctx: string, id: string): string;
  function print(args: string): void;
  function log(obj: object, others?: object[]): void;
  function log(msg: string, substitutions?: any[]): void;

  const console: {
    error(...args: any[]): void;
    log(...args: any[]): void,
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
  }

  const imports: {
    format: {
      format(this: String, ...args: any[]): string;
      printf(fmt: string, ...args: any[]): string;
      vprintf(fmt: string, args: any[]): string;
    };
  }

  interface ObjectConstructor {
    $gtype: GObject.GType<unknown>;
  }
}
