export interface AvatarStyleSpec {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  desktopTabSize: number;
  mobileTabSize: number;
  desktopAvatarSize: number;
  mobileAvatarSize: number;
  ctaText: string | null;
  usesLogo: boolean;
}

export type StandardAvatarAction =
  | "impression"
  | "open"
  | "quick_reply"
  | "chat_message"
  | "voice_play"
  | "voice_talk"
  | "action_click";

export interface AvatarStyleCounters {
  styleId: string;
  impressions?: number;
  uniqueImpressions?: number;
  opens?: number;
  uniqueOpens?: number;
  quickReplies?: number;
  chatMessages?: number;
  voicePlays?: number;
  voiceTalks?: number;
  actionClicks?: number;
}

export interface RankedAvatarStyle extends Required<AvatarStyleCounters> {
  name: string;
  shortLabel: string;
  description: string;
  usesLogo: boolean;
  openRatePct: number;
  shareOfOpensPct: number;
  engagedTotal: number;
  isLeader: boolean;
}

export declare const DEFAULT_AVATAR_STYLES: readonly AvatarStyleSpec[];
export declare const STANDARD_ACTIONS: readonly StandardAvatarAction[];

export declare function pickAvatarStyle(opts?: {
  styleIds?: readonly string[];
  forcedStyle?: string | null;
  lockedStyle?: string | null;
  previousStyle?: string | null;
  random?: () => number;
}): string;

export declare function dailyVisitorHash(opts: {
  widgetId: string;
  ip: string;
  userAgent: string;
  salt?: string;
  now?: Date;
  timeZone?: string;
}): string;

export declare function rankAvatarStyles(
  rows: AvatarStyleCounters[],
  stylesMeta?: readonly Pick<AvatarStyleSpec, "id" | "name" | "shortLabel" | "description" | "usesLogo">[]
): RankedAvatarStyle[];

export declare function selectWinningAvatarStyle(
  rows: AvatarStyleCounters[],
  stylesMeta?: readonly Pick<AvatarStyleSpec, "id" | "name" | "shortLabel" | "description" | "usesLogo">[],
  minOpens?: number
): string | null;

export declare class MemoryAvatarStorage {
  constructor(initialConfig?: { startedAt?: string; durationDays?: number; autoOptimize?: boolean });
  getConfig(): Promise<{
    startedAt: string;
    durationDays: number;
    autoOptimize: boolean;
    lockedStyleId: string | null;
    lockedReason: string | null;
    lockedAt: string | null;
  }>;
  saveConfig(patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  recordEvent(ev: Record<string, unknown>): Promise<void>;
  getCounters(widgetId: string, sinceIso: string): Promise<Required<AvatarStyleCounters>[]>;
}

export declare class AvatarExperimentController {
  constructor(options?: {
    storage?: MemoryAvatarStorage;
    styles?: readonly Pick<AvatarStyleSpec, "id" | "name" | "shortLabel" | "description" | "usesLogo">[];
    dedupWindowMs?: number;
    salt?: string;
  });
  record(input: {
    widgetId?: string;
    styleId: string;
    action: string;
    sid?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
    now?: Date;
  }): Promise<{ ok: boolean; deduped?: boolean; error?: string }>;
  getReport(opts?: { widgetId?: string; now?: Date }): Promise<{
    widgetId: string;
    experiment: {
      startedAt: string;
      endsAt: string;
      durationDays: number;
      daysElapsed: number;
      daysRemaining: number;
      autoOptimize: boolean;
      lockedStyleId: string | null;
      lockedReason: string | null;
      lockedAt: string | null;
      recommendedWinnerId: string | null;
      status: "running" | "completed_auto_locked" | "manually_locked";
    };
    totals: {
      impressions: number;
      uniqueImpressions: number;
      opens: number;
      uniqueOpens: number;
      openRatePct: number;
      engagedTotal: number;
    };
    styles: RankedAvatarStyle[];
  }>;
}
