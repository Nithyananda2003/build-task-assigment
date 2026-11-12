Ref: KL-7Q4

# Daily Spark

Three useful English words. Two minutes for yourself. A little better, every day.

Daily Spark is a responsive daily vocabulary challenge built for modest phones, mobile data, and people learning English. Answer three short questions, receive explanations, earn 10–25 points, and build a daily streak. Points have no cash value.

Live app: https://daily-spark-nithyananda.orders741265.chatgpt.site

Read [EXPLAINER.txt](EXPLAINER.txt) for the product choices, implementation tradeoffs, and deliberately omitted features. [api.openapi.json](api.openapi.json) documents the API. Repository: https://github.com/Nithyananda2003/build-task-assigment . The source and an offline Git bundle are included with the delivery.

## Run locally

Requires Node.js 24.15 or later (uses built-in `node:sqlite`) and Git. No npm packages, API keys, sign-up, or cloud services are needed locally.

Clone the repository:

```sh
git clone https://github.com/Nithyananda2003/build-task-assigment.git daily-spark
cd daily-spark
npm run dev
```

If you downloaded a source ZIP, extract it, open a terminal in the folder containing `package.json`, and run `npm run dev`.

Open http://127.0.0.1:4173 in your browser. `npm run dev` builds the Worker and serves it through a small Node HTTP adapter. Restart the command after changing source files. `PORT` can override the default port.

SQLite data is saved to `.data/spark.sqlite`, which is ignored by Git. The first launch applies the migration automatically. Restarting the server preserves progress. Clearing browser cookies starts a new browser profile. The Node SQLite experimental warning, if emitted, does not prevent the app from running.

```sh
npm test
npm run build
```

Tests use real SQLite with the same schema and SQL statements as production. They do not require a running server or an internet connection. Building produces a single ES module at `dist/server/index.js`.

## Daily loop and rewards

- Everyone receives the same three words on a given day; the day resets at midnight Asia/Kolkata (IST).
- Finishing earns 10 points, plus 5 per correct answer. Maximum: 25 points per day.
- The first completed attempt is final. Reviewing, refreshing, or submitting again adds no points.
- A level is earned every 100 points. Level 1 starts at zero points.
- Consecutive completed dates grow the streak. Yesterday's streak stays active during today. Missing an entire day resets it.
- Four badges recognise the first completion, a perfect score, a three-day streak, and a seven-day streak. Earned badges remain after a streak breaks.
- The 33-word bank rotates deterministically on a 33-day cycle. Correct answer positions rotate too.

There are no seeded users, invented points, fake transactions, or simulated leaderboard positions.

## Structure

```text
public/                 HTML, CSS, browser JS, SVG icon, manifest, service worker
worker/domain.js        Daily selection, answer keys, scoring, streaks and badges
worker/index.js         Cloudflare Worker HTTP handler and D1 reward persistence
scripts/build.mjs       Embeds local assets into a dependency-free Worker
scripts/dev.mjs         Local HTTP bridge to the exact built Worker
scripts/database.mjs    SQLite adapter for local development and tests
scripts/validate-artifact.mjs  Validates the generated ESM deployment
scripts/quality.mjs     Build, asset-budget and submission-artifact checks
drizzle/                Versioned SQL migration and migration journal
tests/                  Domain and API integration tests
api.openapi.json        API contract
.openai/hosting.json     Site identity and D1 binding
EXPLAINER.txt            Submission explainer
```

## Server authority and data integrity

The client submits the day and three answer indices. It never decides the score, balance, streak, reward amount, or current day. Answer keys remain in the Worker; explanations are returned only after this browser completes the challenge.

A random 256-bit token identifies the browser through an HttpOnly, SameSite=Strict cookie (also Secure over HTTPS). Only its SHA-256 hash is stored with completions. No email address or name is collected. API responses use `Cache-Control: no-store`. Writes require a same-origin Origin header and a JSON body with bounded length and answer values.

A composite primary key `(user_id, day)` makes reward insertion atomic. `INSERT ... ON CONFLICT DO NOTHING` means concurrent attempts and retries after an uncertain response cannot award twice. The first completion remains authoritative. Balances and levels are derived from the saved ledger instead of separately mutating a balance. Database checks constrain scores and enforce `points = 10 + correct * 5`.

This is reliable reward accounting for a demo, not an anti-fraud system. A new anonymous cookie can create another profile; users can consult external dictionaries or the public repository. It is not suitable for monetary payouts.

## Small phones, data and accessibility

No framework, third-party fonts, images, trackers, or CDN requests. All assets are local and the compressed initial asset budget is checked by `node scripts/quality.mjs`. The app uses a 320-pixel mobile layout, large radio rows, native keyboard controls, visible focus indicators, a skip link, labelled progress bars and reduced-motion support. Main body and question text have readable contrast; decorative muted labels are secondary.

The service worker caches the app shell after the first successful visit. It never caches API data. Reading progress and confirming a reward require an internet connection. Answer drafts live in sessionStorage so leaving and reopening a challenge in the same tab can resume it. Failed submissions retain answers and offer retry; a success is shown only after the server confirms it. Progress reads retry temporary network or hosting failures twice within a 15-second total timeout. Non-JSON and malformed responses show a readable message instead of a parsing exception. Answer submissions are never automatically retried. Asset revalidation avoids an hour-long stale bundle after deployment.

## Production hosting

The app is a portable Cloudflare Worker ESM with one D1 binding named `DB`. Sites provisions D1 and applies the checked-in SQL migration during publication. The tracked `.openai/hosting.json` contains the Site project ID and `d1: "DB"`; no secrets are committed. The source repository is saved before a deployment artifact is published.

To host independently, build with `npm run build`, configure your Worker entrypoint as `dist/server/index.js`, bind a D1 database as `DB`, apply `drizzle/0000_daily_spark.sql` to that database once, and deploy the Worker with your chosen Cloudflare tooling. Do not run the local Node server as a Worker. HTTP adapters preserve the same fetch handler; production has no Node or SQLite runtime dependency.

A new Sites deployment is private until sharing is changed. Check that external reviewers can open the live URL before submitting. The Sites backing repository requires owner authentication. The submission source is also published to the GitHub repository linked above. The supplied Git bundle can be cloned without a hosting account using `git clone daily-spark.bundle daily-spark`.

## Validation and limits

26 automated domain, API and browser-client tests cover scores, invalid input, server-owned dates, year/leap-day transitions, streak gaps, retained badges, level boundaries, distinct browser profiles, SQL persistence, concurrent replay, origin validation, payload limits, missing database errors, retry after a committed result loses its response, non-JSON hosting errors, malformed responses, bounded read retries, and safe submission failures.

Local browser QA exercises the phone-sized challenge and reward history. Browser QA evidence and any production verification notes are included in the delivery report. Tests establish local SQLite behavior; the production smoke check establishes deployed D1 behavior separately.

Intentionally omitted: accounts/recovery, cross-device sync, cash payouts, rate limiting, notifications, localisation, a larger curated word bank, and a CMS. Production money handling needs verified identity, abuse controls, a financial ledger and reconciliation before integration with a payment provider. No such capability is implied by demo points.


