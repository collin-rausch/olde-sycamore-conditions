CREATE TABLE IF NOT EXISTS public.club_settings (
  id                BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  club_tagline      TEXT NOT NULL DEFAULT '18 holes · Est. 1997',
  show_tagline      BOOLEAN NOT NULL DEFAULT true,
  location_name     TEXT NOT NULL DEFAULT 'Charlotte, NC',
  latitude          NUMERIC,
  longitude         NUMERIC,
  logo_url          TEXT,
  accent_color      TEXT NOT NULL DEFAULT '#7ab648',
  panel_bg          TEXT NOT NULL DEFAULT 'dark_green',
  panel_bg_custom   TEXT DEFAULT 'rgba(6,14,8,0.82)',
  bg_photo_url      TEXT,
  pro_shop_title    TEXT NOT NULL DEFAULT 'Pro Shop & Dining',
  pro_shop_rows     JSONB NOT NULL DEFAULT '[]'::jsonb,
  community_items   JSONB NOT NULL DEFAULT '{}'::jsonb,
  tournament_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_slots     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on club_settings"
  ON public.club_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public update on club_settings"
  ON public.club_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public insert on club_settings"
  ON public.club_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on club_settings"
  ON public.club_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.club_settings (
  club_tagline,
  show_tagline,
  location_name,
  latitude,
  longitude,
  logo_url,
  accent_color,
  panel_bg,
  panel_bg_custom,
  bg_photo_url,
  pro_shop_title,
  pro_shop_rows,
  community_items,
  tournament_data,
  display_slots
)
SELECT
  '18 holes · Est. 1997',
  true,
  'Charlotte, NC',
  35.1653,
  -80.6093,
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png',
  '#7ab648',
  'dark_green',
  'rgba(6,14,8,0.82)',
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp',
  'Pro Shop & Dining',
  '[
    {"id":"1","label":"Pro shop","value":"7 AM – 6 PM","enabled":true},
    {"id":"2","label":"Bar & grill","value":"11 AM – 9 PM","enabled":true},
    {"id":"3","label":"Happy hour","value":"4–7 PM · $5 drafts","enabled":true,"highlight":true},
    {"id":"4","label":"Today''s special","value":"Prime Rib Night","enabled":true},
    {"id":"5","label":"Cart rental","value":"$20 · Paths only today","enabled":true}
  ]'::jsonb,
  '{
    "achievements":[
      {"id":"a1","type":"HOLE IN ONE","name":"Robert Chen","detail":"Hole 7 · 162 yds · 7-iron · May 21","date":"2026-05-21","enabled":true},
      {"id":"a2","type":"LOW ROUND","name":"J. Williams","detail":"68 · May 20 · -4 under par","date":"2026-05-20","enabled":true}
    ],
    "events":[
      {"id":"e1","name":"Men''s Invitational","detail":"May 24–26 · Registration open","enabled":true}
    ]
  }'::jsonb,
  '{
    "name":"Men''s Invitational",
    "round":"Round 2",
    "golfGeniusApi":false,
    "apiKey":"",
    "rows":[
      {"position":1,"name":"J. Williams","score":"-5","thru":"F","enabled":true},
      {"position":2,"name":"M. Thompson","score":"-3","thru":"14","enabled":true},
      {"position":3,"name":"R. Chen","score":"-2","thru":"F","enabled":true},
      {"position":4,"name":"D. Martinez","score":"+1","thru":"12","enabled":true},
      {"position":5,"name":"T. Johnson","score":"+2","thru":"F","enabled":true}
    ]
  }'::jsonb,
  '{
    "center":{"tournament":true,"memberSpotlight":true,"pgaTour":true,"courseNotice":true,"courseTips":true},
    "panel":{"weather":true,"proShop":true,"community":true}
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.club_settings);

COMMENT ON TABLE public.club_settings IS
  'Display configuration for Olde Sycamore signage — branding, slots, pro shop, community, location.';
