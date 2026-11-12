# Deploy Daily Spark on Vercel

This repository supports Vercel's Node.js Functions and a persistent **Turso libSQL** database. Vercel serves the static frontend; three same-origin API routes call the shared scoring handler. Points survive function restarts and redeployments because they live in Turso, not a Vercel filesystem.

## 1. Create the database

Create a **libSQL database** in your Turso account. This adapter uses `@libsql/client`; select the libSQL engine rather than a database using the newer Turso engine. The database URL should start with `libsql://` (or its HTTPS equivalent). Do not use a local `file:` URL, an embedded replica, or a `turso://` URL.

With the Turso CLI, sign in and create a libSQL database using the [db create instructions](https://docs.turso.tech/cli/db/create):

```sh
turso auth login
turso db create daily-spark
turso db show daily-spark --url
turso db tokens create daily-spark
```

Copy the database URL and a read/write database token. Keep the token private. The token is needed for both reward inserts and reading progress. For engine and SDK details, see [Turso's libSQL quickstart](https://docs.turso.tech/sdk/ts/quickstart#remote-libsql-database-libsqlclient).

## 2. Apply the schema once

Use Node.js 24.15 or a later 24.x version. Clone the repository and install the pinned dependencies:

```sh
git clone https://github.com/Nithyananda2003/build-task-assigment.git
cd build-task-assigment
npm ci
```

Copy `.env.example` to `.env.local`. Set these two variables in that local file:

```dotenv
TURSO_DATABASE_URL=libsql://your-database-your-organization.turso.io
TURSO_AUTH_TOKEN=your-private-database-token
```

Then run:

```sh
npm run db:migrate
```

The command reads `.env.local`, applies the checked-in schema in a transaction, and records the migration checksum. Running it again is safe: an unchanged applied migration is skipped. A changed applied migration stops with an error. Schema changes are never applied by an HTTP request or the Vercel build.

The migration expects a new database or one previously migrated with this command. It will not overwrite an unrelated existing table. Add future changes as new SQL files and journal entries; do not edit an applied migration. Use a separate Turso database for Preview deployments if you want to keep preview activity apart from Production.

## 3. Import the GitHub repository into Vercel

1. Open [Vercel New Project](https://vercel.com/new) and sign in with GitHub.
2. Import `Nithyananda2003/build-task-assigment` from its `main` branch.
3. Use the repository root (`./`) as the Root Directory.
4. Choose **Other** as the Framework Preset. The committed `vercel.json` supplies the rest:
   - Install Command: `npm ci`
   - Build Command: `npm run build:vercel`
   - Output Directory: `dist/vercel`
   - Node.js: `24.x` (also pinned in `package.json`)
5. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` under Environment Variables. Enable them for **Production** and, if deploying previews, **Preview**. Set separate values for a preview database if using one.
6. Click **Deploy**.

Do not prefix either variable with `NEXT_PUBLIC_` or put it in the browser code. Vercel Functions read the server environment. If variables change after a deployment, redeploy that environment. Vercel builds fail early with the missing variable names if configuration is incomplete; they do not print the token.

Vercel automatically builds functions from `api/state.js`, `api/complete.js`, and `api/health.js`. The static output contains only files from `public/`. No catch-all rewrite forwards API calls into the HTML shell. Security headers and asset revalidation are configured in `vercel.json`; API responses are not cached.

## 4. Check the deployment

Open the generated Vercel URL. A new domain has a new browser cookie, so it starts a new profile. The existing Cloudflare deployment and its D1 records are separate; this change does not migrate those records or transfer cookies.

- `/api/health` should return `{"ok":true}`. This checks liveness, not database readiness.
- `/api/state` should return JSON with today's three words and the browser's points. This checks database access and the migrated schema.
- Complete one challenge, open Rewards, then refresh. The first result should persist. Repeated submissions must not add another reward.

The optional `node scripts/smoke.mjs https://your-site.vercel.app` command **writes one anonymous demo completion** and checks repeated submissions. Run it only against an instance where you intend to create that test data.

If progress cannot load, check Vercel Function logs and confirm the database was migrated, the database uses libSQL, the token permits reads/writes, and the variables are set for the current environment. Do not switch to local SQLite or store a balance in browser storage as a workaround.

## Local verification

```sh
npm test
npm run build:vercel
```

Tests run the Vercel handler against the actual libSQL SDK with local database files, including persistence across new client instances, atomic duplicate protection, browser isolation, origin validation, missing configuration, migration replay and migration checksum checks. These tests do not require a Turso account. They establish local SDK/SQL behavior, not a deployed Vercel or remote Turso connection.

`npm run dev` still uses the local Node/SQLite preview at `http://127.0.0.1:4173`. `npm run build` still builds the standalone Cloudflare Worker. Neither command writes to Turso. `npm run db:migrate` is the explicit remote schema operation.

References: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json), [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/quickstart).
