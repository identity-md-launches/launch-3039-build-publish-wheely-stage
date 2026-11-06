import { describe, expect, it } from "vitest";
import { formatInt, formatKm, formatMetres, formatRpm, parseStatus, toBig } from "../src/lib/status";

describe("toBig", () => {
  it("keeps numeric strings exact past Number.MAX_SAFE_INTEGER", () => {
    expect(toBig("9007199254740993")).toBe(9007199254740993n);
    expect(toBig("123456789012345678901234567890")).toBe(123456789012345678901234567890n);
  });
  it("accepts safe JSON numbers and rejects everything else", () => {
    expect(toBig(72000)).toBe(72000n);
    for (const bad of [2 ** 60, -1, 1.5, "", "12a", "-3", null, undefined, {}, NaN]) {
      expect(toBig(bad)).toBeNull();
    }
  });
});

describe("formatting", () => {
  it("formats RPM from rpmMilli / 1000", () => {
    expect(formatRpm(0n)).toBe("0.0");
    expect(formatRpm(72000n)).toBe("72.0");
    expect(formatRpm(45678n)).toBe("45.7");
    expect(formatRpm(null)).toBe("--");
  });
  it("formats km from distanceMm", () => {
    expect(formatKm(6348818n)).toBe("6.349");
    expect(formatKm(999n)).toBe("0.001");
    expect(formatKm(9007199254740993n)).toBe("9,007,199,254.741");
    expect(formatKm(null)).toBe("--");
  });
  it("formats metres and integers", () => {
    expect(formatMetres(12345n)).toBe("12.3");
    expect(formatInt(1140n)).toBe("1,140");
    expect(formatInt(9007199254740993n)).toBe("9,007,199,254,740,993");
  });
});

describe("parseStatus", () => {
  it("reads the live API shape", () => {
    const parsed = parseStatus({
      generatedAt: "2026-11-06T09:09:38.833Z",
      measurement: {
        freshness: "online",
        observedAt: "2026-11-06T09:09:00.151Z",
        staleAfterSeconds: 120,
        counterEpoch: "e",
        cumulativeWorkUnits: "11048",
        coreStatus: "IDLE",
        rpmMilli: 0,
        speedMmPerSecond: 0,
        distanceMm: 6348818,
      },
      builder: { status: "available", anchor: { blockHeight: "1140", settledThroughRound: "367", cumulativeWork: "11048" } },
    });
    expect(parsed.measurement?.active).toBe(false);
    expect(parsed.measurement?.distanceMm).toBe(6348818n);
    expect(parsed.anchor?.round).toBe(367n);
  });
  it("treats a payload without builder.anchor as partial, not as a failure", () => {
    const parsed = parseStatus({ measurement: { freshness: "online" }, builder: { status: "unavailable" } });
    expect(parsed.anchor).toBeNull();
    expect(parsed.measurement?.rpmMilli).toBeNull();
    expect(parsed.measurement?.staleAfterSeconds).toBe(120);
  });
  it("rejects bodies with no telemetry", () => {
    for (const bad of [null, [], "nope", {}, { error: "x" }]) expect(() => parseStatus(bad)).toThrow();
  });
  it("only ACTIVE counts as active", () => {
    for (const core of ["IDLE", "active", "", null]) {
      expect(parseStatus({ measurement: { coreStatus: core } }).measurement?.active).toBe(false);
    }
    expect(parseStatus({ measurement: { coreStatus: "ACTIVE" } }).measurement?.active).toBe(true);
  });
});
