# Task Copilot

A local-only task manager with an AI chat interface that converts messy raw text into structured tasks using a local Ollama language model. No cloud, no auth, everything runs on your machine.

## Features

- Full CRUD task management with search, filtering, and sorting
- Chat interface: paste raw text, AI extracts structured tasks
- Review-before-save: edit proposed tasks before committing
- Tag-based grouping view
- Scheduled (with due date) and unscheduled tasks
- Priority levels: low, medium, high, urgent
- Overdue highlighting
- MongoDB primary DB with automatic TinyDB fallback

## Prerequisites

1. **Python 3.11+** — [python.org](https://www.python.org/downloads/)
2. **Node.js 18+** — [nodejs.org](https://nodejs.org/)
3. **Ollama** — [ollama.com](https://ollama.com/)
   - After installing, pull a model (if you don't already have one):
     ```
     ollama pull phi4-mini:3.8b
     ```
4. **MongoDB** (optional) — [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
   - Not required! The app automatically falls back to TinyDB (local JSON file) if MongoDB isn't installed.

## Quick Start (One Command)

The easiest way — double-click `start.bat` or run:

```powershell
.\start.ps1
```

This automatically:
- Starts Ollama if it isn't running
- Installs Python/npm dependencies if needed
- Seeds demo data on first run
- Launches backend (port 8000) and frontend (port 5173)

To stop everything:
```powershell
.\stop.ps1
```

## Manual Start (Two Terminals)

### Terminal 1: Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

To seed demo data on first run (PowerShell):
```powershell
$env:SEED_DATA="true"; uvicorn app.main:app --reload --port 8000
```

### Terminal 2: Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `DB_NAME` | `taskcopilot` | Database name |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `phi4-mini:3.8b` | Model to use for chat parsing |
| `USE_TINYDB` | `false` | Set to `true` to use TinyDB instead of MongoDB |
| `TINYDB_PATH` | `taskcopilot_db.json` | File path for TinyDB storage |
| `SEED_DATA` | `false` | Set to `true` to seed demo tasks on startup |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tasks` | List tasks (supports `q`, `tag`, `is_complete`, `priority`, `due`, `sort` query params) |
| POST | `/tasks` | Create a task |
| GET | `/tasks/{id}` | Get a single task |
| PATCH | `/tasks/{id}` | Partial update |
| DELETE | `/tasks/{id}` | Delete a task |
| POST | `/chat/parse` | Parse raw text into task proposals |
| POST | `/chat/commit` | Save reviewed proposals as tasks |

### Query parameter details for GET /tasks

- `q` — full-text search across name, description, notes
- `tag` — filter by tag name
- `is_complete` — `true` or `false`
- `priority` — `low`, `medium`, `high`, `urgent`
- `due` — `overdue`, `today`, `upcoming`, `none`
- `sort` — `due_at`, `created_at`, `priority`

## Chat Examples

### Example input:
```
remind me next Tuesday to call the dentist, also buy eggs, milk, and coffee tomorrow morning
```

### Expected parsed proposals:
```json
{
  "proposals": [
    {
      "name": "Call the dentist",
      "description": null,
      "notes": null,
      "tags": ["health", "errands"],
      "due_at": "2026-02-10T09:00:00",
      "priority": "medium",
      "is_complete": false,
      "confidence": 0.8,
      "assumptions": ["Interpreted 'next Tuesday' as 2026-02-10"],
      "requires_user_confirmation": true
    },
    {
      "name": "Buy eggs, milk, and coffee",
      "description": null,
      "notes": null,
      "tags": ["shopping", "groceries"],
      "due_at": "2026-02-07T09:00:00",
      "priority": "medium",
      "is_complete": false,
      "confidence": 0.85,
      "assumptions": ["Interpreted 'tomorrow morning' as 2026-02-07 09:00"],
      "requires_user_confirmation": true
    }
  ],
  "warnings": []
}
```

### Another example:
```
gym 5x/week, read for 30 min daily, URGENT fix the leaky faucet this weekend
```

### Expected proposals:
```json
{
  "proposals": [
    {
      "name": "Go to the gym",
      "description": "5 times per week",
      "tags": ["fitness", "health"],
      "due_at": null,
      "priority": "medium",
      "confidence": 0.7,
      "assumptions": ["Recurring goal — no specific due date set"],
      "requires_user_confirmation": true
    },
    {
      "name": "Read for 30 minutes",
      "description": "Daily reading habit",
      "tags": ["reading", "habits"],
      "due_at": null,
      "priority": "medium",
      "confidence": 0.7,
      "assumptions": ["Recurring goal — no specific due date set"],
      "requires_user_confirmation": true
    },
    {
      "name": "Fix the leaky faucet",
      "tags": ["home", "maintenance"],
      "due_at": "2026-02-08T12:00:00",
      "priority": "urgent",
      "confidence": 0.85,
      "assumptions": ["Interpreted 'this weekend' as Saturday 2026-02-08", "Marked as urgent per user's emphasis"],
      "requires_user_confirmation": true
    }
  ]
}
```

## Project Structure

```
backend/
  app/
    __init__.py
    main.py          # FastAPI app, lifespan, CORS
    settings.py      # Pydantic settings from env vars
    db.py            # MongoDB (Motor) + TinyDB fallback
    models.py        # Pydantic v2 models
    routes_tasks.py  # CRUD endpoints
    routes_chat.py   # Chat parse + commit endpoints
    ollama_client.py # Ollama HTTP client + prompt + validation
    seed.py          # Demo data seeder
  requirements.txt
frontend/
  src/
    main.tsx         # React entry point
    App.tsx          # App shell + routing
    api.ts           # Backend API client
    types.ts         # TypeScript types
    utils.ts         # Date formatting helpers
    styles/
      index.css      # All styles
    components/
      TaskItem.tsx   # Single task row
      TaskModal.tsx  # Create/edit modal
      ProposalCard.tsx # Editable proposal card
    pages/
      TaskDashboard.tsx # Main tasks view with filters
      ChatPage.tsx      # Chat interface
      TagGroupPage.tsx  # Tasks grouped by tag
  package.json
  tsconfig.json
  vite.config.ts     # Vite config with API proxy
  index.html
README.md
```

## Notes

- The frontend proxies `/api/*` requests to `http://localhost:8000` via Vite's dev server, stripping the `/api` prefix. In production, configure your reverse proxy accordingly.
- If MongoDB is not running when the backend starts, it automatically falls back to TinyDB (a JSON file store). This is seamless — no code changes needed.
- The Ollama model must be pulled before first use (`ollama pull llama3.2:3b` or whichever model you configure).
- Chat parsing uses a strict JSON-output prompt. If the model fails to produce valid JSON, the backend retries once with a stricter prompt before returning warnings.
