-- Webstudio: close every table of the CMS to the Supabase Data API.
-- Supabase publishes each table in "public" through its REST API unless Row
-- Level Security is on. The CMS itself connects as the owner of the tables
-- (DATABASE_URL / Hyperdrive), and owners are not limited by RLS, so the CMS
-- keeps working exactly as before. Without policies, the API sees nothing.
-- This covers the original Pages CMS tables (session, user, account,
-- collaborator, app_setting, ...) and any table added later by hand.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
