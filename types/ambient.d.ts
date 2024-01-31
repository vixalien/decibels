declare function _(id: string): string;
declare function C_(ctx: string, id: string): string;
declare function print(args: string): void;
declare function log(obj: object, others?: object[]): void;
declare function log(msg: string, substitutions?: any[]): void;

declare const pkg: {
  version: string;
  name: string;
};

declare module console {
  export function error(...args: any[]): void;
  export function log(...args: any[]): void;
  export function warn(...args: any[]): void;
  export function info(...args: any[]): void;
  export function debug(...args: any[]): void;
}

declare module imports {
  const format: {
    format(this: String, ...args: any[]): string;
    printf(fmt: string, ...args: any[]): string;
    vprintf(fmt: string, args: any[]): string;
  };
}
