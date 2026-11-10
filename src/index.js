// @ts-check
/**
 * ai-avatar-optimizer
 * Open-source multi-variant AI avatar launcher randomizer, cookie-free press-to-open telemetry,
 * and time-windowed auto-optimizer.
 *
 * MIT License — Copyright (c) 2026 Sandbox Synergy LLC (https://sandboxsynergy.org)
 */

import { createHash } from "node:crypto";

/**
 * Default 5 AI launcher avatar styles:
 * - Gleaming Glass Coin (logo-only 3D glass medallion with shifting light reflection)
 * - Mini Gleaming Badge (compact circular glass coin + micro 'AI' badge)
 * - Breathing Cube & Coin (multi-layer breathing emblem + 'Ask AI')
 * - Compact Portrait (small portrait avatar + 'Ask me')
 * - Full Portrait (large portrait avatar + 'Ask me')
 */
export const DEFAULT_AVATAR_STYLES = Object.freeze([
  {
    id: "glass-coin",
    name: "Gleaming Glass Coin (Logo Only)",
    shortLabel: "Glass Coin",
    description: "Sculpted 3D glass medallion that shifts specular light reflection across the face (no text label).",
    desktopTabSize: 64,
    mobileTabSize: 56,
    desktopAvatarSize: 54,
    mobileAvatarSize: 46,
    ctaText: null,
    usesLogo: true,
  },
  {
    id: "mini-gleam",
    name: "Mini Gleaming Logo Badge (Small)",
    shortLabel: "Mini Gleam",
    description: "Compact, low-profile circular glass logo coin with shifting light reflection and a micro 'AI' badge.",
    desktopTabSize: 50,
    mobileTabSize: 44,
    desktopAvatarSize: 40,
    mobileAvatarSize: 34,
    ctaText: "AI",
    usesLogo: true,
  },
  {
    id: "cube-breath",
    name: "Breathing Isometric Cube & Glass Coin",
    shortLabel: "Cube + Coin",
    description: "3-layer isometric cube halves gently breathing around a gleaming coin with 'Ask AI' tag.",
    desktopTabSize: 62,
    mobileTabSize: 54,
    desktopAvatarSize: 50,
    mobileAvatarSize: 42,
    ctaText: "Ask AI",
    usesLogo: true,
  },
  {
    id: "compact-portrait",
    name: "Compact Portrait Pill (Small)",
    shortLabel: "Compact Portrait",
    description: "Smaller-footprint portrait avatar with audio-reactive ring and compact 'Ask me' label.",
    desktopTabSize: 56,
    mobileTabSize: 50,
    desktopAvatarSize: 46,
    mobileAvatarSize: 40,
    ctaText: "Ask me",
    usesLogo: false,
  },
  {
    id: "full-portrait",
    name: "Full Portrait Pill (Large)",
    shortLabel: "Full Portrait",
    description: "Full-size portrait avatar with audio-reactive conic ring and 'Ask me' pill.",
    desktopTabSize: 100,
    mobileTabSize: 84,
    desktopAvatarSize: 92,
    mobileAvatarSize: 76,
    ctaText: "Ask me",
    usesLogo: false,
  },
]);

export const STANDARD_ACTIONS = Object.freeze([
  "impression",
  "open",
  "quick_reply",
  "chat_message",
  "voice_play",
  "voice_talk",
  "action_click",
]);

/**
 * Picks one avatar style for a page open using a non-repeating uniform Markov transition:
 * 1. If `forcedStyle` (e.g. `?aig_style=glass-coin`) is in `styleIds`, returns it.
 * 2. If `lockedStyle` (set when the experiment window locks a winner) is in `styleIds`, returns it.
 * 3. Otherwise selects uniformly at random from `styleIds`, excluding `previousStyle` when present
 *    so consecutive page opens never show the exact same style twice in a row while preserving an
 *    exact 1/N stationary probability across all N styles.
 *
 * @param {{
 *   styleIds?: readonly string[];
 *   forcedStyle?: string | null;
 *   lockedStyle?: string | null;
 *   previousStyle?: string | null;
 *   random?: () => number;
 * }} [opts]
 * @returns {string}
 */
export function pickAvatarStyle(opts = {}) {
  const styleIds = opts.styleIds && opts.styleIds.length > 0
    ? opts.styleIds
    : DEFAULT_AVATAR_STYLES.map((s) => s.id);
  const valid = (v) => typeof v === "string" && styleIds.includes(v);

  if (valid(opts.forcedStyle)) return /** @type {string} */ (opts.forcedStyle);
  if (valid(opts.lockedStyle)) return /** @type {string} */ (opts.lockedStyle);

  const rng = opts.random ?? Math.random;
  const prev = valid(opts.previousStyle) ? opts.previousStyle : null;
  const pool = prev && styleIds.length > 1 ? styleIds.filter((id) => id !== prev) : styleIds;
  const idx = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[idx];
}

/**
 * Generates a cookie-free, privacy-safe daily-rotating visitor hash from `(day, widgetId, ip, userAgent)`.
 * Never stores raw IP addresses or personal identifiers.
 *
 * @param {{
 *   widgetId: string;
 *   ip: string;
 *   userAgent: string;
 *   salt?: string;
 *   now?: Date;
 *   timeZone?: string;
 * }} opts
 * @returns {string}
 */
export function dailyVisitorHash(opts) {
  const tz = opts.timeZone || "UTC";
  const now = opts.now || new Date();
  let day;
  try {
    day = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    day = now.toISOString().slice(0, 10);
  }
  const salt = opts.salt || "ai-avatar-optimizer-salt";
  return createHash("sha256")
    .update(`${salt}|${day}|${opts.widgetId}|${opts.ip}|${opts.userAgent}`)
    .digest("hex")
    .slice(0, 20);
}

/**
 * Ranks all avatar styles by total Presses to Open (`opens` DESC), tie-broken by
 * Open Rate (`openRatePct` DESC), then post-open engaged actions (`engagedTotal` DESC).
 *
 * @param {Array<{
 *   styleId: string;
 *   impressions?: number;
 *   uniqueImpressions?: number;
 *   opens?: number;
 *   uniqueOpens?: number;
 *   quickReplies?: number;
 *   chatMessages?: number;
 *   voicePlays?: number;
 *   voiceTalks?: number;
 *   actionClicks?: number;
 * }>} rows
 * @param {readonly { id: string; name: string; shortLabel?: string; description?: string; usesLogo?: boolean }[]} [stylesMeta]
 */
export function rankAvatarStyles(rows, stylesMeta = DEFAULT_AVATAR_STYLES) {
  const metaMap = new Map(stylesMeta.map((s) => [s.id, s]));
  const styleOrder = stylesMeta.map((s) => s.id);
  const byId = new Map();

  for (const s of stylesMeta) {
    byId.set(s.id, {
      styleId: s.id,
      impressions: 0,
      uniqueImpressions: 0,
      opens: 0,
      uniqueOpens: 0,
      quickReplies: 0,
      chatMessages: 0,
      voicePlays: 0,
      voiceTalks: 0,
      actionClicks: 0,
    });
  }

  for (const r of rows || []) {
    if (!r || !r.styleId || !byId.has(r.styleId)) continue;
    const cur = byId.get(r.styleId);
    cur.impressions += Number(r.impressions || 0);
    cur.uniqueImpressions += Number(r.uniqueImpressions || 0);
    cur.opens += Number(r.opens || 0);
    cur.uniqueOpens += Number(r.uniqueOpens || 0);
    cur.quickReplies += Number(r.quickReplies || 0);
    cur.chatMessages += Number(r.chatMessages || 0);
    cur.voicePlays += Number(r.voicePlays || 0);
    cur.voiceTalks += Number(r.voiceTalks || 0);
    cur.actionClicks += Number(r.actionClicks || 0);
  }

  const totalOpens = Array.from(byId.values()).reduce((sum, s) => sum + s.opens, 0);

  const enriched = Array.from(byId.values()).map((s) => {
    const meta = metaMap.get(s.styleId) || { id: s.styleId, name: s.styleId };
    const openRatePct =
      s.impressions > 0 ? Math.min(100, Math.round((s.opens / s.impressions) * 1000) / 10) : 0;
    const shareOfOpensPct =
      totalOpens > 0 ? Math.round((s.opens / totalOpens) * 1000) / 10 : 0;
    const engagedTotal =
      s.quickReplies + s.chatMessages + s.voicePlays + s.voiceTalks + s.actionClicks;
    return {
      ...s,
      name: meta.name,
      shortLabel: meta.shortLabel || meta.name,
      description: meta.description || "",
      usesLogo: Boolean(meta.usesLogo),
      openRatePct,
      shareOfOpensPct,
      engagedTotal,
      isLeader: false,
    };
  });

  enriched.sort(
    (a, b) =>
      b.opens - a.opens ||
      b.openRatePct - a.openRatePct ||
      b.engagedTotal - a.engagedTotal ||
      styleOrder.indexOf(a.styleId) - styleOrder.indexOf(b.styleId)
  );

  if (enriched.length > 0 && enriched[0].opens > 0) {
    enriched[0].isLeader = true;
  }

  return enriched;
}

/**
 * Selects the #1 winning avatar style if at least `minOpens` total opens have been recorded.
 *
 * @param {Parameters<typeof rankAvatarStyles>[0]} rows
 * @param {Parameters<typeof rankAvatarStyles>[1]} [stylesMeta]
 * @param {number} [minOpens]
 * @returns {string | null}
 */
export function selectWinningAvatarStyle(rows, stylesMeta = DEFAULT_AVATAR_STYLES, minOpens = 1) {
  const ranked = rankAvatarStyles(rows, stylesMeta);
  const totalOpens = ranked.reduce((sum, r) => sum + r.opens, 0);
  if (totalOpens < minOpens) return null;
  return ranked[0] && ranked[0].opens > 0 ? ranked[0].styleId : null;
}

/**
 * In-memory storage adapter for development, unit testing, or single-instance servers.
 * Production deployments can pass a Postgres or Redis adapter implementing `{ recordEvent, getCounters, getConfig, saveConfig }`.
 */
export class MemoryAvatarStorage {
  /**
   * @param {{ startedAt?: string; durationDays?: number; autoOptimize?: boolean }} [initialConfig]
   */
  constructor(initialConfig = {}) {
    this.events = [];
    this.config = {
      startedAt: initialConfig.startedAt || new Date().toISOString(),
      durationDays: initialConfig.durationDays || 60,
      autoOptimize: initialConfig.autoOptimize ?? true,
      lockedStyleId: null,
      lockedReason: null,
      lockedAt: null,
    };
  }

  async getConfig() {
    return { ...this.config };
  }

  async saveConfig(patch) {
    this.config = { ...this.config, ...patch };
    return { ...this.config };
  }

  async recordEvent(ev) {
    this.events.push({ ...ev, createdAt: ev.createdAt || new Date().toISOString() });
  }

  async getCounters(widgetId, sinceIso) {
    const sinceMs = Date.parse(sinceIso);
    const byStyle = new Map();
    const impVisitors = new Map();
    const openVisitors = new Map();

    for (const ev of this.events) {
      if (ev.widgetId !== widgetId || Date.parse(ev.createdAt) < sinceMs) continue;
      if (!byStyle.has(ev.styleId)) {
        byStyle.set(ev.styleId, {
          styleId: ev.styleId,
          impressions: 0,
          uniqueImpressions: 0,
          opens: 0,
          uniqueOpens: 0,
          quickReplies: 0,
          chatMessages: 0,
          voicePlays: 0,
          voiceTalks: 0,
          actionClicks: 0,
        });
      }
      const c = byStyle.get(ev.styleId);
      if (ev.action === "impression") {
        c.impressions++;
        if (!impVisitors.has(ev.styleId)) impVisitors.set(ev.styleId, new Set());
        impVisitors.get(ev.styleId).add(ev.visitor);
      } else if (ev.action === "open") {
        c.opens++;
        if (!openVisitors.has(ev.styleId)) openVisitors.set(ev.styleId, new Set());
        openVisitors.get(ev.styleId).add(ev.visitor);
      } else if (ev.action === "quick_reply") c.quickReplies++;
      else if (ev.action === "chat_message") c.chatMessages++;
      else if (ev.action === "voice_play") c.voicePlays++;
      else if (ev.action === "voice_talk") c.voiceTalks++;
      else if (ev.action === "action_click") c.actionClicks++;
    }

    for (const [styleId, set] of impVisitors) byStyle.get(styleId).uniqueImpressions = set.size;
    for (const [styleId, set] of openVisitors) byStyle.get(styleId).uniqueOpens = set.size;

    return Array.from(byStyle.values());
  }
}

/**
 * High-level controller that manages event recording, deduplication, 60-day leaderboard reporting,
 * and automatic winner locking.
 */
export class AvatarExperimentController {
  /**
   * @param {{
   *   storage?: MemoryAvatarStorage;
   *   styles?: readonly { id: string; name: string; shortLabel?: string; description?: string; usesLogo?: boolean }[];
   *   dedupWindowMs?: number;
   *   salt?: string;
   * }} [options]
   */
  constructor(options = {}) {
    this.storage = options.storage || new MemoryAvatarStorage();
    this.styles = options.styles || DEFAULT_AVATAR_STYLES;
    this.styleIds = new Set(this.styles.map((s) => s.id));
    this.actions = new Set(STANDARD_ACTIONS);
    this.dedupWindowMs = options.dedupWindowMs ?? 8_000;
    this.salt = options.salt || "ai-avatar-optimizer-salt";
    this.recentDedup = new Map();
  }

  /**
   * Records a widget interaction event with automatic double-tap deduplication.
   * @param {{
   *   widgetId?: string;
   *   styleId: string;
   *   action: string;
   *   sid?: string;
   *   path?: string;
   *   ip?: string;
   *   userAgent?: string;
   *   now?: Date;
   * }} input
   */
  async record(input) {
    if (!this.styleIds.has(input.styleId) || !this.actions.has(input.action)) {
      return { ok: false, error: "invalid_style_or_action" };
    }
    const now = input.now || new Date();
    const nowMs = now.getTime();
    const widgetId = input.widgetId || "default";
    const visitor = dailyVisitorHash({
      widgetId,
      ip: input.ip || "0.0.0.0",
      userAgent: input.userAgent || "",
      salt: this.salt,
      now,
    });
    const path = (input.path || "/").split("?")[0] || "/";
    const sid = String(input.sid || "");

    const dedupKey = `${widgetId}|${visitor}|${sid}|${input.styleId}|${input.action}|${path}`;
    const prevMs = this.recentDedup.get(dedupKey);
    if (prevMs !== undefined && nowMs - prevMs < this.dedupWindowMs) {
      return { ok: true, deduped: true };
    }
    this.recentDedup.set(dedupKey, nowMs);

    await this.storage.recordEvent({
      widgetId,
      styleId: input.styleId,
      action: input.action,
      visitor,
      sid,
      path,
      createdAt: now.toISOString(),
    });

    return { ok: true, deduped: false };
  }

  /**
   * Builds the experiment leaderboard report and auto-locks the winning style once the duration window completes.
   * @param {{ widgetId?: string; now?: Date }} [opts]
   */
  async getReport(opts = {}) {
    const widgetId = opts.widgetId || "default";
    const now = opts.now || new Date();
    let cfg = await this.storage.getConfig();
    const startMs = Date.parse(cfg.startedAt);
    const durationDays = cfg.durationDays || 60;
    const endMs = startMs + durationDays * 86_400_000;

    const rawCounters = await this.storage.getCounters(widgetId, cfg.startedAt);
    const styles = rankAvatarStyles(rawCounters, this.styles);
    const recommendedWinnerId = selectWinningAvatarStyle(rawCounters, this.styles);

    if (now.getTime() >= endMs && cfg.autoOptimize && !cfg.lockedStyleId && recommendedWinnerId) {
      cfg = await this.storage.saveConfig({
        lockedStyleId: recommendedWinnerId,
        lockedReason: "auto_window_complete",
        lockedAt: now.toISOString(),
      });
    }

    const daysElapsed = Math.max(0, Math.min(durationDays, Math.floor((now.getTime() - startMs) / 86_400_000)));
    const daysRemaining = Math.max(0, Math.ceil((endMs - now.getTime()) / 86_400_000));

    const totals = styles.reduce(
      (acc, s) => {
        acc.impressions += s.impressions;
        acc.uniqueImpressions += s.uniqueImpressions;
        acc.opens += s.opens;
        acc.uniqueOpens += s.uniqueOpens;
        acc.engagedTotal += s.engagedTotal;
        return acc;
      },
      { impressions: 0, uniqueImpressions: 0, opens: 0, uniqueOpens: 0, openRatePct: 0, engagedTotal: 0 }
    );
    totals.openRatePct =
      totals.impressions > 0 ? Math.min(100, Math.round((totals.opens / totals.impressions) * 1000) / 10) : 0;

    return {
      widgetId,
      experiment: {
        startedAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        durationDays,
        daysElapsed,
        daysRemaining,
        autoOptimize: cfg.autoOptimize,
        lockedStyleId: cfg.lockedStyleId,
        lockedReason: cfg.lockedReason,
        lockedAt: cfg.lockedAt,
        recommendedWinnerId,
        status: cfg.lockedStyleId
          ? cfg.lockedReason === "auto_window_complete"
            ? "completed_auto_locked"
            : "manually_locked"
          : "running",
      },
      totals,
      styles,
    };
  }
}
