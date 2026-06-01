# LeadScraper Pro

A modern, production-ready lead scraping web application inspired by the Apollo.io aesthetic. Find local business leads with an intelligent Waterfall Enrichment engine that automatically discovers emails, phone numbers, and social profiles.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tech Stack](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss)
![Tech Stack](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Tech Stack](https://img.shields.io/badge/WebSocket-Streaming-010101?logo=socket.io)

---

## 🏗 Architecture (Production — 5 Containers)

```
INTERNET
   │
   ▼
┌──────────────────────────────────────────────────┐
│  lead-scraper-nginx   (ports 80 → 443 redirect)  │
│  routes / → frontend:3000                        │
│  routes /api/ → backend:4000                     │
│  routes /ws → backend:4001                       │
└────────┬─────────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────────────────────────────────┐
│ frontend│ │ backend (port 4000 REST, 4001 WS)     │
│ :3000   │ │ Node.js app                           │
│ Next.js │ │ env:                                  │
└─────────┘ │  CHROME_CDP_URL=ws://browserless:3000  │
            │  FLARESOLVER_URL=http://flaresolverr:   │
            │    8191/v1                              │
            └────┬───────────────────────────────────┘
                 │
            ┌────┴────┐
            ▼         ▼
     ┌──────────┐ ┌──────────┐
     │browserless│ │flaresolverr│
     │:3000     │ │:8191      │
     │headless  │ │cloudflare │
     │chrome    │ │bypass     │
     └──────────┘ └──────────┘
```

---

## 🚀 Quick Start (Production on Any Machine)

### Prerequisites
- Docker + Docker Compose
- Git
- A domain pointing to your server (or use sslip.io for dev)
- Ports 80 and 443 open

### 1. Clone

```bash
git clone https://github.com/Steve-reyes/lead-scraper-scorpio.git
cd lead-scraper-scorpio
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend HTTP API port |
| `WS_PORT` | `4001` | WebSocket server port |
| `NODE_ENV` | `production` | Environment mode |
| `CHROME_CDP_URL` | `ws://browserless:3000` | Headless Chrome connection |
| `FLARESOLVER_URL` | `http://flaresolverr:8191/v1` | Cloudflare bypass endpoint |

### 3. Deploy

```bash
docker compose up -d --build
```

All 5 containers start. The app is live on port 80.

### 4. Set Up SSL

```bash
# Stop nginx temporarily to free port 80
docker stop lead-scraper-nginx

# Get certificate
certbot certonly --standalone -d your-domain.com

# Restart nginx
docker compose up -d --force-recreate nginx
```

The nginx config is at `nginx.conf` — it proxies traffic to frontend/backend with SSL termination.

---

## 🔧 Development

### Prerequisites
- Node.js 18+ (recommended: Node 20+)
- npm 9+

### Install & Run

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install root dev dependency (concurrently)
npm install

# Start both servers
npm run dev
```

- Backend: port 3001 (REST), 3002 (WebSocket)
- Frontend: port 3000
- Open http://localhost:3000

---

## ✨ Features

### Core Lead Finding
- **Keyword + Location Search** — Find local businesses by keyword and city
- **Country Selector** — Target specific countries for localized results
- **Real-Time Streaming** — Leads appear in the table as they're found

### Waterfall Enrichment Engine
1. **Primary Source (Google Maps)** — Extracts name, address, rating, phone, website
2. **Website Scrape Fallback** — Scrapes homepage, `/contact`, `/about`
3. **Directory Fallback** — Yelp, YellowPages, Yell (UK)

### UI/UX
- Deep navy sidebar with navigation
- Real-time metrics ribbon (Total, Enriched, Phones, Fallbacks)
- Data table with selection, copy, source badges, enrichment status
- Sticky export footer (CSV / Save to Lists)
- Streaming progress with live row updates

---

## 🔌 API Endpoints

### REST API (port 4000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/search` | Search leads |
| POST | `/api/enrich` | Enrich a single lead |
| POST | `/api/batch-enrich` | Enrich multiple leads |

### WebSocket (port 4001)

```json
{
  "type": "search",
  "payload": {
    "keyword": "Dentist",
    "location": "Austin, TX",
    "country": "United States",
    "maxResults": 30
  }
}
```

Event types: `lead_found`, `lead_enriched`, `progress`, `complete`, `error`

---

## 📁 Project Structure

```
lead-scraper-app/
├── backend/                    # Node.js/TypeScript API Server
│   └── src/
│       ├── index.ts            # Express + WebSocket server entry
│       ├── routes/             # REST API routes
│       ├── services/           # googleMaps, scraper, directoryFallback
│       └── workers/            # Waterfall enrichment orchestration
├── frontend/                   # Next.js 14 App Router
│   └── src/
│       ├── app/                # Pages and layout
│       └── components/         # Sidebar, TopBar, LeadsTable, etc.
├── nginx.conf                  # Prod reverse proxy config
├── docker-compose.yml          # 5-container production setup
├── Dockerfile.frontend
└── Dockerfile.backend
```

---

## 📄 License

MIT
