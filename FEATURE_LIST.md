# Chatbot Web UI v2 – Feature Blueprint

## Technology Stack
- **Languages:** TypeScript (React SPA), Python 3.12 (backend services), SQL (SQLite via SQLAlchemy/SQLModel) for persisting sessions/settings.
- **Frameworks & Runtimes:** FastAPI + Uvicorn (async API server managed via `uv`), React 18 + Vite + TypeScript on the frontend managed with `npm`.
- **Styling & UI:** Tailwind CSS with Radix UI primitives; custom sleek terminal-inspired design system with multiple color themes (default dark graphite).
- **Protocols:** REST over HTTPS for backend APIs, Server-Sent Events (SSE) for streamed chat completions, WebSocket fallback for future real-time features, local file persistence for configs.
- **Packages & Tooling:** `httpx`, `pydantic`, `sqlmodel`, `apscheduler` (background jobs), `uvicorn`, `fastapi-sse`, `pnpm` optional, `vitest` + `playwright` (frontend tests), `pytest` + `pytest-asyncio` (backend tests), `ruff` + `mypy` for lint/type checking, `prettier` + `eslint` for frontend linting, `dotenv` for configuration.

## Core Experience
- **Guided First-Run Setup:** Wizard prompts for the local Ollama base URL, validates connectivity via `GET /api/version`, stores encrypted copy in SQLite; easily editable later in Settings.
- **Persistent Chat Sessions:** Users can create, rename, delete, and reopen sessions; backend stores `id`, `title`, `created_at`, `updated_at`, tokens used, and model reference.
- **Automatic Session Titles:** On first message the backend calls a dedicated title-generation endpoint that invokes the selected model with a succinct prompt, storing metadata without polluting the chat log.
- **Conversation Streaming:** Prompt isolation pipeline builds final prompts then streams responses via SSE with incremental tokens, token-per-second speeds, and word count metrics.
- **Prompt Builder Layer:** Modular stage allowing insertion of RAG/tool outputs before streaming; exposed via backend hook interface for future plugins.

## Ollama Model Management
- **Endpoint Configuration:** Global setting for Ollama base URL with optimistic UI and connectivity checks.
- **Model Catalog:** Aggregates `/api/tags` and `/api/ps` to show local models, download status, and loaded state with live refresh.
- **Pull & Delete Models:** UI to pull models (`POST /api/pull`) with progress updates using streaming, and to delete unused ones (`DELETE /api/delete`).
- **Load / Unload Controls:** Backend wrappers invoke shell commands `ollama run <model>` (load) and `ollama stop <model>` (unload), surfacing logs and errors in UI.
- **Model Details on Demand:** “More info” drawer lazily calls `/api/show` to display parameters, template, format, and Modelfile excerpt.
- **Model Selection Flow:** Users must explicitly select and load the model they want to chat with; sessions reference the model id and warn if it is not currently loaded.
- **Health Dashboard:** Inline notifications for Ollama availability, GPU/CPU usage (via `/api/ps` stats when available), and failover guidance.

## Chatting Features
- **Session Management UI:** Sidebar showing sessions with timestamps, active model, and token counts; keyboard shortcuts to switch.
- **Rich Composer:** Markdown support, code fencing, adjustable system prompt, multi-modal attachments stub for future expansion.
- **Parameter Controls:** Sliders and inputs for temperature, top_p, top_k, repeat penalty, context window size, and stop sequences; always read from global generation defaults defined in Settings so every model shares the same configuration.
- **Token & Speed Metrics:** Display prompt tokens, completion tokens, total tokens, and tokens-per-second derived from streaming timestamps.
- **Message Actions:** Regenerate response, copy, delete, share, and pin; responses render syntax highlighting with dynamic theme awareness.

## Settings & Themes
- **Settings Panel:** Tabs for General (Ollama URL, connection diagnostics), Generation Defaults (global parameters for temperature/top_p/top_k/context/stop tokens), Appearance (theme selection, font size, density), Advanced (logging level, SSE buffer size).
- **Theme System:** Predefined palettes (Dark Graphite, Terminal Green, Solarized Dark, Light Quartz) with CSS variables; user preference persisted in local storage + backend profile.
- **Keyboard Shortcuts:** Discoverable command palette (⌘K / Ctrl+K) to create sessions, switch models, open settings.

## Backend Services
- **FastAPI Modules:**
  - `/api/config`: CRUD for Ollama URL and global generation defaults shared by all models.
  - `/api/models`: proxy to Ollama `/tags`, `/ps`, `/pull`, `/delete`, `/show`, plus custom `/load` & `/unload`.
  - `/api/chat`: wrapper over `/api/generate` providing streaming, prompt builder hooks, transcript persistence.
  - `/api/sessions`: CRUD routes for chat sessions and messages.
  - `/api/title`: uses model to craft short summaries for sessions.
- **Async Task Scheduling:** APScheduler job to refresh model list periodically and clean up stale loads.
- **Error Handling:** Unified exception middleware with user-friendly messages and logging via `structlog`.

## Frontend Application
- **Routing & State:** React Router for views (Chat, Models, Settings), Zustand or Redux Toolkit Query for global state and API caching.
- **Data Fetching:** Generated TypeScript client from OpenAPI schema for type-safe API calls.
- **Streaming Handling:** Custom hook to consume SSE, update UI progressively, and compute token metrics.
- **Offline Handling:** Graceful fallback when backend/Ollama unavailable with retry actions.

## Testing & Quality
- **Backend Tests:** `pytest` suite covering config management, chat streaming mock, model management wrappers, and session persistence.
- **Frontend Tests:** `vitest` for components/hooks, Playwright smoke tests for major flows (setup, chat, load model).
- **CI Hooks:** GitHub Actions workflow running `uv run pytest`, `uv run ruff`, `npm run lint`, `npm run test`, and Playwright in headless mode.

## Documentation & Developer Experience
- **README Guides:** Installation (uv + npm), environment setup, commands: `uv pip install -r pyproject.toml`, `uv run uvicorn api.main:app`, `npm install`, `npm run dev`, `npm run build`, test commands.
- **API Reference:** Markdown docs describing backend endpoints, request/response bodies, auth requirements.
- **Makefile / Task Runner:** Convenience commands (`make dev`, `make test`, `make lint`).

## Deployment & Packaging
- **Containerization:** Dockerfile with multi-stage build (uv for backend, npm for frontend) and docker-compose for backend + nginx static serving.
- **Versioning:** Semantic version tags with changelog in `docs/CHANGELOG.md`.

## Accessibility & Performance
- **Accessibility:** WCAG-compliant contrasts, keyboard navigation, screen-reader labels.
- **Performance Goals:** SSR-friendly bundle, code splitting, service worker prefetching for icons/fonts, backend caching for model metadata.
