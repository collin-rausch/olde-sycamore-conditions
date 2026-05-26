-- Enable Supabase Realtime for signage tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'course_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.course_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.club_settings;
  END IF;
END $$;
