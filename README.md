# Ali Damghouni — Developer Portfolio

A React and Express portfolio with MongoDB-backed projects, validated contact submissions, and owner-only administration. Manus OAuth authenticates the application; no demo or first-visitor admin account is created.

## Commands

- `pnpm dev`: development on the configured `PORT` (default `3000`).
- `pnpm build` / `pnpm start`: compile and serve the production frontend and Express API.
- `pnpm check` / `pnpm test`: TypeScript checks and backend tests.
- `RUN_LOCAL_MONGO_TESTS=1 pnpm exec vitest run server/mongo/local.integration.test.ts`: opt-in isolated real-Mongo persistence tests. These explicitly ignore `MONGODB_URI`, use a temporary directory, and never write to an external database.

The old Drizzle files remain only for compatibility with the starter's numeric `User` type. Runtime persistence uses **MongoDB exclusively**; `DATABASE_URL`, `db:push`, and `db:migrate` do not provision this application's data.

## Database setup

Set the server secret `MONGODB_URI` to a MongoDB connection string with a database name, for example `mongodb+srv://<username>:<password>@<cluster>/aliportfolio?retryWrites=true&w=majority`. Use a dedicated application database/account, URL-encode credentials, allow the deployment's network access, and grant the account permission to read/write collections and create indexes. Do not put this URI in frontend/Vite variables or source control. MongoDB Atlas is one possible provider; a separately managed MongoDB deployment also works.

When `MONGODB_URI` is present, both development and production use that actual external database. A failed external connection does **not** silently switch to a local database. Startup waits for connection and initialization before serving Vite/static files. The unauthenticated `/api/health` endpoint remains HTTP 200 and reports only safe connection status; inspect `databaseMode` for database readiness.

Only when `NODE_ENV=development` and no external URI is configured, `mongodb-memory-server-core` starts a **real local MongoDB process** using MongoDB `8.0.16`, WiredTiger, loopback networking, and the ignored `.local-mongo/` directory. `LOCAL_MONGO_VERSION` can override the development binary version. The binary's first download requires internet access and a supported runtime (Node 20.19+; this project environment uses Node 22). Despite the package name, this mode uses database files, not JavaScript arrays or an ephemeral memory collection. SIGINT/SIGTERM shutdown preserves those files for preview restarts.

**Local preview is not durable production storage.** Its sandbox files can disappear when the sandbox resets and are not deployed/backed up as database data. Configure `MONGODB_URI` before relying on contact messages or admin edits in production. In production (or any non-development environment), no URI means `databaseMode: "unavailable"`: published initial projects remain available as a clearly marked static read-only fallback; contact submissions and database-dependent administration return 503. No production local/in-memory fallback is started.

Known initial projects are inserted only once into an initially empty project collection, using stable ids and `$setOnInsert`. A persistent settings marker prevents restart from overwriting admin edits or resurrecting deleted projects. Existing nonempty collections are not seeded. If initialization is interrupted after the seed marker is claimed, investigate the database and complete any missing initial content deliberately; the service does not automatically replay seeding.

## Authentication and administration

Manus supplies `MANUS_PROJECT_ID`, `MANUS_JWT_SECRET`, `MANUS_OAUTH_API_URL`, and browser-safe portal configuration. By default, administration is restricted to a **verified provider identity with the exact email `ali.damghouni@gmail.com`**. After validating the project session JWT, every owner request resolves the identity through `sdk.getUserInfoWithJwt(token)` and requires its openId to match the signed session and its email to match the allowlist. Email comparison only trims surrounding whitespace and lowercases; aliases, added dots, plus-addressing, and display-name forms are not accepted as equivalent. Lookup failures fail closed. There is no first-visitor claim, owner-creation workflow, or development authentication bypass.

`PORTFOLIO_OWNER_EMAIL` optionally overrides that allowlist in **server-only deployment configuration**; blank or omitted values retain the default. `OWNER_OPEN_ID` is optional: once the owner's immutable authenticated Manus identity is known, setting it pins administration exclusively to that exact openId. A configured openId is authoritative even if another account has the allowlisted email, and its matching signed session does not require a provider lookup for authorization. Never accept either setting from a request or expose it through frontend/Vite configuration. Scheduled/cron identities are always rejected. JWT email claims, request-provided names/emails/roles, and stored role flags never grant access. Persisted provider email is used only for display roles; REST and tRPC administration independently apply the shared token/provider gate. Numeric legacy user ids are stable 52-bit hashes of the authenticated openId; Mongo's unique index fails closed in the extremely unlikely event of an id collision.

Preserved OAuth callbacks verify the browser-bound single-use state nonce and redirect only to `/admin`. Session verification uses the existing SDK, HS256, a required expiry claim, and the exact project id. Cookie-based login uses `webdev_app_session` with `HttpOnly; Secure; SameSite=None` for embedded HTTPS Preview. The SDK also accepts a validated Bearer project session when iframe cookies are unavailable. When MongoDB is unavailable, the provider-verified email owner can still read `/api/admin/me` with the safe verified email and database mode; actual project/message writes remain unavailable (503). With an explicitly pinned openId, the email can be null when persisted display information is unavailable. Owner identity lookup is not cached, so provider failures or email changes are checked on each request.

All admin mutations require `X-Portfolio-Request: 1`. There is no permissive CORS, so cross-origin scripts cannot obtain preflight permission to send that header. API responses use `Cache-Control: no-store`. Helmet security headers are enabled with CSP and frame protection disabled for Vite/embedded Preview. Express trusts one reverse-proxy hop; deployments with a different trusted proxy topology should adjust this setting rather than trusting every forwarding header. Bodies are limited to 32 KB. General API limiting is 240 requests/minute/IP; contact limiting is 5 attempts/15 minutes/IP. Limits are process-local abuse protection, not a distributed quota service.

## REST API contract

Every REST failure is `{ "error": "User-friendly message" }`. Invalid fields/ids return 400, missing/invalid authentication 401, authenticated non-owners or missing mutation headers 403, absent items/unknown API routes 404, rate limits 429, oversized bodies 413, and unavailable MongoDB 503. Legacy `/api/trpc` routes retain their starter tRPC protocol.

| Method and path                  | Request                                                                 | Success                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/health`                | Public                                                                  | 200 `{status:"ok",database:"connected"\|"unavailable",databaseMode}`                           |
| `GET /api/projects`              | Public                                                                  | 200 `{projects: PortfolioProject[],databaseMode}`; published only, ascending `order` then `id` |
| `POST /api/contact`              | `{name,email,subject,message,website:""}`                               | 201 `{success:true}` only after Mongo insertion                                                |
| `GET /api/admin/me`              | Authenticated owner                                                     | 200 `{user:{name,email,role:"admin"},databaseMode}`                                            |
| `GET /api/admin/projects`        | Authenticated owner                                                     | 200 `{projects: PortfolioProject[]}` including unpublished, ascending `order` then `id`        |
| `POST /api/admin/projects`       | Project fields without `id`, plus mutation header                       | 201 `{project: PortfolioProject}` with generated UUID string id                                |
| `PUT /api/admin/projects/:id`    | Complete project fields, optionally matching `id`, plus mutation header | 200 `{project: PortfolioProject}`; id cannot change                                            |
| `DELETE /api/admin/projects/:id` | Mutation header                                                         | 200 `{success:true}`                                                                           |
| `GET /api/admin/messages`        | Authenticated owner                                                     | 200 `{messages: ContactMessage[]}`, newest first                                               |
| `PATCH /api/admin/messages/:id`  | `{status:"unread"\|"read"\|"archived"}`, mutation header                | 200 `{message: ContactMessage}`                                                                |
| `DELETE /api/admin/messages/:id` | Mutation header                                                         | 200 `{success:true}`                                                                           |

`databaseMode` is `"external"`, `"local-preview"`, or `"unavailable"`. Dates in messages are ISO-8601 strings. No endpoint sends an email or claims delivery: contact success means the message was actually stored for the owner's inbox.

Contact fields are trimmed: name 2–100 characters, valid email at most 320, subject 2–160, message 10–5,000. The honeypot must be blank (omitted also defaults to blank); a filled honeypot is rejected, never given fake success. Unknown fields and object-shaped injection attempts are rejected.

Project fields match `shared/portfolio.ts`: title 2–120, subtitle up to 200, description 10–5,000, category `Full-stack`/`Web application`, year 1–30, status 1–80, booleans `featured`/`published`, cover `delivery`/`banking`/`portfolio`, integer order 0–100,000, at most 20 technology strings (1–60 each), and at most 12 highlight strings (1–500 each). URL fields allow blank or credential-free HTTP/HTTPS URLs up to 2,048 characters; image URLs additionally permit safe relative `/manus-storage/` paths. External ids are validated scalar strings and all Mongo filters are server-authored.

Private environment values remain server-side. `server/_core/publicConfig.ts` exposes only named browser-safe configuration, and the platform serves `/manus-storage/` assets without a duplicate application proxy.

## Current handoff status

The portfolio is functional in Manus Preview using real local MongoDB. The provided hosted connection values were rejected because neither had a valid MongoDB URI format. The current Preview launch explicitly uses `MONGODB_URI= pnpm dev`; it does not silently fall back from a failed external connection. Replace the protected `MONGODB_URI` with a real hosted connection before publication, then restart the application and confirm `/api/health` reports `databaseMode: "external"` and `database: "connected"`.

The admin workspace is `/admin`. Sign in with the verified Manus account for `ali.damghouni@gmail.com`, or deliberately configure the server-only owner email / immutable owner identity for a different administrator. `POST /api/admin/logout` clears the secure session cookie and requires `X-Portfolio-Request: 1`, even for expired sessions.

The UI includes dark/light themes, responsive navigation, project categories, featured badges, accessible project detail dialogs, an editable admin project list, and message read/archive/delete controls. The downloadable German résumé is reformatted from the supplied CV; illustrative project covers are disclosed as concepts, not screenshots of deployed products. Server-rendered root HTML includes current public projects, private admin HTML is noindex, and unknown pages return HTTP 404.

TypeScript checks and the production build pass. The updated unit/auth/API suite has 104 passing tests. Five isolated real-Mongo tests were separately executed successfully during backend implementation; test-only contacts were removed and no tests wrote to an external database. Hosted publication has not been performed.
