# Olde Sycamore Conditions Display — Client Handoff

This guide is for the club team (or IT partner) taking over the signage system **today**.

## What you have

| Piece | Purpose |
|-------|---------|
| **Player** (`/`) | Full-screen TV display — weather, course conditions, rotating center cards, pro shop, community |
| **Admin** (`/admin`) | Password-protected manager — edit content and **Publish to all screens** |
| **Editor** (`/editor`) | ScreenCloud configuration panel (optional message / units) |
| **Supabase** | Database + weather refresh function |
| **Vercel** (recommended) | Hosts the React app |

## Day-one checklist

### 1. Environment (Vercel or local)

Copy `app/.env.example` → `app/.env.local` and set:

| Variable | Required | Notes |
|----------|----------|--------|
| `REACT_APP_SUPABASE_URL` | Yes | Project URL from Supabase → Settings → API |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | `anon` public key (same page) |
| `REACT_APP_ADMIN_PASSWORD` | Yes | Password for `/admin` — choose a strong value |
| `REACT_APP_SCREENCLOUD_*` | If using Editor | From ScreenCloud app settings |

Redeploy Vercel after changing env vars.

### 2. Supabase database

Apply all migrations (in order):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Migrations live in `supabase/migrations/` (`001` … `009`). Notable later migrations:

| File | Purpose |
|------|---------|
| `007_community_wine_tasting_event.sql` | Seeds Wine Tasting event if missing |
| `008_fix_demo_typos.sql` | Fixes demo copy typos in seeded data |
| `009_course_status_insert_policy.sql` | Lets Admin create the first course status row |

### 3. Weather API (required for live weather)

1. Create a key at [weatherapi.com](https://www.weatherapi.com/) (free tier is fine to start).
2. Supabase → **Edge Functions** → `fetch-weather` → **Secrets** → add `WEATHERAPI_KEY`.
3. Deploy the function: `npx supabase functions deploy fetch-weather`
4. Schedule it every **10 minutes** (Dashboard → function → Schedules, or see `supabase/setup/weather_cron.sql`).

Weather uses coordinates from **club_settings** (set when you publish location in Admin).

### 4. First publish

1. Open `https://<your-domain>/admin`
2. Sign in with `REACT_APP_ADMIN_PASSWORD`
3. Review **Club**, **Conditions**, **Display slots**, **Pro Shop**, **Community**
4. Click **Publish to all screens**
5. Open `https://<your-domain>/` on a TV or browser — confirm weather and your events appear

### 5. ScreenCloud (if used)

- **Player URL:** `https://<your-domain>/`
- **Editor URL:** `https://<your-domain>/editor`
- Use landscape 16:9; resolution 1920×1080 recommended

## Daily operations

| Task | Where |
|------|--------|
| Update greens speed, cart rule, daily note | Admin → Conditions → Publish |
| Change pro shop hours / specials | Admin → Pro Shop → Publish |
| Add achievement or event | Admin → Community → Publish |
| Toggle center cards (tournament, PGA, notice, tips) | Admin → Display slots → Publish |
| Change course photo or logo | Admin → Branding → Publish |

Screens update within seconds via Supabase Realtime after publish.

## URLs reference

| Route | Audience |
|-------|----------|
| `/` | Signage displays |
| `/admin` | Staff only |
| `/editor` | ScreenCloud setup |

## Security (important)

- **Admin password** only hides the `/admin` UI. The database allows updates with the **anon** key (by design for this app).
- Keep the **service role** key secret — never put it in the React app or Vercel public env vars.
- Rotate `REACT_APP_ADMIN_PASSWORD` in Vercel if staff changes.

For stricter security later, consider Supabase Auth for Admin or Edge Functions for writes.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No weather / stale data | Check `WEATHERAPI_KEY`, cron schedule, and Admin location + Publish |
| Admin publish fails | Browser console + Supabase logs; confirm RLS migrations applied |
| Events missing on TV | Admin → Community → add events → **Publish** (events are not demo-only) |
| `/admin` 404 on refresh | Ensure `app/vercel.json` is deployed (SPA rewrite) |
| Blank player | Check Supabase URL/key in Vercel env; open browser devtools |

## Verify the app (developers / IT)

From the `app/` folder:

```bash
npm install
npm run test:ci    # unit tests (no live Supabase needed)
npm run build      # production build
```

## Support contacts

- **Weather API:** WeatherAPI.com dashboard  
- **Hosting:** Vercel project settings  
- **Database:** Supabase project dashboard  

## Repository map

```
app/src/routes/Player.jsx     — TV display
app/src/routes/Admin.jsx      — Signage manager
app/src/lib/communityDisplay.js — Community events/achievements logic
supabase/functions/fetch-weather — Weather refresh
supabase/migrations/          — Database schema (run in order)
```
