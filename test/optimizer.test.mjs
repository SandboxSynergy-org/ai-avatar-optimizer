import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AvatarExperimentController,
  dailyVisitorHash,
  DEFAULT_AVATAR_STYLES,
  MemoryAvatarStorage,
  pickAvatarStyle,
  rankAvatarStyles,
  selectWinningAvatarStyle,
} from "../src/index.js";

test("DEFAULT_AVATAR_STYLES includes 5 distinct variants (gleaming glass coin, mini gleam, breathing cube, compact & full portrait)", () => {
  assert.equal(DEFAULT_AVATAR_STYLES.length, 5);
  const ids = DEFAULT_AVATAR_STYLES.map((s) => s.id);
  assert.deepEqual(ids, [
    "glass-coin",
    "mini-gleam",
    "cube-breath",
    "compact-portrait",
    "full-portrait",
  ]);
  const coin = DEFAULT_AVATAR_STYLES.find((s) => s.id === "glass-coin");
  assert.equal(coin.ctaText, null);
  assert.equal(coin.usesLogo, true);
});

test("pickAvatarStyle: honors forcedStyle and lockedStyle, never repeats previousStyle back-to-back, and converges to uniform 1/N (20%) share", () => {
  assert.equal(pickAvatarStyle({ forcedStyle: "mini-gleam", previousStyle: "mini-gleam" }), "mini-gleam");
  assert.equal(pickAvatarStyle({ lockedStyle: "cube-breath", previousStyle: "cube-breath" }), "cube-breath");

  let state = 9876543;
  const rng = () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };

  const counts = {};
  let prev = null;
  for (let i = 0; i < 6000; i++) {
    const next = pickAvatarStyle({ previousStyle: prev, random: rng });
    if (prev) assert.notEqual(next, prev, "never picks identical style twice in a row");
    counts[next] = (counts[next] || 0) + 1;
    prev = next;
  }

  for (const s of DEFAULT_AVATAR_STYLES) {
    const share = counts[s.id] / 6000;
    assert.ok(share > 0.17 && share < 0.23, `expected ~20% share for ${s.id}, got ${share}`);
  }
});

test("dailyVisitorHash rotates daily and does not leak raw IPs", () => {
  const h1 = dailyVisitorHash({
    widgetId: "demo",
    ip: "203.0.113.42",
    userAgent: "Mozilla/5.0",
    now: new Date("2026-11-10T12:00:00Z"),
  });
  const h2 = dailyVisitorHash({
    widgetId: "demo",
    ip: "203.0.113.42",
    userAgent: "Mozilla/5.0",
    now: new Date("2026-11-11T12:00:00Z"),
  });
  assert.equal(h1.length, 20);
  assert.notEqual(h1, h2, "rotates across calendar days");
  assert.ok(!h1.includes("203.0.113.42"));
});

test("AvatarExperimentController deduplicates rapid double-taps, ranks styles by presses to open, and auto-locks winner after 60 days", async () => {
  const storage = new MemoryAvatarStorage({
    startedAt: "2026-11-10T00:00:00.000Z",
    durationDays: 60,
    autoOptimize: true,
  });
  const ctrl = new AvatarExperimentController({ storage, dedupWindowMs: 8000 });

  const t0 = new Date("2026-11-15T10:00:00.000Z");

  // Record impressions and opens for glass-coin (3 opens) and full-portrait (1 open)
  for (let i = 1; i <= 10; i++) {
    await ctrl.record({
      widgetId: "site",
      styleId: "glass-coin",
      action: "impression",
      sid: `s${i}`,
      ip: `198.51.100.${i}`,
      now: t0,
    });
    await ctrl.record({
      widgetId: "site",
      styleId: "full-portrait",
      action: "impression",
      sid: `p${i}`,
      ip: `198.51.100.${100 + i}`,
      now: t0,
    });
  }

  // Accidental double-tap within 2 seconds from same visitor/sid/path is deduplicated
  const open1 = await ctrl.record({
    widgetId: "site",
    styleId: "glass-coin",
    action: "open",
    sid: "s1",
    ip: "198.51.100.1",
    now: t0,
  });
  const open1Dup = await ctrl.record({
    widgetId: "site",
    styleId: "glass-coin",
    action: "open",
    sid: "s1",
    ip: "198.51.100.1",
    now: new Date(t0.getTime() + 1500),
  });
  assert.equal(open1.deduped, false);
  assert.equal(open1Dup.deduped, true);

  await ctrl.record({
    widgetId: "site",
    styleId: "glass-coin",
    action: "open",
    sid: "s2",
    ip: "198.51.100.2",
    now: t0,
  });
  await ctrl.record({
    widgetId: "site",
    styleId: "glass-coin",
    action: "open",
    sid: "s3",
    ip: "198.51.100.3",
    now: t0,
  });
  await ctrl.record({
    widgetId: "site",
    styleId: "full-portrait",
    action: "open",
    sid: "p1",
    ip: "198.51.100.101",
    now: t0,
  });

  // Mid-experiment check (Day 5 of 60): still running, glass-coin is #1 leader
  const midReport = await ctrl.getReport({ widgetId: "site", now: t0 });
  assert.equal(midReport.experiment.status, "running");
  assert.equal(midReport.experiment.lockedStyleId, null);
  assert.equal(midReport.experiment.recommendedWinnerId, "glass-coin");
  assert.equal(midReport.styles[0].styleId, "glass-coin");
  assert.equal(midReport.styles[0].opens, 3);
  assert.equal(midReport.styles[0].isLeader, true);

  // End-of-window check (Day 61): auto-locks onto glass-coin
  const endReport = await ctrl.getReport({
    widgetId: "site",
    now: new Date("2027-01-10T00:00:00.000Z"),
  });
  assert.equal(endReport.experiment.status, "completed_auto_locked");
  assert.equal(endReport.experiment.lockedStyleId, "glass-coin");
  assert.equal(selectWinningAvatarStyle(endReport.styles), "glass-coin");
  assert.equal(rankAvatarStyles(endReport.styles)[0].styleId, "glass-coin");
});
