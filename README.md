# Berean

A Bible study chat app that answers **only** from retrieved verses of the World English Bible, and checks every citation and quotation against the database before showing it as verified.

> Work in progress. The full README (anti-hallucination design, architecture, "How I built this with AI") arrives in the final phase.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000, and check http://localhost:3000/api/health to confirm Supabase is connected.

## Load the Bible text (one time)

1. In the Supabase dashboard, open **SQL Editor**, paste the contents of `supabase/migrations/20261014000001_bible_text.sql`, and click **Run**.
2. Import the World English Bible (downloaded from [eBible.org](https://ebible.org/find/details.php?id=engwebp), public domain):

```bash
npm run import:bible -- --dry-run   # download + check only
npm run import:bible                # upload ~31,100 verses
```

Then read any chapter at http://localhost:3000/read.
