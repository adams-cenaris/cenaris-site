-- Row Level Security — run this in the Supabase SQL editor.
--
-- The service role key (used by all serverless functions) bypasses RLS,
-- so existing server-side code is completely unaffected.
-- The anon/public role gets zero access by default, which means accidental
-- use of the anon key in future code can never expose or modify data.

ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
