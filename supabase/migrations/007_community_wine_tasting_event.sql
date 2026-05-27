-- Add Wine Tasting community event when missing from seed data
UPDATE public.club_settings
SET community_items = jsonb_set(
  community_items,
  '{events}',
  COALESCE(community_items->'events', '[]'::jsonb)
    || '[{"id":"e2","name":"Wine Tasting May 31","detail":"","enabled":true}]'::jsonb
)
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(community_items->'events', '[]'::jsonb)) AS ev
  WHERE ev->>'name' ILIKE '%wine tasting%'
);
