import { describe, expect, it } from "vitest";
import { advance, HEAT_S, LAP_M, newHeat, readBest, score, startTracker, stride, TOP_SPEED, trackWheel, writeBest, type Heat } from "../src/lib/race";
import { parseModules, overlayUrl } from "../src/lib/modules";
import { intensity, speedLineCount, sparksPerSecond, wheelDegreesPerSecond, type StageInput } from "../src/stage/scene";

function run(heat: Heat, seconds: number, wheelM = 0, live = true, tapEvery = 0.4): Heat {
  let h = heat;
  let sinceTap = 0;
  const dt = 1 / 60;
  for (let elapsed = 0; elapsed < seconds && !h.outcome; elapsed += dt) {
    h = advance(h, dt, wheelM, live);
    sinceTap += dt;
    if (tapEvery && sinceTap >= tapEvery) {
      h = stride(h);
      sinceTap = 0;
    }
  }
  return h;
}

describe("ghost race", () => {
  it("rewards a steady rhythm with the lap inside the heat", () => {
    const h = run(newHeat(true), HEAT_S);
    expect(h.outcome).toBe("ghost");
    expect(h.t).toBeGreaterThan(LAP_M / TOP_SPEED - 0.1);
    expect(h.t).toBeLessThan(45);
  });
  it("makes mashing stumble and slower than rhythm", () => {
    const mash = run(newHeat(true), 15, 0, true, 0.05);
    const steady = run(newHeat(true), 15);
    expect(mash.ghostM).toBeLessThan(steady.ghostM);
  });
  it("gives the win to a wheel that reaches the line first", () => {
    const h = run(newHeat(true), 5, LAP_M);
    expect(h.outcome).toBe("wheel");
  });
  it("ends at the horn when nobody finishes", () => {
    const h = run(newHeat(true), HEAT_S + 1, 3, true, 0);
    expect(h.outcome).toBe("time");
    expect(h.ghostM).toBe(0);
    expect(score(h)).toBe(0);
  });
  it("adds time left to the score only for a ghost win", () => {
    const win = run(newHeat(true), HEAT_S);
    expect(score(win)).toBeGreaterThan(300);
    const loss = run(newHeat(true), 5, LAP_M);
    expect(score(loss)).toBeLessThan(300);
  });
  it("is unranked if the signal was down at the start or at any moment", () => {
    expect(newHeat(false).ranked).toBe(false);
    expect(advance(newHeat(true), 0.1, 0, false).ranked).toBe(false);
    expect(advance(advance(newHeat(true), 0.1, 0, false), 0.1, 0, true).ranked).toBe(false);
  });
});

describe("wheel tracker", () => {
  it("adds only real distance deltas", () => {
    let t = startTracker("a", 1000n);
    t = trackWheel(t, "a", 1500n);
    t = trackWheel(t, "a", 1500n);
    t = trackWheel(t, "a", 2000n);
    expect(t.travelled).toBe(1000n);
  });
  it("rebases on a counter reset or new epoch without a jump", () => {
    let t = startTracker("a", 1000n);
    t = trackWheel(t, "a", 1500n);
    t = trackWheel(t, "b", 9_000_000n);
    expect(t.travelled).toBe(500n);
    t = trackWheel(t, "b", 9_000_100n);
    expect(t.travelled).toBe(600n);
    t = trackWheel(t, "b", 5n);
    expect(t.travelled).toBe(600n);
  });
});

describe("best score storage", () => {
  it("round-trips and survives a storage that throws", () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(readBest(storage)).toBeNull();
    writeBest(storage, 412);
    expect(readBest(storage)).toBe(412);
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readBest(broken)).toBeNull();
    expect(() => writeBest(broken, 1)).not.toThrow();
  });
});

describe("overlay URL toggles", () => {
  it("defaults every module on", () => {
    expect(parseModules("")).toEqual({ hud: true, stage: true, ticker: true });
  });
  it("turns modules off by query", () => {
    expect(parseModules("?hud=0&stage=1&ticker=false")).toEqual({ hud: false, stage: true, ticker: false });
  });
  it("builds a URL relative to wherever the desk is hosted", () => {
    expect(overlayUrl("https://gateway.example/ipfs/cid/?x=1#obs", { hud: true, stage: false, ticker: true })).toBe(
      "https://gateway.example/ipfs/cid/overlay/?hud=1&stage=0&ticker=1",
    );
  });
});

describe("stage scaling", () => {
  const input = (o: Partial<StageInput>): StageInput => ({ mode: "active", rpmMilli: 0, speedMmPerSecond: 0, celebrationId: 0, ...o });
  it("scales speed lines and sparks with rpmMilli", () => {
    expect(speedLineCount(input({ rpmMilli: 30000 }))).toBeLessThan(speedLineCount(input({ rpmMilli: 90000 })));
    expect(sparksPerSecond(input({ rpmMilli: 30000 }))).toBeLessThan(sparksPerSecond(input({ rpmMilli: 90000 })));
    expect(intensity(999_000)).toBe(1);
  });
  it("tracks speed for the wheel only above zero and only while active", () => {
    expect(wheelDegreesPerSecond(input({ speedMmPerSecond: 0 }))).toBe(0);
    expect(wheelDegreesPerSecond(input({ speedMmPerSecond: 880 }))).toBe(360);
    expect(wheelDegreesPerSecond(input({ speedMmPerSecond: 440 }))).toBe(180);
    expect(wheelDegreesPerSecond(input({ mode: "idle", speedMmPerSecond: 880 }))).toBe(0);
    expect(wheelDegreesPerSecond(input({ mode: "frozen", speedMmPerSecond: 880 }))).toBe(0);
  });
  it("has no motion in frozen or closed modes", () => {
    for (const mode of ["frozen", "closed"] as const) {
      const frozen = input({ mode, rpmMilli: 90000, speedMmPerSecond: 800 });
      expect(speedLineCount(frozen)).toBe(0);
      expect(sparksPerSecond(frozen)).toBe(0);
    }
  });
});
