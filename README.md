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
