import { Application } from "./application.js";

export function main(argv: string[]): Promise<number> {
  const app = new Application();
  // @ts-expect-error gi.ts can't generate this, but it exists.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
  return app.run(argv);
}
