# Monetization roadmap

A plan for supporting [Pikki's Info](https://pikkis-info.vercel.app/), a fan-made *Love Nikki: Dress Up Queen* decompose guide. Nothing in the paid or support sections is built yet. This is not legal advice.

## Current state

The guide is free. Auth is Supabase **password-only** (email + password). The site never sends email — no magic links, confirmation mail, or password-reset mail. Forgotten passwords go through the Contact page.

Cloud sync and public profile collections are already free for signed-in users. The freemium gate is planned, not implemented.

## Direct support

- **[Ko-fi](https://www.ko-fi.com)** for one-time tips. Ko-fi takes a [0% platform fee on one-time donations and 5% on memberships](https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee) (payment-processor fees still apply).
- **[Patreon](https://www.patreon.com/pricing)** at $2–3/month for daily users.

Reference point: Nikki's Info reportedly had ~198 patrons at $2/month in 2021 before it shut down. Treat that as the ceiling for a mature Love Nikki community tool, not a forecast.

## Freemium model

| Tier | What you get |
| --- | --- |
| Free | Wardrobe marks in `localStorage` only (this browser). The catalog stays free. |
| Paid | Cross-device sync and public profile collections. |

This maps to the existing RLS tables (`profiles`, `wardrobe_items`, `collections`, `collection_items`). No new infrastructure is required.

## Paid convenience features

Charge for convenience, not for data. Do not paywall the catalog.

- **Dye planner** — match items to a target colorway.
- **Stage countdowns** with auto-generated decompose priorities.
- **Wishlist pings** when a new item fills a gap.
- **Shareable outfit links** — paste a URL and see the full decompose breakdown with scores. This also brings organic growth and social proof.

## Multi-rail payments

Offer several rails so supporters can pay with as little friction as possible:

- Ko-fi
- Patreon
- **Google Pay for web** — a JavaScript button, no app wrapper. This still needs a payment processor or gateway such as Stripe behind it.

**Not a fit today**

- [Google Play in-app purchases](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing) only work through a Trusted Web Activity Android wrapper, not on a plain Vercel site.
- YouTube Super Thanks and channel memberships are video-only and need the YouTube Partner Program, so they don't apply.

## Cross-promo with Nikki Calc

[Nikki Calc](https://nikkicalc.com) is the upstream data source and has no paid program of its own. Aim for mutual links and credit, not a revenue share.

## What not to do

- **No banner ads.** Players are already squeezed by gacha monetization, and premium ad networks don't pay until high traffic. [Raptive requires 25k monthly pageviews](https://help.raptive.com/hc/en-us/articles/360032840891-Who-is-eligible-for-Raptive). [Mediavine Official requires $5k+/yr in existing ad revenue](https://help.mediavine.com/what-does-it-take-to-get-approved-by-mediavine).
- **No paywalling the catalog.** The [Paper Games terms](https://nikki4.playpapergames.com/terms.html) prohibit commercial use of the service, so tips and paid convenience features are the safer path. This is not legal advice.
- **No Discord paid server subscriptions.** [Creator subscriptions are US-only](https://creator-support.discord.com/hc/en-us/articles/10424143128343-Creator-Revenue-FAQ), so they won't work from Canada. Give roles out by hand to Ko-fi or Patreon supporters instead.

## Scraping defenses

The catalog is public by design as a fan guide. Protect the pipeline, not the data itself: scraper logic, Nikki Calc source URLs, and Paige's private Overrides sheet in Drive.

Options to consider if hotlinking or scraping of the *pipeline* becomes a problem:

- Authenticated API calls instead of the public jsDelivr bundle
- Cloudflare bot detection
- Rate limiting
- Signed or rotating data URLs

## Housekeeping

Cloud sync and public collections are currently free for signed-in users. Mark the freemium gate as **planned** until it ships.
