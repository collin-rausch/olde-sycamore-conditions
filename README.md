# Olde Sycamore Golf Club — Conditions Display

Live course conditions and weather signage for **Olde Sycamore Golf Club**. React front end, Supabase backend, deployed to Vercel (or similar) for TVs and ScreenCloud.

**New owner?** Start here: **[docs/CLIENT_HANDOFF.md](docs/CLIENT_HANDOFF.md)**

## Routes

| URL | Purpose |
|-----|---------|
| `/` | **Player** — full-screen signage (default) |
| `/admin` | **Admin** — edit content, publish to screens |
| `/editor` | **Editor** — ScreenCloud app configuration |

## Stack

- **React** (Create React App) — Player, Admin, Editor
- **Supabase** — Postgres, Realtime, Edge Function `fetch-weather`
- **WeatherAPI.com** — forecast data (key stored in Supabase secrets)
- **Vercel** — recommended static hosting (`app/vercel.json` for SPA routing)

## Quick start (local)

```bash
cd app
cp .env.example .env.local   # fill in Supabase URL, anon key, admin password
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) (player), [http://localhost:3000/admin](http://localhost:3000/admin) (manager).

## Environment variables (`app/.env.local`)

| Variable | Required |
|----------|----------|
| `REACT_APP_SUPABASE_URL` | Yes |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes |
| `REACT_APP_ADMIN_PASSWORD` | Yes (for `/admin`) |
| `REACT_APP_SCREENCLOUD_APP_ID` | ScreenCloud only |
| `REACT_APP_SCREENCLOUD_APP_TOKEN` | ScreenCloud only |

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Link and push migrations:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Migrations: `001` … `009` in `supabase/migrations/` (apply in filename order).

3. Deploy weather function and set secret:

   ```bash
   npx supabase secrets set WEATHERAPI_KEY=<your-weatherapi-key>
   npx supabase functions deploy fetch-weather
   ```

4. Schedule `fetch-weather` every **10 minutes** (see `supabase/setup/weather_cron.sql` or Dashboard → Edge Functions → Schedules).

## Deploy to Vercel

1. Import repo; set **Root Directory** to `app`.
2. Add all `REACT_APP_*` env vars from `.env.example`.
3. Deploy. Confirm `/admin` loads after refresh (rewrites in `vercel.json`).

## Scripts

```bash
cd app
npm start          # dev server
npm run build      # production build
npm test           # unit tests (Supabase mocked)
```

## Project structure

```
app/                    React app (deploy this folder)
  src/routes/Player.jsx Signage display
  src/routes/Admin.jsx  Signage manager
  vercel.json           SPA routing for /admin, /editor
docs/
  CLIENT_HANDOFF.md     Operations guide for the club
supabase/
  migrations/           Database schema
  functions/fetch-weather/
  setup/weather_cron.sql
```

## License / ownership

Transferred to the club operator — configure Supabase and Vercel under the club’s accounts for long-term control.
