-- Fix known demo typo in pro shop rows (e.g. label "App Creatore" → "Early bird")
UPDATE public.club_settings
SET pro_shop_rows = (
  SELECT COALESCE(jsonb_agg(fixed), '[]'::jsonb)
  FROM (
    SELECT
      CASE
        WHEN elem->>'label' ILIKE 'app creatore' THEN
          jsonb_set(
            jsonb_set(elem, '{label}', '"Early bird"'::jsonb),
            '{value}',
            to_jsonb(COALESCE(NULLIF(trim(elem->>'value'), ''), '7–9 AM · from $45'))
          )
        WHEN elem->>'value' ILIKE '%app creatore%' THEN
          jsonb_set(elem, '{value}', '"7–9 AM · from $45"'::jsonb)
        ELSE elem
      END AS fixed
    FROM jsonb_array_elements(pro_shop_rows) AS elem
  ) AS rows
)
WHERE pro_shop_rows::text ILIKE '%creatore%';
