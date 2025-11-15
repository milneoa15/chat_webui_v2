# Chatbot Web UI v2

This repository hosts the v2 implementation of a terminal-inspired chat experience backed by FastAPI + Ollama on the backend and React + Vite on the frontend. Development targets Ubuntu 24.04 with uv-managed Python 3.12 and Node.js 18+ (via nvm).

## Prerequisites
- `python3.12` available on PATH
- [`uv`](https://github.com/astral-sh/uv) already installed (`uv --version`)
- [`nvm`](https://github.com/nvm-sh/nvm) with Node.js 18+ (`node -v`) and npm (`npm -v`)
- Optional: `pnpm`, `act`, Docker

## Backend Setup
```bash
uv sync --extra test --extra lint
source .venv/bin/activate
uv run pytest
uv run ruff check
uv run mypy
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

## Version Control
This project lives at [`milneoa15/chat_webui_v2`](https://github.com/milneoa15/chat_webui_v2). After cloning or creating a fresh workspace:

```bash
git init
git remote add origin git@github.com:milneoa15/chat_webui_v2.git
git add .
git commit -m "chore: scaffold project stack"
```

## Continuous Integration
GitHub Actions workflow (`.github/workflows/ci.yml`) validates backend (pytest, ruff, mypy) and frontend (lint, unit tests, Playwright smoke tests) on Ubuntu latest runners.
