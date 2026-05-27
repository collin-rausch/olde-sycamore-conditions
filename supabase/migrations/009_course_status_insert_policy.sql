-- Allow Admin (anon key) to insert course_status when no row exists yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_status'
      AND policyname = 'Allow public insert on course_status'
  ) THEN
    CREATE POLICY "Allow public insert on course_status"
      ON public.course_status
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;
