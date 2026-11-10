-- PostgreSQL schema for ai-avatar-optimizer
-- Idempotent DDL for storing cookie-free avatar style impressions, presses-to-open, and post-open engagement.

CREATE TABLE IF NOT EXISTS ai_guide_avatar_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guide_id TEXT NOT NULL DEFAULT 'default',
  style_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'impression' | 'open' | 'quick_reply' | 'chat_message' | 'voice_play' | 'voice_talk' | 'action_click'
  visitor TEXT NOT NULL, -- daily rotating SHA-256 salted hash (no PII or raw IP stored)
  sid TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '/',
  device TEXT NOT NULL DEFAULT 'Desktop'
);

CREATE INDEX IF NOT EXISTS ai_guide_avatar_events_lookup_idx
  ON ai_guide_avatar_events (guide_id, created_at DESC, style_id, action);
