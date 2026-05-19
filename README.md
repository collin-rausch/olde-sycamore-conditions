# Olde Sycamore Golf Club — Conditions Display

Live weather conditions display for Olde Sycamore Golf Club, Charlotte NC.
Built with React, Supabase, and deployed via Vercel for ScreenCloud digital signage.

## Stack
- React (CRA) — player + editor routes
- Supabase — edge function + cron job + weather cache
- Open-Meteo — free weather API (no key needed)
- Vercel — hosting
- ScreenCloud — digital signage platform

## Prerequisites
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- A [Vercel](https://vercel.com) account
- A [ScreenCloud](https://screencloud.com) account (for digital signage)

## Environment Variables

Create a `.env` file in the `app/` directory:

```bash
REACT_APP_SUPABASE_URL=https://<project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>

# ScreenCloud app credentials (used in the editor route)
REACT_APP_SCREENCLOUD_APP_ID=<screencloud-app-id>
REACT_APP_SCREENCLOUD_APP_TOKEN=<screencloud-app-token>
```

Create a `.env` file in the project root for Supabase CLI operations:

```bash
SUPABASE_ACCESS_TOKEN=<your-supabase-cli-access-token>
```

## Local Development Setup

1. Install dependencies:

   ```bash
   cd app
   npm install
   ```

2. Start the development server:

   ```bash
   npm start
   ```

   The app will open at [http://localhost:3000](http://localhost:3000).

## Supabase Setup

This project uses Supabase Edge Functions and a Postgres database to cache weather data fetched from the Open-Meteo API.

1. Link your local project to Supabase:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

2. Apply database migrations (once they are created in `supabase/migrations/`):

   ```bash
   npx supabase db push
   ```

3. Deploy Edge Functions (once they are created in `supabase/functions/`):

   ```bash
   npx supabase functions deploy
   ```

4. Set up a Supabase Cron job to periodically refresh the weather cache (recommended every 10–15 minutes). This can be configured in the Supabase Dashboard under **Database → Cron**.

## Deployment

### Vercel

1. Import your GitHub repository into Vercel.
2. Set the **Root Directory** to `app`.
3. Add the environment variables listed above in the Vercel project settings.
4. Deploy — Vercel will run `npm run build` automatically.

### ScreenCloud

1. In ScreenCloud, create a new Web Content app.
2. Point the URL to your deployed Vercel domain.
3. Use the editor route to configure display settings, then assign the player route to your signage screens.

## Project Structure

```
.
├── app/                    # React application (Create React App)
│   ├── public/             # Static assets
│   ├── src/                # React components and routes
│   ├── package.json        # Dependencies and scripts
│   └── .gitignore
├── supabase/
│   ├── functions/          # Supabase Edge Functions (weather fetcher)
│   └── migrations/         # Postgres schema migrations
├── .gitignore              # Root-level ignores
└── README.md               # This file
```
