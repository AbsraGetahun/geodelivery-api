\# GeoDelivery API



A production-ready \*\*Node.js + TypeScript\*\* backend for a food-delivery / logistics platform, powered by \*\*PostgreSQL + PostGIS\*\* for real-time geospatial queries and \*\*Redis\*\* for high-performance caching.



> Find nearby restaurants. Find nearby available drivers. Calculate ETAs. All using real spatial math on the Earth's surface.



\---



\## Why This Project Exists



Food-delivery and logistics platforms are fundamentally \*\*spatial\*\*. The hard problems are:

\- "Which restaurants are within 5 km of this customer?"

\- "Which available driver is closest to this pickup point?"

\- "How long until the driver reaches the customer?"



Naïve solutions load every row into memory and compute distances in JavaScript. That doesn't scale.



This project solves those problems the way real systems do: \*\*in the database, with the right indexes, with a caching layer for the hot queries\*\*.



\---



\## Tech Stack



| Layer | Technology | Purpose |

|-------|-----------|---------|

| Runtime | Node.js 20+ | Non-blocking I/O for I/O-bound APIs |

| Language | TypeScript (strict) | Compile-time safety |

| Web | Express 5 | HTTP framework |

| ORM | Prisma 7 + `@prisma/adapter-pg` | Typed CRUD + migrations |

| Database | PostgreSQL 15 + PostGIS 3.3 | Spatial data + relational integrity |

| Cache | Redis 7 (ioredis) | Cache-aside for expensive spatial queries |

| Validation | Zod | Runtime request validation with type inference |

| Testing | Vitest + Supertest | Integration tests against real DB + Redis |

| Container | Docker Compose | Reproducible local environment |



\---



\## Architecture



```

&#x20;               ┌────────────────────────────────────────────┐

&#x20;               │              HTTP (Express 5)               │

&#x20;               │  routes → validateRequest (Zod) → controllers│

&#x20;               └──────────────────┬─────────────────────────┘

&#x20;                                  │

&#x20;               ┌──────────────────▼─────────────────────────┐

&#x20;               │                Services                     │

&#x20;               │  ┌────────────────┐  ┌─────────────────┐   │

&#x20;               │  │ restaurantSvc  │  │  orderService   │   │

&#x20;               │  │ driverService  │  │  geoService     │   │

&#x20;               │  └────────────────┘  └─────────────────┘   │

&#x20;               └──────┬───────────────────────────┬─────────┘

&#x20;                      │                           │

&#x20;               ┌──────▼─────────┐        ┌────────▼────────┐

&#x20;               │  Prisma Client │        │   Redis (ioredis)│

&#x20;               │  + $queryRaw   │        │   cache-aside    │

&#x20;               └──────┬─────────┘        └────────┬─────────┘

&#x20;                      │                           │

&#x20;               ┌──────▼───────────────────────────▼───────┐

&#x20;               │  PostgreSQL 15 + PostGIS 3.3 + Redis 7   │

&#x20;               │  (Docker Compose, named volumes)         │

&#x20;               └──────────────────────────────────────────┘

```



Layering rules:

\- \*\*Routes\*\* wire URLs and middleware. No business logic.

\- \*\*Controllers\*\* translate HTTP ↔ service calls. Validate via Zod. Return proper status codes.

\- \*\*Services\*\* hold business logic. Use Prisma for CRUD, raw SQL for PostGIS.

\- \*\*Redis\*\* is only touched from services, never from routes or controllers.



\---



\## Getting Started



\### Prerequisites



\- \*\*Node.js 20+\*\* and \*\*npm\*\*

\- \*\*Docker Desktop\*\* (running)



\### Installation



```bash

git clone https://github.com/absragetahun/geodelivery-api.git

cd geodelivery-api

npm install

```



\### Start the infrastructure



```bash

docker compose up -d

```



This starts two containers:

\- `geodelivery-postgres` (PostGIS 15-3.3) on host port \*\*5433\*\*

\- `geodelivery-redis` (Redis 7) on host port \*\*6380\*\*



> \*\*Why 5433 and 6380?\*\* To avoid clashing with any default Postgres/Redis already running on your machine. Internal container ports remain standard (5432, 6379).



\### Environment Variables



Copy `.env.example` to `.env`:



```bash

cp .env.example .env

```



(On Windows CMD: `copy .env.example .env`)



The defaults already match the Docker Compose setup, so no edits needed.



\### Run migrations



```bash

npx prisma migrate dev

```



\### Apply PostGIS columns + GiST indexes



Prisma cannot express the `GEOGRAPHY(Point, 4326)` type, so those columns are added by a raw SQL file:



```bash

\# Windows CMD

docker exec -i geodelivery-postgres psql -U user -d geodelivery < prisma/sql/postgis\_setup.sql



\# macOS / Linux

docker exec -i geodelivery-postgres psql -U user -d geodelivery < prisma/sql/postgis\_setup.sql

```



This creates the three `location`/`customer\_location` columns and their \*\*GiST indexes\*\*.



\### Seed the database



```bash

npx tsx prisma/seed.ts

```



Inserts 12 restaurants, 22 drivers, 40 orders — all with real coordinates around Addis Ababa.



\### Start the API



```bash

npm run dev

```



The server is now at `http://localhost:3000`.



```bash

curl http://localhost:3000/health

\# {"status":"ok","service":"geodelivery-api","redis":"ok","timestamp":"..."}

```



\---



\## API Endpoints



\### Restaurants



| Method | Path | Description |

|--------|------|-------------|

| POST | `/restaurants` | Create a restaurant |

| GET | `/restaurants` | List with pagination |

| GET | `/restaurants/:id` | Get by ID |

| GET | `/restaurants/nearby?lat=\&lng=\&radius=` | \*\*PostGIS: find within radius\*\* |

| PATCH | `/restaurants/:id` | Update |

| DELETE | `/restaurants/:id` | Delete |



\### Drivers



| Method | Path | Description |

|--------|------|-------------|

| POST | `/drivers` | Create a driver |

| GET | `/drivers` | List with pagination |

| GET | `/drivers/:id` | Get by ID |

| GET | `/drivers/nearby?lat=\&lng=\&radius=` | \*\*PostGIS: available drivers within radius\*\* |

| PATCH | `/drivers/:id` | Update |

| PATCH | `/drivers/:id/location` | \*\*Update current location\*\* |

| PATCH | `/drivers/:id/availability` | Toggle availability |

| DELETE | `/drivers/:id` | Delete |



\### Orders



| Method | Path | Description |

|--------|------|-------------|

| POST | `/orders` | Create (returns a suggested driver) |

| GET | `/orders?status=\&from=\&to=` | List with filters |

| GET | `/orders/:id` | Get with restaurant + driver info |

| GET | `/orders/:id/eta` | \*\*PostGIS: real-time ETA from driver\*\* |

| PATCH | `/orders/:id/status` | Update status |

| PATCH | `/orders/:id/assign` | Assign a driver |

| DELETE | `/orders/:id` | Cancel |



\### Example: Find nearby restaurants



```bash

curl "http://localhost:3000/restaurants/nearby?lat=9.0192\&lng=38.7525\&radius=2000"

```



```json

{

&#x20; "data": \[

&#x20;   { "id": "...", "name": "Sarbet Cafe",       "distance\_meters": 459.49 },

&#x20;   { "id": "...", "name": "Piassa Bistro",     "distance\_meters": 854.53 },

&#x20;   { "id": "...", "name": "Lebu Noodle Bar",   "distance\_meters": 861.90 }

&#x20; ],

&#x20; "count": 3

}

```



\### Example: Calculate ETA



```bash

curl http://localhost:3000/orders/{ORDER\_ID}/eta

```



```json

{

&#x20; "distance\_meters": 370.97,

&#x20; "eta\_seconds": 46,

&#x20; "eta\_minutes": 0.8,

&#x20; "driver\_lat": 9.0168,

&#x20; "driver\_lng": 38.7501,

&#x20; "customer\_lat": 9.0192,

&#x20; "customer\_lng": 38.7525

}

```



\---



\## PostGIS Queries



All spatial work happens in the database. Raw SQL is used because Prisma cannot express spatial operators.



\### `ST\_DWithin` — find what's nearby, using the GiST index



```sql

SELECT id, name, ST\_Distance(location, ST\_MakePoint($lng, $lat)::geography) AS meters

FROM restaurants

WHERE ST\_DWithin(location, ST\_SetSRID(ST\_MakePoint($lng, $lat), 4326)::geography, $radius\_meters)

ORDER BY meters ASC;

```



`ST\_DWithin` is \*\*index-aware\*\* — PostgreSQL uses the GiST index to prune rows that can't possibly be within range, then `ST\_Distance` computes exact meters for the survivors.



\### `ST\_Distance` — accurate great-circle distance in meters



```sql

ST\_Distance(driver.location, order.customer\_location) AS distance\_meters

```



Because our columns are `GEOGRAPHY(Point, 4326)`, `ST\_Distance` returns \*\*meters\*\* directly. If they were `GEOMETRY`, we'd need a projected SRID to get meaningful distances.



\### `ST\_MakePoint(lng, lat)` — build a point



\*\*Note the argument order: longitude first, latitude second.\*\* This is the #1 PostGIS gotcha. Getting it wrong puts your points in the wrong hemisphere.



\---



\## Redis Caching Strategy



Cache-aside pattern. Reads check Redis first, then fall back to the DB. Writes invalidate the affected keys.



| Endpoint | TTL | Reasoning |

|----------|-----|-----------|

| `GET /restaurants/:id` | 10 min | Restaurants change rarely |

| `GET /restaurants` (list) | 5 min | Moderate churn |

| `GET /restaurants/nearby` | 5 min | Restaurants rarely move; cache hit ratio is high |

| `GET /drivers/:id` | 1 min | Drivers move constantly |

| `GET /drivers/nearby` | 1 min | Short TTL — a stale list is worse than a slow one |

| `GET /orders/:id/eta` | \*\*not cached\*\* | Inherently real-time |

| `GET /nearest-available-driver` | \*\*not cached\*\* | Used for real-time assignment |



\### Invalidation rules



| Action | Invalidates |

|--------|------------|

| `POST /restaurants` | `restaurants:\*`, `restaurants:nearby:\*` |

| `PATCH /restaurants/:id` | `restaurant:<id>`, `restaurants:\*`, `restaurants:nearby:\*` |

| `DELETE /restaurants/:id` | same as PATCH |

| `POST /drivers` | `driver:\*`, `drivers:nearby:\*` |

| `PATCH /drivers/:id/location` | `driver:<id>`, `driver:\*`, `drivers:nearby:\*` |

| `PATCH /drivers/:id/availability` | same as location update |

| `PATCH /orders/:id/assign` | `driver:<assigned>`, `drivers:nearby:\*` |



Invalidation uses \*\*SCAN\*\*, never \*\*KEYS\*\* — `KEYS` blocks Redis on large keyspaces and is banned in production.



\### Cache hit logging



Every cache operation logs to stdout so you can watch the pattern live:



```

\[cache] MISS restaurants:nearby:9.0192:38.7525:2000

\[cache] SET restaurants:nearby:9.0192:38.7525:2000 (TTL 300s)

\[req] GET /restaurants/nearby?lat=9.0192\&lng=38.7525\&radius=2000 139ms



\[cache] HIT restaurants:nearby:9.0192:38.7525:2000

\[req] GET /restaurants/nearby?lat=9.0192\&lng=38.7525\&radius=2000 2ms

```



\*\*139 ms → 2 ms. A \~70× speedup from a single `SETEX`.\*\*



> \*\*Fail-open:\*\* if Redis is unavailable, every cache helper returns `null` and the request falls through to the DB. The API never crashes because of Redis.



\### Cache stampede mitigation



Spatial query coordinates are rounded to \*\*4 decimal places\*\* (\~11 m precision) for cache keys. Two requests for `lat=9.0192, lng=38.7525` and `lat=9.01921, lng=38.75249` hit the same cache entry, dramatically improving hit ratio. \*\*The unrounded coordinates are still passed to the SQL query\*\* for accuracy.



\---



\## SQL Optimization



\### Indexes



| Index | Column | Type | Purpose |

|-------|--------|------|---------|

| `restaurants\_location\_gist\_idx` | `restaurants.location` | \*\*GiST\*\* | Powers `ST\_DWithin` |

| `drivers\_location\_gist\_idx` | `drivers.location` | \*\*GiST\*\* | Powers nearby-driver lookups |

| `orders\_customer\_location\_gist\_idx` | `orders.customer\_location` | \*\*GiST\*\* | Powers ETA joins |

| `orders\_status\_idx` | `orders.status` | B-tree | "Find all pending orders" |

| `orders\_created\_at\_idx` | `orders.created\_at` | B-tree | Date-range filters |

| `orders\_restaurant\_id\_status\_idx` | `orders(restaurant\_id, status)` | B-tree (composite) | "Pending orders for restaurant X" |



\### Why GiST for spatial columns?



A B-tree can't order 2-dimensional points in a way that lets Postgres skip regions. \*\*GiST\*\* (Generalized Search Tree) indexes bounding boxes and lets the planner do "does this rectangle intersect?" checks before computing exact distances. `ST\_DWithin` is designed to use this.



\### EXPLAIN ANALYZE — before/after index



Without an index on `location`:



```

Seq Scan on restaurants  (cost=0.00..1.20 rows=1 width=...)

&#x20;                        (actual time=0.015..0.032 rows=3 loops=1)

```



With a GiST index:



```

Index Scan using restaurants\_location\_gist\_idx on restaurants

&#x20; (cost=0.14..8.16 rows=1 width=...) (actual time=0.045..0.078 rows=3 loops=1)

```



As tables grow to millions of rows, the difference becomes the difference between "usable" and "unusable".



> \*\*Note:\*\* At the current seed size (12 rows) Postgres often chooses a seq scan because the table fits in a single page. The GiST index shines at scale — the plan and query timings in production deployments will reflect that.



\---



\## Database Schema



```

┌────────────────┐       ┌────────────────┐       ┌────────────────┐

│  restaurants   │       │     orders     │       │    drivers     │

├────────────────┤       ├────────────────┤       ├────────────────┤

│ id (uuid) PK   │◄──────│ restaurant\_id  │       │ id (uuid) PK   │

│ name           │       │ id (uuid) PK   │       │ name           │

│ address        │       │ customer\_name  │       │ phone          │

│ phone          │       │ customer\_phone │       │ is\_available   │

│ location GEOG  │       │ driver\_id      │──────►│ location GEOG  │

│ created\_at     │       │ status         │       │ created\_at     │

│ updated\_at     │       │ total\_amount   │       │ updated\_at     │

└────────────────┘       │ customer\_loc   │       └────────────────┘

&#x20;                        │ created\_at     │

&#x20;                        │ delivered\_at   │

&#x20;                        └────────────────┘

```



\*\*Design decisions:\*\*

\- \*\*UUID primary keys\*\* — safe to expose in URLs; distributable inserts

\- \*\*`GEOGRAPHY(Point, 4326)`\*\* — accurate meters on a sphere (WGS84/GPS)

\- \*\*`ON DELETE CASCADE`\*\* on `restaurant\_id` — deleting a restaurant deletes its orders

\- \*\*`ON DELETE SET NULL`\*\* on `driver\_id` — firing a driver orphans orders but preserves history

\- \*\*`DECIMAL(10,2)` for `total\_amount`\*\* — never use floats for money

\- \*\*Composite index\*\* `(restaurant\_id, status)` — powers "pending orders for restaurant X"



\---



\## Testing



Integration tests run against the \*\*real\*\* Postgres + PostGIS + Redis containers. No mocks.



```bash

npm test          # run once

npm run test:watch # watch mode

```



Each test:

1\. Truncates the tables and inserts a deterministic 3-restaurant / 3-driver fixture

2\. Flushes Redis so caches don't leak between tests

3\. Hits the real Express app with Supertest

4\. Asserts the response



\*\*Current coverage: 35 tests across 4 files\*\* covering:

\- All CRUD endpoints (happy + error paths)

\- Zod validation (400s)

\- UUID validation (fixes a former 500 on malformed ids)

\- PostGIS nearby queries and distance ordering

\- Cache behavior (MISS → HIT)

\- ETA computation

\- Order lifecycle transitions and conflict handling



```

&#x20;Test Files  4 passed (4)

&#x20;     Tests  35 passed (35)

&#x20;  Duration  6.89s

```



\---



\## Project Structure



```

src/

├── index.ts                     # Server entry

├── app.ts                       # Express app + router wiring

├── config/                      # (env loading, constants)

├── db/

│   └── prisma.ts                # Prisma client + PrismaPg adapter

├── redis/

│   ├── client.ts                # ioredis client

│   ├── cache.ts                 # cacheGet / cacheSet / cacheDel / cacheDelPattern

│   └── keys.ts                  # Key names + TTL constants + invalidation patterns

├── routes/                      # URL → controller wiring

├── controllers/                 # HTTP layer (status codes, req/res)

├── services/                    # Business logic + PostGIS queries

├── middleware/

│   ├── cacheLogger.ts           # \[req] METHOD path Xms

│   └── validateRequest.ts       # Zod body/query/params factories

├── schemas/                     # Zod schemas for every endpoint

├── types/                       # Shared TS interfaces

└── utils/                       # Geo helpers

prisma/

├── schema.prisma                # Prisma models

├── migrations/                  # Prisma-managed migrations (base tables)

├── sql/postgis\_setup.sql        # Raw SQL: GEOGRAPHY columns + GiST indexes

└── seed.ts                      # 12 restaurants / 22 drivers / 40 orders

tests/

├── setup.ts                     # resetDb() + flushRedis() + closePool()

├── health.test.ts

├── restaurants.test.ts

├── drivers.test.ts

└── orders.test.ts

```



\---



\## What I Learned



\*\*PostGIS\*\*

\- `GEOGRAPHY` vs `GEOMETRY`: `GEOGRAPHY` returns true meters on the Earth's surface; `GEOMETRY` is planar and needs a projected SRID for meaningful distances

\- `ST\_MakePoint(lng, lat)` — \*\*longitude first\*\*. This is easy to get wrong and produces silently incorrect results (a point in the wrong hemisphere)

\- `ST\_DWithin` is index-aware. Without a GiST index, it falls back to a sequential scan; with one, it prunes the search space early

\- Prisma can't model `GEOGRAPHY`. The clean pattern is: Prisma for CRUD, raw SQL via `$queryRaw`/`$executeRaw` for spatial columns. The column itself is created by a raw migration that Prisma doesn't know about



\*\*Redis\*\*

\- \*\*Cache-aside\*\* is: check → miss → query → set with TTL. The TTL is the safety net; explicit invalidation is the correctness mechanism

\- Invalidation must use `SCAN`, never `KEYS` — `KEYS` blocks the entire Redis instance during iteration

\- Rounding spatial keys to 4 decimals (\~11 m) dramatically increases hit ratio without sacrificing correctness (the unrounded coordinates still drive the SQL)

\- \*\*Fail-open\*\* is non-negotiable: if Redis is down, the API must still serve the request from the DB, not crash



\*\*Prisma 7\*\*

\- Version 7 removed `url = env("DATABASE\_URL")` from `schema.prisma` — connection info now lives in `prisma.config.ts`

\- Version 7 also removed the auto-generated `@prisma/client` import. The client is generated to a custom output (e.g., `src/generated/prisma`) and imported from there

\- A driver adapter (`@prisma/adapter-pg`) is required to connect

\- Prisma diffs the schema against the DB. Manually added columns (like PostGIS `location`) will get dropped by the next migration unless you use `externalTables` or manage them outside Prisma. This is why `prisma/sql/postgis\_setup.sql` is a raw file



\*\*Express 5\*\*

\- `req.query` is a read-only getter — you cannot reassign it. Middleware must attach parsed query data elsewhere (`req.validatedQuery`)

\- Route ordering matters: `/nearby` must be registered before `/:id`, or Express treats "nearby" as an id

\- Error-handling middleware is detected by \*\*arity\*\* (4 parameters) — a wrong signature silently becomes a normal middleware



\*\*Testing\*\*

\- Integration tests that hit the real DB + real PostGIS + real Redis catch problems mocks hide: UUID casting errors, GiST index behavior, cache invalidation bugs

\- `pool: 'forks'` in Vitest + `fileParallelism: false` prevents concurrent test files from stomping on each other's data

\- `TRUNCATE ... RESTART IDENTITY CASCADE` + deterministic fixtures + `redis.flushall()` in `beforeEach` gives clean, independent tests



\---



\## Future Improvements



\- \*\*Authentication\*\*: JWT + refresh tokens, scoped to restaurant / driver / customer roles

\- \*\*Rate limiting\*\*: Redis-backed sliding window per IP

\- \*\*Message queue\*\*: push order status updates to drivers via BullMQ / Redis Streams

\- \*\*Real routing\*\*: replace straight-line `ST\_Distance` with `pgrouting` or an external routing engine (OSRM, Valhalla) for actual road distances

\- \*\*Live driver tracking\*\*: WebSocket + Redis Pub/Sub, broadcasting driver positions to subscribed customers

\- \*\*Metrics\*\*: Prometheus counters for cache hit ratio, request latency histogram, error rate

\- \*\*CI\*\*: GitHub Actions running `docker compose up`, migrations, seed, and tests on every push

\- \*\*Observability\*\*: structured JSON logging (pino), tracing (OpenTelemetry)

\- \*\*Schema hardening\*\*: integrate PostGIS columns via Prisma's `externalTables` so Prisma's migrate understands the schema fully



\---



\## License



MIT

