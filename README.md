# TechAnimeHub

A lightweight Node.js + Express web app that aggregates **Tech**, **Anime**, and **Movies** news and includes a **YouTube-style Anime Videos** page with a playlist that **remembers the last played video** (no autoplay).

## Features
- 📰 **Tech News** as the homepage
- 🌸 **Anime News** and 🎬 **Movies News**
- 🔍 **Global search** across all categories
- 🖼️ **Online thumbnail fetching** from article pages (Open Graph/Twitter) with **cached results**
- 🖼️ Category **placeholder images** when no thumbnail exists
- 🧱 **Skeleton loaders** and **lazy-loaded images**
- 📌 **Sticky responsive navbar** (mobile drawer + desktop top bar)
- 🌗 **Dark/Light theme toggle** (persists in localStorage)
- 🎥 **Anime Videos** page with playlist (YouTube-style layout)
- 🧠 **Remembers last played video** (no autoplay, stored in localStorage)
- ⏱️ **Scheduled background refresh** every 30 minutes


## Run locally
```bash
npm install
npm run dev
# open http://localhost:5000
```

## Customize the playlist
Edit `data/playlist.json`:
```json
[ { "id": "MGRm4IzK1SQ", "title": "Attack on Titan Trailer" } ]
```

## Endpoints
- `GET /api/news/:category` → `tech | anime | movies`
- `GET /api/search?q=keyword`
- `GET /api/playlist`
- `POST /api/refresh`
