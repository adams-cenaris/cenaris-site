-- Notification deduplication log
-- Tracks when push/email notifications were sent per conversation,
-- preventing the admin from being spammed for the same chat thread.
-- Run this in the Supabase SQL editor (or via supabase db push).

CREATE TABLE IF NOT EXISTS notification_log (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   UUID        REFERENCES conversations(id) ON DELETE CASCADE,
  notification_type TEXT        NOT NULL,
  channel           TEXT        NOT NULL,  -- 'push' | 'email'
  sent_at           TIMESTAMPTZ DEFAULT now()
);

-- Index used by the cooldown check query
CREATE INDEX IF NOT EXISTS notification_log_conv_type_channel
  ON notification_log (conversation_id, notification_type, channel, sent_at DESC);
