# 🚨 Thief Alert: AI Neighborhood Security (Rs 0 stack)

Turn any old phone into a smart security camera. Detects people at night, scares them off with a siren, and alerts you and your neighbors instantly.

**Live demo:** https://thief-alerts.pages.dev
**Founder:** Ali Hassan

## Features
- 👁️ On-device AI person detection (TensorFlow.js COCO-SSD)
- 🔊 Deterrent: siren, strobe, voice warning, torch flash
- 📸 Auto photo capture + Gemini AI false-alarm filter
- 📍 Geofenced alerts to neighbors (PostGIS radius search)
- 🔔 Web Push notifications (VAPID), works when app is closed
- 👤 Family face whitelist (on-device only)
- 👥 Neighbor voting, alert gallery, heatmap
- 🔗 Webhook for any CCTV / IP camera
- 📱 PWA + Android APK

## Architecture
Browser (Next.js PWA) → Supabase Edge Function (Deno) → Postgres/PostGIS + Storage → Web Push → Phones

## Tech
Next.js · TypeScript · Tailwind · Supabase (Auth, Postgres, PostGIS, Storage, Edge Functions) · Web Push · TensorFlow.js · face-api · Gemini API · Cloudflare Pages

## Run locally
```bash
cd web
npm install
cp .env.example .env.local   # add your own keys
npm run dev
```

## Limitations (honest notes)
- Web push cannot override phone silent mode (native app needed).
- Camera device must stay on, charged, with screen awake.

## Author
Ali Hassan, Full-Stack Developer
