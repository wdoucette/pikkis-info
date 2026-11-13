# Pikki's Info

**A fresh fan-made decompose guide for *Love Nikki: Dress Up Queen***.

Replaces the now-offline `ln.nikkis.info/decompose/` with up-to-date data from Nikki Calc, a clean “P” brand, mobile-first design, local wardrobe tracking, and the exact same workflow you loved.

### Live Site
→ https://pikkis-info.vercel.app (deployed from this repo)

### Features
- Real-time data loaded from `data/pikkis-info.min.json` (updated weekly via GitHub Actions)
- Search, category tabs, status filters (Extra clothes, Still needed, Cannot decompose, etc.)
- Owned / Done tracking (saved in browser)
- Full item pages with “Used to craft” (Need × N), Required counts (rd + recolours), comments, edited markers
- CSV import/export compatible with Paige’s sheet
- Shareable filter URLs

### Data Automation
`.github/workflows/update-data.yml` runs every Monday at 12:00 UTC (and on manual dispatch).

The script `scripts/update_data.py` will eventually scrape Nikki Calc + the Overrides Google Sheet, merge, compute fields, and commit only when data changes.

Current data: **Nikki Calc v0.19b** (34,331 items).

### Development
```bash
npm install
npm run dev
```

Built with React, TypeScript, Tailwind v4, React Router, Fuse.js, Vite.

Fan project • Not affiliated with Elex, Paper Games, or Nikki's Info.

Data credit in footer.

## Accounts & cloud wardrobes (Supabase)

- Supabase project `pikkis-info` (ref `fosgctjofhkshfseaxgp`, free tier). Schema lives in `supabase/migrations/`.
- Tables: `profiles`, `wardrobe_items`, `collections`, `collection_items`, all with Row Level Security:
  users read/write only their own rows; public profiles (and their public collections / wardrobe stats) are readable by anyone.
- The browser uses the **publishable** key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` on Vercel, fallback in `src/lib/supabase.ts`).
  Never commit a `service_role` / secret key.
- Signed-out users keep their wardrobe in `localStorage`; after signing in they are offered a one-click merge.
- Routes: `/account` (profile, preferences, collections, password), `/u/:username` (public profile).

## Contact form

- `/contact` stores messages in Supabase `public.contact_messages` (insert-only for the public; read them in the Supabase dashboard
  Table Editor or SQL). A trigger fills server-side fields, hashes the sender IP with a private salt, and rate-limits
  (5 per hour per IP, 30 per minute overall). Client side: honeypot field + 30 s / 5 per hour throttle.
- Optional email notification: set `VITE_WEB3FORMS_KEY` on Vercel (a free Web3Forms access key; public by design) and redeploy.
  No recipient address is stored in this repo.

## Licensing

Code: MIT (`LICENSE`). Original site text and the "P" artwork: CC BY-NC 4.0 (`LICENSE-CONTENT.md`).
Love Nikki names, items, art and game data belong to Elex / Papergames; this is an unofficial, non-commercial fan project.
