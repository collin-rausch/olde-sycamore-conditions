ALTER TABLE public.weather_cache
  ADD COLUMN IF NOT EXISTS sunrise_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sunset_at TIMESTAMPTZ;

COMMENT ON COLUMN public.weather_cache.sunrise_at IS
  'Today''s sunrise at Olde Sycamore (Charlotte NC), America/New_York.';
COMMENT ON COLUMN public.weather_cache.sunset_at IS
  'Today''s sunset at Olde Sycamore (Charlotte NC), America/New_York.';
