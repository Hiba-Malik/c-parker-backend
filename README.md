# C-Parker Backend

REST API and blockchain event indexer for the C-Parker Orbit Matrix platform.

Built with NestJS, PostgreSQL, and Ethers.js. Listens to Orbit A/B smart contracts on Polygon Amoy, persists on-chain activity, and exposes a versioned HTTP API for dashboards and client apps.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)

## Related repositories

| Repository | Link |
|------------|------|
| Frontend (React) | [github.com/Hiba-Malik/c-parker](https://github.com/Hiba-Malik/c-parker) |
| Smart contracts (Solidity) | Private — not publicly available |

## Features

- **Blockchain indexing** — real-time listeners for registration, payments, level upgrades, and cycle events
- **REST API** — users, payments, statistics, activity feed, announcements, and level cycles
- **PostgreSQL schema** — normalized tables, views, and helper functions (no redundant denormalized copies)
- **Caching** — in-memory cache by default; optional Redis
- **OpenAPI docs** — interactive Swagger UI at `/docs`
- **Production-ready** — deployable to Render, Railway, or any Node host with a managed Postgres instance (e.g. Supabase)

## Requirements

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| PostgreSQL | 14+ |
| npm | 9+ |

Optional: Redis for distributed caching.

## Quick start

```bash
git clone https://github.com/Hiba-Malik/c-parker-backend.git
cd c-parker-backend
npm install
cp env.example .env
# Edit .env with your database and RPC settings
npm run db:setup
npm run start:dev
```

The API listens on `http://localhost:4000`. Swagger docs: `http://localhost:4000/docs`.

## Configuration

Copy `env.example` to `.env` and configure the following:

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `4000`) |
| `API_PREFIX` | Route prefix (default `api/v1`) |
| `DB_*` | PostgreSQL connection settings |
| `DB_SSL` | Set `true` for Supabase and other managed Postgres hosts |
| `RPC_URL` | Polygon RPC endpoint (Alchemy or Infura recommended) |
| `ORBIT_A_ADDRESS` / `ORBIT_B_ADDRESS` | Deployed contract addresses |
| `ENABLE_EVENT_LISTENER` | `true` to index chain events; `false` for API-only mode |
| `START_BLOCK` | Block number or `latest` |
| `LOG_LEVEL` | Winston log level |

See `env.example` for the full list.

## Database

### Fresh install (local)

```bash
npm run db:setup
```

This creates the database (if needed) and applies `db/schema.sql`.

### Reset (destroys all data)

```bash
npm run db:reset
```

### Seed data

```bash
# Admin user (User ID 1) from on-chain contract state
npm run seed:admin

# Test users from ../users/user*.json (Hardhat wallet files in the contracts repo)
npm run seed:users
```

### Migrations

Incremental SQL migrations live in `db/migrations/`. Apply the admin levels migration with:

```bash
npm run migration:admin-levels
```

### Supabase / remote restore

1. Run `db/schema.sql` in the Supabase SQL editor.
2. Optionally import a local dump:

```bash
export SUPABASE_HOST=aws-0-....pooler.supabase.com
export SUPABASE_USER=postgres.<project-ref>
export SUPABASE_PASSWORD=...
./db/scripts/restore-to-supabase.sh db/dumps/cparker-data.sql
```

## Running

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Development with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled app |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |

## API

**Base URL:** `http://localhost:4000/api/v1`

All user-facing routes use the on-chain `userId`, not the internal database primary key.

| Resource | Examples |
|----------|----------|
| Users | `GET /users/:userId`, `GET /users/:userId/stats`, `GET /users/wallet/:address` |
| Payments | `GET /payments/user/:userId`, `GET /payments/user/:userId/earned` |
| Statistics | `GET /statistics/platform`, `GET /statistics/leaderboard` |
| Activity | `GET /activity/feed?limit=50` |

```bash
curl http://localhost:4000/api/v1/users/2
curl http://localhost:4000/api/v1/statistics/platform
```

Full endpoint list: [Swagger UI](http://localhost:4000/docs) when the server is running.

## Deployment

Example: [Render](https://render.com) + [Supabase](https://supabase.com) PostgreSQL.

**Build command**

```bash
mkdir -p logs && npm install && npm run build
```

**Start command**

```bash
npm run start:prod
```

**Environment**

- Use the Supabase **session pooler** host for IPv4 compatibility.
- Set `DB_SSL=true`.
- Use a reliable `RPC_URL` (Alchemy/Infura). Public RPC endpoints may fail with `ENOTFOUND` on some hosts.
- Set `ENABLE_EVENT_LISTENER=false` if you only need the REST API (no live indexing).

**Frontend integration:** point your client at `https://your-api-host/api/v1` (include the prefix).

## Project structure

```
c-parker-backend/
├── db/
│   ├── schema.sql           # Full PostgreSQL schema
│   ├── migrations/          # Incremental SQL migrations
│   ├── seeds/               # Seed scripts (TypeScript + SQL)
│   ├── scripts/             # setup, reset, restore helpers
│   └── dumps/               # Local data dumps (gitignored)
├── docs/                    # Additional documentation
├── src/
│   ├── modules/             # NestJS feature modules
│   ├── common/              # Shared utilities
│   └── main.ts
├── env.example
└── package.json
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `404` on `/users/1` | Use the API prefix: `/api/v1/users/1` |
| `ENOTFOUND` for RPC | Replace `RPC_URL` with Alchemy or Infura |
| Schema errors on re-run | Drop existing types/tables first, or use `npm run db:reset` locally |
| Event listener idle on Render free tier | Expected when the service sleeps; listener resumes on wake |

## License

MIT
