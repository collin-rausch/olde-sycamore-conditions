# AI starter prompt — copy everything below the line

Paste this at the start of a new Cursor chat (edit the [brackets] for your project).

---

You are helping me build and ship a web app. Follow my user rules: minimize scope, match existing code style, no git commits unless I explicitly ask.

## Project (fill in)

- **Name:** [Project name]
- **What it is:** [e.g. digital signage + admin for a golf club]
- **Repo root:** [path or monorepo layout]
- **App folder (deploy this):** [e.g. `app/`]
- **Live URL:** [optional]

## Stack

- **Frontend:** React (Create React App) in `[app/]`
- **Backend:** Supabase (Postgres, Realtime, Edge Functions)
- **Hosting:** Vercel (root directory = app folder)
- **Other APIs:** [e.g. WeatherAPI — secret in Supabase only]

## How I work with you

1. Read README, `AGENTS.md`, `.env.example`, and main route files before big changes.
2. Propose a short plan (5 bullets) before large work.
3. Make the smallest correct diff; don’t refactor unrelated code.
4. After changes: tell me exact commands to verify and what to set in Vercel/Supabase.
5. Never commit, push, or open a PR unless I ask.
6. Never put secrets in git (`.env.local`, service role keys, API keys).

---

## Terminal — local dev

```bash
# From repo root — adjust if app lives in app/
cd app
cp .env.example .env.local
# Edit .env.local with real values (never commit this file)

npm install
npm start
# → http://localhost:3000

# Production build check
npm run build

# Tests (CI mode, no watch)
npm run test:ci
```

**If the dev server was already running** after env changes: stop it and `npm start` again.

**Common env vars (React — must start with `REACT_APP_`):**

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_ADMIN_PASSWORD` (or other client-side config — not real security alone)

---

## Git

**I only want commits when I say so.**

When I ask for a commit:

```bash
git status
git diff
git log -5 --oneline
# Stage only relevant files — never .env.local or secrets
git add <files>
git commit -m "$(cat <<'EOF'
Short summary of why, not just what.

EOF
)"
git status
```

**Do not:** `git push --force` to main, `git commit --amend` unless I asked and the last commit wasn’t pushed, `--no-verify`, or change git config.

**When I ask for a PR:**

```bash
git status
git diff
git log main..HEAD --oneline
git push -u origin HEAD
gh pr create --title "..." --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...

EOF
)"
```

---

## Vercel

1. Import GitHub repo.
2. **Root Directory:** `app` (or whatever folder has `package.json` for the React app).
3. **Framework:** Create React App (or auto-detect).
4. **Environment variables** (Production + Preview): copy from `app/.env.example` — all `REACT_APP_*` keys.
5. Deploy. After env changes → **Redeploy**.

**SPA routing** (so `/admin` and `/editor` work on refresh), `app/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Verify after deploy:**

- `/` — main app
- `/admin` — admin (refresh page — should not 404)
- Check browser console for missing env vars

---

## Supabase

### One-time / new project

1. Create project at [supabase.com](https://supabase.com).
2. Install CLI: `npm i -g supabase` (or use `npx supabase`).
3. Link:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

4. Apply migrations (in filename order):

```bash
npx supabase db push
```

5. **Secrets** (Dashboard → Edge Functions → Secrets, or CLI):

```bash
npx supabase secrets set WEATHERAPI_KEY=<key>
# Service role stays in Supabase only — never in React or Vercel public env
```

6. Deploy edge functions:

```bash
npx supabase functions deploy <function-name>
```

7. **Cron / schedules:** Dashboard → Edge Functions → Schedules (e.g. every 10 minutes), or `supabase/setup/*.sql` as reference.

### Day-to-day

- **API URL + anon key:** Settings → API → use in `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.
- **Realtime:** enable on tables that the UI subscribes to.
- **RLS:** anon key is public in the browser — policies must match what we intend (often read + update for admin-published content).

### Local env (app)

```
REACT_APP_SUPABASE_URL=https://<ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-public-key>
```

---

## React (this repo’s patterns)

- **Entry / routing:** `app/src/App.js` — path checks for `/admin`, `/editor`, default player/view.
- **Main screens:** `app/src/routes/` (e.g. `Player.jsx`, `Admin.jsx`, `Editor.jsx`).
- **Shared logic:** `app/src/lib/` (e.g. `supabaseClient.js`, display helpers).
- **Styles:** mostly colocated `<style>` blocks in route components + `index.css` for body/global.
- **Admin preview:** keep `PlayerScaledPreview.jsx` in sync when Player layout changes.
- **Tests:** `app/src/setupTests.js` mocks Supabase + ESM SDKs; run `npm run test:ci`.

**Adding a feature checklist:**

- [ ] UI + logic in the right route/lib file
- [ ] Admin can edit/publish if content is DB-driven
- [ ] Realtime subscription if displays should update live
- [ ] Migration if schema changes
- [ ] `.env.example` / handoff doc if new env vars
- [ ] `npm run test:ci` and `npm run build`

---

## Definition of done (before client handoff)

- [ ] `npm run build` passes
- [ ] `npm run test:ci` passes (or documented why not)
- [ ] All Supabase migrations applied on production
- [ ] Edge functions deployed + secrets set + cron scheduled
- [ ] Vercel env vars set + redeployed
- [ ] `README.md` + `docs/CLIENT_HANDOFF.md` accurate
- [ ] No secrets in git

---

## First message template (short version)

```
Project: [name]
Stack: React in app/, Supabase, Vercel.
Goal today: [one sentence].

Read README and app/src/App.js first.
Plan in 5 bullets, then implement.
No commits unless I ask.
```

---

*Save a copy of this file outside the repo if you reuse it across projects — edit the bracketed sections each time.*
