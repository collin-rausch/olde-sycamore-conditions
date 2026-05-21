CREATE TABLE IF NOT EXISTS public.course_status (
  id                  BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  course_status       TEXT NOT NULL DEFAULT 'Open',
  cart_rule           TEXT NOT NULL DEFAULT '90° Rule',
  greens_speed        NUMERIC NOT NULL DEFAULT 11.2,
  fairway_condition   TEXT NOT NULL DEFAULT 'Firm',
  bunker_condition    TEXT NOT NULL DEFAULT 'Groomed',
  daily_note          TEXT DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.course_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on course_status"
  ON public.course_status
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public update on course_status"
  ON public.course_status
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on course_status"
  ON public.course_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.course_status (
  course_status,
  cart_rule,
  greens_speed,
  fairway_condition,
  bunker_condition,
  daily_note
)
SELECT 'Open', '90° Rule', 11.2, 'Firm', 'Groomed', ''
WHERE NOT EXISTS (SELECT 1 FROM public.course_status);
