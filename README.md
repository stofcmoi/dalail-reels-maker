# Dalail Reels Maker (Static + Vercel API)

## Deploy on Vercel (phone-friendly)
- Upload these files to a GitHub repository.
- In Vercel: New Project → Import the repo → Deploy.

## Audio links (later)
Edit `readers` in `app.js` (or replace with your own JSON):
- One MP3 per part (8 parts) per reader.

## Timings JSON
Use the Admin section in the app:
- Paste MP3 URL
- Play & mark Start/End for each sentence
- Download `timings_partX.json`
Place it under `/timings/` to auto-load, or keep it in browser localStorage.
