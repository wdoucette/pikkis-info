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
