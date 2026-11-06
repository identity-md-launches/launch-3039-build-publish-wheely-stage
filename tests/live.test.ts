import { describe, expect, it } from "vitest";
import { CAPTION_COUNT, captionFor } from "../src/lib/captions";
import { applyFailure, applyStatus, initialLiveState, roundDistanceMm, type LiveState } from "../src/lib/live";
import { parseStatus } from "../src/lib/status";
import { tickerLines } from "../src/lib/ticker";
import { stageInputFrom } from "../src/stage/StageCanvas";
import { sparksPerSecond, speedLineCount, wheelDegreesPerSecond } from "../src/stage/scene";

const T0 = Date.parse("2026-11-06T09:00:00.000Z");

function body(o: { now?: number; age?: number; staleAfter?: number; freshness?: string; rpm?: number | string; round?: string; noAnchor?: boolean; core?: string } = {}) {
  const now = o.now ?? T0;
  return parseStatus({
    generatedAt: new Date(now).toISOString(),
    measurement: {
      freshness: o.freshness ?? "online",
      observedAt: new Date(now - (o.age ?? 1) * 1000).toISOString(),
      staleAfterSeconds: o.staleAfter ?? 120,
      coreStatus: o.core ?? "ACTIVE",
      rpmMilli: o.rpm ?? 60000,
      speedMmPerSecond: 500,
      distanceMm: "1000000",
      cumulativeWorkUnits: "100",
    },
    builder: o.noAnchor ? { status: "unavailable" } : { anchor: { settledThroughRound: o.round ?? "10", blockHeight: "5", cumulativeWork: "90" } },
  });
}

describe("freshness", () => {
  it("is live when online and within staleAfterSeconds", () => {
    expect(applyStatus(initialLiveState, body({ age: 120 }), T0).link).toBe("live");
  });
  it("goes stale when age passes staleAfterSeconds, even if freshness says online", () => {
    const live = applyStatus(initialLiveState, body({ now: T0, rpm: 60000 }), T0);
    const stale = applyStatus(live, body({ now: T0 + 500_000, age: 121, rpm: 99000 }), T0 + 500_000);
    expect(stale.link).toBe("stale");
    expect(stale.reading?.rpmMilli).toBe(60000n);
  });
  it("goes stale when freshness is not online and freezes the numbers", () => {
    const live = applyStatus(initialLiveState, body(), T0);
    const stale = applyStatus(live, body({ now: T0 + 2000, freshness: "stale", rpm: 99000, round: "99" }), T0 + 2000);
    expect(stale.link).toBe("stale");
    expect(stale.reading?.rpmMilli).toBe(60000n);
    expect(stale.anchor?.round).toBe(10n);
    expect(stale.celebration).toBeNull();
  });
  it("maps freshness offline to the offline state", () => {
    expect(applyStatus(initialLiveState, body({ freshness: "offline" }), T0).link).toBe("offline");
  });
  it("is immune to a viewer clock that is hours off", () => {
    const hoursAhead = T0 + 6 * 3_600_000;
    expect(applyStatus(initialLiveState, body({ now: T0, age: 5 }), hoursAhead).link).toBe("live");
  });
  it("ages out a cache that keeps repeating one generatedAt", () => {
    const first = applyStatus(initialLiveState, body({ now: T0, age: 5 }), T0);
    expect(first.link).toBe("live");
    expect(applyStatus(first, body({ now: T0, age: 5 }), T0 + 200_000).link).toBe("stale");
  });
  it("ignores older values while advancing the retained reading's age", () => {
    const newer = applyStatus(initialLiveState, body({ now: T0 + 5000, rpm: 70000 }), T0 + 5000);
    const retained = applyStatus(newer, body({ now: T0, rpm: 10000, round: "99" }), T0 + 5100);
    expect(retained.link).toBe("live");
    expect(retained.reading).toBe(newer.reading);
    expect(retained.anchor).toBe(newer.anchor);
    expect(retained.celebration).toBe(newer.celebration);
    expect(retained.serverClock).toBe(newer.serverClock);
    expect(retained.ageSeconds).toBe(1.1);
  });
  it("expires retained data through older cache replies and stops stage motion", () => {
    const localStart = T0 + 6 * 3_600_000;
    const first = applyStatus(initialLiveState, body({ age: 0, staleAfter: 2, rpm: 72000 }), localStart);
    const old = body({ now: T0 - 1000, age: 0, staleAfter: 999, rpm: 99000, round: "99" });
    let state = applyStatus(first, old, localStart + 2000);
    expect(state.link).toBe("live");
    expect(state.ageSeconds).toBe(2);
    for (const elapsed of [2001, 3500, 5250]) {
      state = applyStatus(state, old, localStart + elapsed);
      expect(state.link).toBe("stale");
      expect(state.ageSeconds).toBe(elapsed / 1000);
      expect(state.staleAfterSeconds).toBe(2);
      expect(state.reading).toBe(first.reading);
      expect(state.anchor).toBe(first.anchor);
      expect(state.celebration).toBeNull();
      expect(state.serverClock).toBe(first.serverClock);
    }
    const input = stageInputFrom(state);
    expect(input.mode).toBe("frozen");
    expect(speedLineCount(input)).toBe(0);
    expect(sparksPerSecond(input)).toBe(0);
    expect(wheelDegreesPerSecond(input)).toBe(0);
  });
  it("does not restore live status from an older response after failure", () => {
    const first = applyStatus(initialLiveState, body({ age: 0, staleAfter: 2 }), T0);
    const offline = applyFailure(first, T0 + 1000);
    const retained = applyStatus(offline, body({ now: T0 - 1000 }), T0 + 5250);
    expect(retained.link).toBe("offline");
    expect(retained.ageSeconds).toBe(5.25);
    expect(retained.reading).toBe(first.reading);
  });
  it("recovers from older cached replies when a fresh newer reading arrives", () => {
    const first = applyStatus(initialLiveState, body({ age: 0, staleAfter: 2 }), T0);
    const stale = applyStatus(first, body({ now: T0 - 1000 }), T0 + 5250);
    const recovered = applyStatus(stale, body({ now: T0 + 6000, age: 0, rpm: 50000, round: "11" }), T0 + 6000);
    expect(recovered.link).toBe("live");
    expect(recovered.ageSeconds).toBe(0);
    expect(recovered.reading?.rpmMilli).toBe(50000n);
    expect(recovered.celebration?.id).toBe(1);
  });
});

describe("failure", () => {
  it("shows no invented numbers when no reading ever arrived", () => {
    const state = applyFailure(initialLiveState, T0);
    expect(state.link).toBe("offline");
    expect(state.reading).toBeNull();
    expect(state.anchor).toBeNull();
    expect(tickerLines(state).join(" ")).not.toMatch(/\d/);
  });
  it("freezes last good numbers, then recovers", () => {
    const live = applyStatus(initialLiveState, body(), T0);
    const down = applyFailure(live, T0 + 2000);
    expect(down.link).toBe("offline");
    expect(down.reading).toBe(live.reading);
    expect(applyStatus(down, body({ now: T0 + 4000, rpm: 1000 }), T0 + 4000).link).toBe("live");
  });
  it("keeps the last anchor when builder.anchor is missing", () => {
    const live = applyStatus(initialLiveState, body(), T0);
    const partial = applyStatus(live, body({ now: T0 + 2000, noAnchor: true }), T0 + 2000);
    expect(partial.link).toBe("live");
    expect(partial.anchor?.round).toBe(10n);
    expect(partial.anchorMissing).toBe(true);
  });
});

describe("celebration", () => {
  const step = (s: LiveState, round: string, at: number, extra = {}) => applyStatus(s, body({ now: at, round, ...extra }), at);
  it("does not fire on the first reading", () => {
    expect(step(initialLiveState, "10", T0).celebration).toBeNull();
  });
  it("fires once per increase and never on a repeat or decrease", () => {
    let s = step(initialLiveState, "10", T0);
    s = step(s, "11", T0 + 2000);
    expect(s.celebration?.id).toBe(1);
    expect(s.celebration?.round).toBe(11n);
    s = step(s, "11", T0 + 4000);
    expect(s.celebration?.id).toBe(1);
    s = step(s, "9", T0 + 6000);
    expect(s.celebration?.id).toBe(1);
  });
  it("compares rounds as bigints", () => {
    let s = step(initialLiveState, "9007199254740992", T0);
    s = step(s, "9007199254740993", T0 + 2000);
    expect(s.celebration?.round).toBe(9007199254740993n);
  });
  it("fires once after a stale spell when the round moved meanwhile", () => {
    let s = step(initialLiveState, "10", T0);
    s = step(s, "12", T0 + 2000, { freshness: "stale" });
    expect(s.celebration).toBeNull();
    s = step(s, "12", T0 + 4000);
    expect(s.celebration?.id).toBe(1);
  });
});

describe("captions", () => {
  it("rotates across consecutive rounds", () => {
    const lines = Array.from({ length: CAPTION_COUNT }, (_, i) => captionFor(BigInt(100 + i), 5n));
    expect(new Set(lines.map((l) => l.replace(/\d[\d,]*/g, "#"))).size).toBe(CAPTION_COUNT);
    for (let i = 1; i < lines.length; i += 1) expect(lines[i]).not.toBe(lines[i - 1]);
  });
  it("never prints a missing block", () => {
    for (let i = 0; i < CAPTION_COUNT; i += 1) expect(captionFor(BigInt(i), null)).not.toMatch(/null|undefined|block/i);
  });
});

describe("roundDistanceMm", () => {
  const live = applyStatus(initialLiveState, body(), T0);
  it("scales unsettled work units by the wheel's own distance per unit", () => {
    expect(roundDistanceMm(live.reading, live.anchor)).toBe(100000n);
  });
  it("is unknown when the counters do not line up", () => {
    expect(roundDistanceMm(null, live.anchor)).toBeNull();
    expect(roundDistanceMm(live.reading, { round: 1n, blockHeight: 1n, cumulativeWork: 101n })).toBeNull();
  });
});
