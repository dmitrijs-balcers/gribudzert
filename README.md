# Gribudzert

Interactive map application using Leaflet and OpenStreetMap to display points of interest in Riga.

## 🚀 Development

```bash
# Install and run
yarn install && yarn dev

# Build for production
yarn build
```

## 🐳 Docker

```bash
# Test locally
docker-compose up --build
# Visit http://localhost:3000
```

## ☁️ Coolify Deployment

1. **Push to Git**:
   ```bash
   git add . && git commit -m "Add Coolify config" && git push
   ```

2. **In Coolify**:
   - New Resource → Public Repository
   - Paste your repo URL → Continue → Deploy

That's it! Coolify auto-detects the Dockerfile, port (80), and health check.

### Features
✅ Nginx with gzip & caching ✅ Security headers ✅ SPA routing ✅ Health checks

## 🧪 Scripts

```bash
yarn dev          # Development server
yarn build        # Production build
yarn preview      # Preview build
yarn test         # Run tests
yarn lint:fix     # Fix linting
yarn format       # Format code
```

## 📋 Requirements

Node.js >= 24

## 🌐 Resources

- [Overpass Turbo](https://overpass-turbo.eu/index.html)
- [Coolify Docs](https://coolify.io/docs)

## 📄 License

MIT
