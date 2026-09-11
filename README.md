# Gribudzert

Interactive map application using Leaflet and OpenStreetMap to display points of interest.

## ✨ Features

- 🚰 **Water Sources**: Find drinking water taps, springs, wells, and water points
- 🚻 **Public Toilets**: Discover public and accessible toilets with detailed information
- ♿ **Accessibility Info**: View wheelchair access, changing tables, and fee status
- 📍 **Location-Based**: Automatic location detection with nearest point highlighting
- 🗺️ **Interactive Map**: Pan and zoom to explore different areas
- 🗺️ **Directions**: Walking directions to any point in your maps app (Apple Maps on iPhone, or any installed maps app on Android)
- 🧭 **Compass Guidance**: Tap any point and the compass HUD and beeline guide you to it, with distance and bearing, offline

## 🛰️ Offline

A service worker caches the map tiles you've actually viewed and the built app shell, so the
map keeps working when the network drops and reopens instantly on a repeat visit. There is no
"download this area for offline" feature — the OpenStreetMap tile usage policy forbids
prefetching tiles that were never requested by the map itself.

Production builds are two steps: `yarn build` runs `vite build` (the app) followed by
`vite build --config vite.sw.config.ts` (the worker, built from the first build's asset
manifest so it knows exactly what to precache).

## 🚀 Development

```bash
# Install and run
yarn install && yarn dev

# Build for production
yarn build
```

### Environment variables

| Variable | Default (committed in `.env`) | Purpose |
| --- | --- | --- |
| `VITE_UMAMI_WEBSITE_ID` | `9aad9379-...` | Umami website id. The analytics `<script>` is only emitted in production builds (`vite build`); dev and non-production builds strip it, so local traffic never reaches analytics. Override in `.env.local` (git-ignored). |

## 🐳 Docker

```bash
# Test locally
docker-compose up --build
# Visit http://localhost:3000
```

## ☁️ Coolify Deployment

1. Push the repository to Git.
2. **In Coolify**: New Resource → Public Repository → paste your repo URL → Continue → Deploy.

That's it! Coolify auto-detects the Dockerfile, port (80), and health check.

### Features
✅ Nginx with gzip & caching ✅ Security headers ✅ SPA routing ✅ Health checks

## 🧪 Scripts

```bash
yarn dev          # Development server
yarn build        # Production build (type-check first: yarn typecheck && yarn build)
yarn preview      # Preview build
yarn typecheck    # TypeScript type-check (tsc --noEmit)
yarn test         # Run tests (yarn test --run for a single pass)
yarn lint         # Lint (biome)
yarn lint:fix     # Fix linting
yarn format       # Format code
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on every push and pull request.

## 📋 Requirements

Node.js >= 24

## 🌐 Resources

- [Overpass Turbo](https://overpass-turbo.eu/index.html)
- [Coolify Docs](https://coolify.io/docs)

## 📄 License

MIT
