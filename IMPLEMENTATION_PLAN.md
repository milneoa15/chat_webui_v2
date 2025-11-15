# Chatbot Web UI v2 – Incremental Implementation Plan

_Target platform: Linux Ubuntu 24.04 LTS workstation running uv-managed Python 3.12 and npm-managed Node 18+ (Vite/React). All commands assume bash shell._

## Phase 1 – Environment Bootstrapping & Toolchain Guardrails
**Status:** ✅ Completed – 2025-11-15
- **Goal:** Provide a reproducible dev environment with linting, typing, testing, and GitHub Actions scaffolding before feature work begins.
- **Key Tasks:**
  - Since npm/nvm and uv are already installed on Ubuntu 24.04, simply verify versions (`uv --version`, `npm -v`, `node -v`, `pnpm -v`, `npx vite --version`) and pin `python3.12` as default interpreter.
  - Initialize a Git repository, set the `origin` remote to `git@github.com:milneoa15/chat_webui_v2.git`, and create the baseline commit (`chore: scaffold project stack`) as the starting point for main.
  - Initialize Python project with `pyproject.toml` declaring FastAPI, uvicorn[standard], sqlmodel, sqlalchemy, httpx, apscheduler, structlog, fastapi-sse, pydantic-settings, python-dotenv, pytest, pytest-asyncio, mypy, ruff.
  - Initialize frontend with `npm create vite@latest frontend -- --template react-ts`, add Tailwind CSS, Radix UI, React Router, Zustand, React Query or RTK Query, `lucide-react`, `clsx`, `vite-tsconfig-paths`, `eslint`, `prettier`, `vitest`, `@testing-library/react`, `@tanstack/react-query`, `playwright`.
  - Create shared `.editorconfig`, `.env.example`, `.gitignore`, and VSCode settings recommending `ruff`, `mypy`, `eslint`.
  - Scaffold GitHub Actions workflow running `uv run pytest`, `uv run ruff check`, `uv run mypy`, `npm run lint`, `npm run test`, `npx playwright test`.
  - Once lint/tests pass, push the baseline to GitHub (`git push -u origin main`) so every later phase can build atop main.
- **Requirements / Definition of Done:**
  - `uv run pip list` shows declared backend dependencies; `npm install` succeeds inside `frontend/`.
  - Tailwind configured via `tailwind.config.cjs`, `postcss.config.cjs`, `src/index.css` includes `@tailwind base/components/utilities`.
  - CI workflow `./.github/workflows/ci.yml` triggers on push/PR and runs backend + frontend jobs on Ubuntu.
  - Root README explains setup commands for Ubuntu 24.04 (uv install, npm install, `make dev`).
- **Verification:**
  - Run `uv run ruff check` and `uv run mypy` on backend package; expect zero errors.
  - Run `npm run lint` and `npm run test` from `frontend/`.
  - Dry-run GitHub Actions locally via `act` (optional) or confirm workflow YAML passes `yamllint`.

## Phase 2 – Backend Core Infrastructure (Config & Persistence)
**Status:** ✅ Completed – 2025-11-15
- **Goal:** Establish FastAPI project structure with configuration storage, SQLite persistence via SQLModel, and foundational routes.
- **Key Tasks:**
  - Layout backend package `api/` with modules: `main.py`, `dependencies.py`, `config.py`, `database.py`, `models.py`, `routers/`.
  - Configure SQLModel with SQLite database file (e.g., `chatbot.db`) stored under project root; use Alembic-free `SQLModel.metadata.create_all` for MVP.
  - Implement `Config` table storing Ollama base URL, generation defaults, and theme preference; ensure encryption (e.g., Fernet) for sensitive fields.
  - Add Pydantic schemas for read/write models; load settings from `.env` using `pydantic-settings`.
  - Implement `/api/health` for readiness and `/api/config` CRUD operations; include `GET /api/version` proxy to Ollama for validation using `httpx.AsyncClient`.
  - Integrate structlog logging, exception middleware returning JSON error envelopes, and CORS configuration for Vite dev origin.
  - Commit Phase 2 work directly on main with message `feat: backend config foundation` after tests pass, then push.
- **Requirements / Definition of Done:**
  - FastAPI app served via `uvicorn api.main:app --reload` responds to `/api/health` with uptime + DB status.
  - `Config` table migrations run automatically on startup; ability to set/update Ollama URL persisted.
  - `.env` supports overriding DB path, Fernet key, log level, SSE buffer, scheduler intervals.
  - Unit tests cover config CRUD and Ollama connectivity validation using Mock transport.
- **Verification:**
  - `uv run pytest tests/test_config.py::test_update_config` passes.
  - `curl http://localhost:8000/api/health` returns HTTP 200 with `db_status: "ok"`.

## Phase 3 – Session Persistence & Prompt Metadata
**Status:** ✅ Completed – 2025-11-15
- **Goal:** Support chat session lifecycle storage, automatic title generation hooks, and prompt builder scaffolding in the backend.
- **Key Tasks:**
  - Define SQLModel tables: `Session`, `Message`, `PromptMeta` capturing ids, timestamps, author role, tokens, model id, metrics.
  - Implement `/api/sessions` CRUD (list, create, rename, delete) and `GET /api/sessions/{id}/messages` paginated.
  - Expose `/api/title` endpoint calling selected model via Ollama `/api/generate` with specialized prompt template; store result without modifying original message log.
  - Build prompt builder pipeline class that accepts base messages plus optional plugin outputs (RAG/tool stubs) before streaming.
  - Ensure transactions maintain invariants (e.g., `Session.updated_at` auto-updates on message insert).
  - Commit Phase 3 work on main with message `feat: session persistence & titles` and push after CI succeeds.
- **Requirements / Definition of Done:**
  - Creating a session writes DB rows accessible through API; deleting cascades messages.
  - First user message triggers background task to call `/api/title` and persist title.
  - Prompt builder documented with interface for future plugin injection.
  - Tests validate session CRUD, title generation fallback when Ollama unavailable, and prompt builder ordering.
- **Verification:**
  - `uv run pytest tests/test_sessions.py`.
  - Manual POST via HTTPie: `http POST :8000/api/sessions title="Demo"` responds with stored object.

## Phase 4 – Model Management Services & Scheduler
- **Goal:** Deliver comprehensive model catalog, pull/delete/load/unload controls, and health dashboard data via FastAPI.
- **Key Tasks:**
  - Implement `/api/models` router proxying Ollama endpoints: `/api/tags`, `/api/ps`, `/api/pull`, `/api/delete`, `/api/show`, plus custom `/load` & `/unload` invoking shell commands (`ollama run/stop`).
  - Stream progress from `POST /api/pull` and `POST /api/pull` SSE using FastAPI-SSE to forward chunked responses.
  - Add APScheduler job (AsyncIOScheduler) refreshing `/api/tags` + `/api/ps` caches; persist CPU/GPU stats.
  - Store model metadata in DB referencing sessions for warnings when model not loaded.
  - Extend `/api/health` to surface Ollama reachability, scheduler status, and cached stats.
  - Commit Phase 4 deliverables on main as `feat: model catalog services` once automated checks stay green, then push.
- **Requirements / Definition of Done:**
  - API returns aggregated model list with download status and load state.
  - Pull/delete/load/unload endpoints handle optimistic updates and propagate errors with structured responses.
  - Scheduler runs at configurable interval (e.g., 60s) with graceful shutdown hooks.
  - Tests mock subprocess calls for load/unload and streaming parsing logic.
- **Verification:**
  - `uv run pytest tests/test_models.py`.
  - Manual SSE test: `curl -N :8000/api/models/pull -d '{"name":"llama3"}'` streams progress JSON lines.

## Phase 5 – Chat Streaming & Metrics Pipeline
- **Goal:** Implement `/api/chat` streaming endpoint with SSE, token metrics, and message persistence.
- **Key Tasks:**
  - Create streaming generator using `httpx.AsyncClient.stream("POST", ollama /api/generate)` bridging chunked data to SSE (`fastapi-sse` or manual EventSource). Include heartbeats to keep connection alive.
  - Calculate prompt/completion token counts using Ollama metadata, track tokens/sec via timestamps, persist metrics per message.
  - Support message actions: regenerate (duplicate last user prompt), delete, pin; expose REST endpoints for these actions.
  - Implement `PromptOptions` model capturing temperature, top_p, top_k, repeat_penalty, context_window, stop sequences from global config with session overrides.
  - Provide WebSocket fallback route (e.g., `/ws/chat`) for future use but keep SSE primary.
  - Commit the streaming feature on main with message `feat: chat streaming pipeline`, then push after verification.
- **Requirements / Definition of Done:**
  - SSE endpoint returns incremental tokens; client disconnect cleans up background tasks.
  - Messages stored with streaming transcript; regenerate action overwrites previous assistant message.
  - Token metrics persisted and accessible via `/api/sessions/{id}/metrics`.
  - End-to-end test using pytest + respx mocking verifies SSE chunks and DB writes.
- **Verification:**
  - `uv run pytest tests/test_chat.py` with asyncio SSE client fixture.
  - Manual test using `curl -N -H "Accept: text/event-stream"` posting to `/api/chat`.

## Phase 6 – Frontend Foundation (Routing, State, Theming)
- **Goal:** Build React/Vite scaffolding aligned with backend contracts, theme system, and global state management.
- **Key Tasks:**
  - Configure React Router with routes `/chat/:sessionId?`, `/models`, `/settings`; add protected layout verifying backend health before rendering.
  - Implement global stores via Zustand (or Redux Toolkit Query) for config, sessions, models, using OpenAPI-generated TypeScript client (`openapi-typescript` + `axios` or `fetch` wrapper).
  - Integrate Tailwind + Radix UI primitives; define design tokens via CSS variables for Dark Graphite, Terminal Green, Solarized Dark, Light Quartz themes, persisted in localStorage and synced to backend profile.
  - Add keyboard shortcut manager (Cmd/Ctrl+K) using `cmdk` or custom command palette listing session/model actions.
  - Implement offline banner component triggered when backend health fails.
  - Commit Phase 6 changes on main (`feat: frontend routing & theming scaffold`) once CI and Vitest suites pass, then push.
- **Requirements / Definition of Done:**
  - `src/api/client.ts` generated from backend OpenAPI schema; hooks typed end-to-end.
  - Theme switching updates document class, persists preference, and notifies backend via `/api/config/theme`.
  - Command palette can create session, switch models, open settings.
  - Vitest component tests cover router guards and theme store; Playwright smoke test ensures navigation works.
- **Verification:**
  - `npm run test src/stores/theme.test.tsx`.
  - `npx playwright test tests/navigation.spec.ts` inside `frontend/`.

## Phase 7 – Frontend Chat & Model Workflows
- **Goal:** Deliver the user-facing experiences: guided setup, chat composer/streaming UI, model catalog management, and settings views.
- **Key Tasks:**
  - Implement Guided First-Run modal wizard calling `/api/config` and verifying Ollama via `/api/config/test` endpoint; store encrypted URL.
  - Build sidebar session list with search, timestamps, token counts, keyboard navigation; integrate session CRUD endpoints.
  - Implement chat view featuring markdown rendering (React Markdown + `rehype-highlight`), syntax highlighting with theme-aware Prism or Shiki, message actions (regenerate/copy/delete/share/pin).
  - Build composer supporting markdown textarea (auto-resize) with system prompt panel and parameter controls bound to global defaults (temperature, etc.). Include placeholders for future multi-modal attachments.
  - Integrate SSE hook to consume `/api/chat`, stream tokens, compute tokens/sec, update metrics HUD.
  - Implement Models view showing aggregated data, progress bars for pulls, load/unload buttons streaming logs, and warnings when session model not loaded.
  - Settings panel with tabs: General, Generation Defaults, Appearance, Advanced; integrate form validation with `react-hook-form` + zod.
  - Commit this UX milestone directly on main with `feat: chat & model workflows`, then push.
- **Requirements / Definition of Done:**
  - First-run wizard blocks until Ollama URL saved and validated.
  - Chat UI persists messages, displays token metrics, supports parameter adjustments synced to backend.
  - Models view reflects live stats (poll `/api/models/ps` every 10s) and exposes pull/delete/load/unload actions with optimistic UI.
  - Settings update forms produce success toasts and persist to backend; theme preview updates immediately.
  - Frontend tests cover SSE hook, composer validation, wizard flow, and model actions (mocked network).
- **Verification:**
  - `npm run test` plus targeted `vitest` suites for chat components.
  - Playwright scenario: run `npx playwright test tests/chat-flow.spec.ts` verifying setup → create session → chat stream → change settings.

## Phase 8 – Quality Gates, Docs, and Deployment Packaging
- **Goal:** Finalize documentation, automation, and containerization for release.
- **Key Tasks:**
  - Expand README with architecture diagrams (Mermaid), local dev instructions (uv + npm), troubleshooting for Ubuntu 24.04, SSE/WebSocket explanation.
  - Create `docs/` folder for API reference (autogenerated via `fastapi openapi` export) and user guide.
  - Author Makefile targets: `make dev` (concurrent uvicorn + npm run dev via `watchexec`), `make test`, `make lint`, `make format` (ruff + prettier), `make build` (vite build + uv pip compile optional).
  - Build Dockerfile: stage 1 installs backend deps with uv, stage 2 builds frontend with npm, final stage runs uvicorn behind gunicorn (optional) and serves frontend via `uvicorn` + `StaticFiles` or Nginx in docker-compose.
  - Configure `docker-compose.yml` for backend, nginx, and sqlite volume.
  - Ensure GitHub Actions publishes Docker image on tagged releases and updates CHANGELOG.
  - If the release packaging feels optional for some consumers, develop it on a dedicated branch (e.g., `phase-8-release-packaging`), commit `chore: release packaging & docs`, and only merge/tag on `main` once stakeholders confirm they want the Docker artifacts included.
- **Requirements / Definition of Done:**
  - `make dev` launches both servers with shared `.env` values; hot reload works.
  - `docker compose up` serves production build accessible on localhost with HTTPS termination handled via self-signed cert or reverse proxy instructions.
  - Documentation includes API endpoints, env vars, and testing instructions.
  - Release notes template ready in `docs/CHANGELOG.md` using Keep a Changelog format.
- **Verification:**
  - Run `make lint`, `make test`, `make build` successfully.
  - Execute `docker compose build && docker compose up` without runtime errors.

## Future Improvements (from Feature List)
- Image upload pipeline for multi-modal prompts.
- Retrieval-Augmented Generation (RAG) integration slots in prompt builder.
- Tool execution plugins (code interpreters, web search) exposed via prompt builder layer.
- Enhanced analytics dashboard for usage metrics and GPU utilization trends.
- Advanced offline caching/service worker enhancements.
