-- Create the weather_cache table
CREATE TABLE IF NOT EXISTS public.weather_cache (
  id                  BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  temperature_f       NUMERIC,
  feels_like_f        NUMERIC,
  humidity            NUMERIC,
  wind_speed_mph      NUMERIC,
  wind_direction      NUMERIC,
  weather_code        INTEGER,
  condition_text      TEXT,
  icon                TEXT,
  cloud_cover         NUMERIC,
  uv_index            NUMERIC,
  precip_probability  NUMERIC,
  is_day              INTEGER,
  hourly_forecast     JSONB,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the React app using anon key)
CREATE POLICY "Allow public read on weather_cache"
  ON public.weather_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role full access (for the Edge Function)
CREATE POLICY "Allow service role full access on weather_cache"
  ON public.weather_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.weather_cache IS 
  'Latest weather snapshot from Open-Meteo for Olde Sycamore Golf Club, Charlotte NC (35.2271, -80.8431). Refreshed every 10 minutes via Edge Function cron job.';