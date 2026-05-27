-- Run once in Supabase Dashboard → SQL Editor (or via pg_cron after enabling extension).
-- Refreshes weather_cache every 10 minutes using the fetch-weather Edge Function.
--
-- Prerequisites:
-- 1. Deploy function: npx supabase functions deploy fetch-weather
-- 2. Set secrets: WEATHERAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto in Edge Functions)
-- 3. Enable pg_cron + pg_net extensions (Database → Extensions)

-- Example using pg_cron + pg_net (adjust URL and service role key for your project):
/*
SELECT cron.schedule(
  'olde-sycamore-fetch-weather',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/fetch-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
*/

-- Alternative: Supabase Dashboard → Edge Functions → fetch-weather → Schedules → every 10 minutes
