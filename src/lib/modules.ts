// Overlay module toggles from the URL: ?hud=1&stage=1&ticker=1. Every module defaults to on.

export interface OverlayModules {
  hud: boolean;
  stage: boolean;
  ticker: boolean;
}

const OFF = new Set(["0", "false", "off", "no"]);

export function parseModules(search: string): OverlayModules {
  const params = new URLSearchParams(search);
  const on = (key: string) => !OFF.has((params.get(key) ?? "1").trim().toLowerCase());
  return { hud: on("hud"), stage: on("stage"), ticker: on("ticker") };
}

export function overlayUrl(base: string, modules: OverlayModules): string {
  const url = new URL("overlay/", base);
  url.search = "";
  url.hash = "";
  const flag = (value: boolean) => (value ? "1" : "0");
  return `${url.href}?hud=${flag(modules.hud)}&stage=${flag(modules.stage)}&ticker=${flag(modules.ticker)}`;
}
