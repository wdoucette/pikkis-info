# Pikki's Info

A fan-made decompose guide for *Love Nikki: Dress Up Queen*. It replaces the now-offline Nikki's Info guide (`ln.nikkis.info/decompose/`) with the same kind of workflow, a new “P” look, and current item data.

**Live site:** https://pikkis-info.vercel.app/

This is an unofficial, non-commercial fan project. It is not affiliated with, endorsed by, or sponsored by Elex, Paper Games, or Nikki's Info. Item data comes from [Nikki Calc](https://nikkicalc.com).

## What it does today

- Full decompose guide for **34,331 items** from Nikki Calc **v0.19b** (game data dated 30 Oct 2026).
- Fuzzy, typo-tolerant search with field filters (category, hearts, owned, wanted, status, and more).
- Mark items **Owned**, **Wanted** (wishlist), or **Done**. The guide also derives the familiar Extra clothes / Still needed / Cannot decompose / Not owned statuses.
- CSV import and export of wardrobe marks (Item name, or Category + No., plus Owned / Wanted / Done).
- **My Wardrobe** (`/my-wardrobe`): progress by category and a filtered list of everything you've marked.
- Accounts and cloud wardrobes via Supabase. Signed-out users keep marks in the browser (`localStorage`); after sign-in they can merge into the account, and the wardrobe then syncs across devices. Auth is **password-only** — the site never sends email (no magic links, confirmation, or reset mail). Forgotten passwords go through the Contact page.
- Public profiles at `/u/:username` (optional; private until you turn them on), including wardrobe stats and collections you mark public.
- Contact (`/contact`) and About (`/about`) pages.

## Data

The production site loads the item bundle from the separate data repo, **[wdoucette/pikkis-info-data](https://github.com/wdoucette/pikkis-info-data)**, not from the placeholder file in this repo's `data/` folder.

That repo's GitHub Action runs every Monday at 12:00 UTC (and on demand): it scrapes Nikki Calc, applies corrections from Paige's Overrides Google Sheet, and commits only when the bundle changes.

## Stack and local development

React, TypeScript, Vite, and Tailwind CSS v4, hosted on Vercel. Auth, profiles, wardrobes, collections, and contact messages live in Supabase (schema in `supabase/migrations/`).

```bash
npm install
npm run dev
```

Optional env vars (set in `.env.local` or on Vercel; never commit secret or `service_role` keys):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable / anon key
- `VITE_WEB3FORMS_KEY` — optional, for Contact form email notifications

## Licensing

- Code: MIT (`LICENSE`)
- Original site text and the “P” artwork: CC BY-NC 4.0 (`LICENSE-CONTENT.md`)
- Love Nikki names, items, art, and game data belong to Elex / Papergames and are not covered by those licenses.

## Roadmap

Planned features are in [ROADMAP.md](ROADMAP.md). The ideas below cover funding and operations; nothing in this section is built yet.

- **Direct support:** Patreon and/or Ko-fi.
- **Freemium cloud features:** keep localStorage wardrobe tracking free; charge for cross-device sync and public collections. Today both of those are free for anyone who signs in.
- **Google Play in-app purchases** via a Trusted Web Activity, if an Android wrapper is built.
- **YouTube Super Thanks**, if video content is added.
- **Cross-promo or revenue share with Nikki Calc** — an idea to approach them, not an agreement.
- **Custom domain:** `pikkisinfo.com` is the intended name; it has not been purchased yet.

- Consider scraping defenses for the public data bundle (authenticated API serving, Cloudflare bot detection, signed short-lived data URLs, per-IP/session rate limits) — not urgent since the catalog is public by design, but worth evaluating if hotlinking becomes a problem.

### Housekeeping

The live weekly data job lives in [`pikkis-info-data`](https://github.com/wdoucette/pikkis-info-data). This app repo still has a leftover workflow (`.github/workflows/update-data.yml`), script (`scripts/update_data.py`), and a one-item placeholder at `data/pikkis-info.min.json` that the production site does not use. The Overrides sheet is still private, so Monday's update falls back to the last saved overrides snapshot until the sheet is shared with the job.
