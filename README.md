# Chatbot Web UI v2

This repository hosts the v2 implementation of a terminal-inspired chat experience backed by FastAPI + Ollama on the backend and React + Vite on the frontend. Development targets Ubuntu 24.04 with uv-managed Python 3.12 and Node.js 18+ (via nvm).

## Prerequisites
- `python3.12` available on PATH
- [`uv`](https://github.com/astral-sh/uv) already installed (`uv --version`)
- [`nvm`](https://github.com/nvm-sh/nvm) with Node.js 18+ (`node -v`) and npm (`npm -v`)
- Optional: `pnpm`, `act`, Docker

## Environment Variables
Copy the template file and update any values before running either stack:
```bash
cp .env.example .env
# generate a Fernet key for config encryption
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
# paste the printed key into .env as FERNET_KEY=...
set -a && source .env && set +a
```
Every terminal session that interacts with `uv run ...` or `npm run ...` needs those exports (you can add the commands to your shell profile if desired). Secrets should only live in `.env`; the `*.example` file remains a safe template to commit.

## Backend Setup
```bash
uv sync --extra test --extra lint
source .venv/bin/activate
uv run pytest
uv run ruff check
uv run mypy api tests
uv run uvicorn api.main:app --reload
```

## Frontend Setup
```bash
cd frontend
npm install
npm run dev
npm run lint
npm run test
```

## Combined Dev Workflow
Use `uv run uvicorn` for the backend and `npm run dev` for the frontend concurrently (e.g., via two terminals or a process manager). Default API base is `http://localhost:8000` with Vite running on `5173`.

## Manual Smoke Tests
After launching `uv run uvicorn api.main:app --reload`, exercise the core endpoints:

```bash
# health (expects db_status ok)
curl http://127.0.0.1:8000/api/health

# read config (auto-seeded if empty)
curl http://127.0.0.1:8000/api/config

# update config
curl -X PUT http://127.0.0.1:8000/api/config \
  -H 'Content-Type: application/json' \
  -d '{
        "ollama_base_url":"http://localhost:11434",
        "generation_defaults":{"model":"llama3","temperature":0.6,"top_p":0.8,"max_tokens":256},
        "theme":"dark"
      }'

# (optional) verify Ollama connectivity if a daemon is running
curl http://127.0.0.1:8000/api/version
```

Expected responses are HTTP 200 with JSON bodies mirroring health info, persisted config payloads, and Ollama version strings (or 502 if Ollama is offline).

## Continuous Integration
GitHub Actions workflow (`.github/workflows/ci.yml`) validates backend (pytest, ruff, mypy) and frontend (lint, unit tests, Playwright smoke tests) on Ubuntu latest runners.
