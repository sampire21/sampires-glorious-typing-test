# Cloudflare Pages Setup

This project now uses Cloudflare Pages Functions for auth, score storage, and leaderboard APIs.

## Required bindings

1. Create a KV namespace (for example: `typing_app_prod`).
2. In Cloudflare Pages project settings, add KV binding:
   - Variable name: `TYPING_APP`
   - Namespace: your KV namespace
3. Add an environment variable:
   - `TOKEN_SECRET` = a long random secret (32+ chars)

## API routes implemented

- `POST /api/signup`
- `POST /api/login`
- `GET /api/me`
- `POST /api/scores`
- `GET /api/scores/me`
- `GET /api/leaderboard`

## Leaderboard payload

`GET /api/leaderboard` returns rows with:
- `username`
- `mode` (test type)
- `wpm`
- `accuracy`
- `date`

## Notes

- Local Node server (`server.js`) is still available for non-Cloudflare local dev.
- Cloudflare Pages deploys `index.html` + `functions/api/*`.
