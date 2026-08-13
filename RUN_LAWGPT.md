# RUN_LAWGPT.md — Project Operations Guide

How to run the complete LawGPT stack on this machine (Ubuntu/WSL).

> **Verified against the actual repository on 2026-08-13.** Every command in
> this guide was tested live (MongoDB in-memory up, backend `/health` returned
> `200`, python-ai `/health` returned `200`, frontend dev server served
> `HTTP 200`). One important reality check: **MongoDB and Tesseract are NOT
> installed as system services/packages on this machine.** The project has
> been developed and tested with an in-memory MongoDB (`mongodb-memory-server`,
> a real `mongod` binary) and a portable Tesseract binary kept in `/tmp`.
> See §2 and §10 for the exact verified setup.

---

## Quick start (complete run)

```bash
# ── Terminal 1 — MongoDB (in-memory, real mongod binary) ─────────────
cd /tmp/opencode/mongo-test
node start.js
# → prints  MONGO_URI=mongodb://127.0.0.1:PORT/
#   copy that MONGO_URI value; you need it for the backend below.
#   (If /tmp/opencode is gone after a reboot, see §9 "MongoDB".)

# ── Terminal 2 — Backend ─────────────────────────────────────────────
cd ~/LawGPT/backend
cp .env.example .env        # first time only; set JWT secrets, MONGO_URI
MONGO_URI=mongodb://127.0.0.1:PORT/ npm run dev
# → http://localhost:5000   health: curl http://localhost:5000/health

# ── Terminal 3 — Python AI service ───────────────────────────────────
cd ~/LawGPT/python-ai
cp .env.example .env        # first time only; set GEMINI_API_KEY
export TESSDATA_PREFIX=/tmp/opencode/tess/extracted/usr/share/tesseract-ocr/5/tessdata
export LD_LIBRARY_PATH=/tmp/opencode/tess/extracted/usr/lib/x86_64-linux-gnu
export TESSERACT_CMD=/tmp/opencode/tess/extracted/usr/bin/tesseract
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000   health: curl http://localhost:8000/health

# ── Terminal 4 — Frontend ────────────────────────────────────────────
cd ~/LawGPT/frontend
cp .env.example .env        # first time only
npm run dev
# → http://localhost:5173
```

---

## 1. Prerequisites

Installed and verified on this machine:

| Requirement | Installed version | Notes |
|---|---|---|
| Node.js | **v20.20.2** | Installed via **nvm** (default alias `20`); binary at `~/.nvm/versions/node/v20.20.2/bin/node` |
| npm | **10.8.2** | Ships with nvm-managed Node |
| Python | **3.12.3** | Both system `python3` and the project venv |
| Python venv | **`python-ai/.venv`** (exists, all deps installed) | Activate with `source .venv/bin/activate` |
| MongoDB | **NOT installed as a service** | Project runs on `mongodb-memory-server` (in-memory `mongod` 8.2.6) — see §2 |
| Tesseract OCR | **NOT installed as a package** | Portable Tesseract 5.3.4 used — see §10 |
| Kannada OCR | **`kan.traineddata` present** in the portable tessdata dir | `tesseract --list-langs` → `eng`, `kan` — see §10 |

Other requirements: npm dependencies already installed in
`backend/node_modules` and `frontend/node_modules`; Python deps installed in
`python-ai/.venv`.

### nvm (Node version manager)

Node is managed by nvm. Load it (a new shell) and confirm:

```bash
source ~/.bashrc
nvm current        # v20.20.2
node --version     # v20.20.2
npm --version      # 10.8.2
```

### Environment files

Each service reads a `.env` file (not committed; only `.env.example` exists).
Create them once:

```bash
cp backend/.env.example   backend/.env
cp python-ai/.env.example python-ai/.env
cp frontend/.env.example  frontend/.env
```

Minimum edits: `backend/.env` → JWT secrets + `MONGO_URI`;
`python-ai/.env` → `GEMINI_API_KEY` (only needed for LLM/RAG features, not
for the health check or document pipeline without Gemini).

---

## 2. Start MongoDB

**MongoDB is not installed as a system service on this machine.** There is no
`mongod`/`mongosh` binary, no `/etc/mongod.conf`, and
`sudo service mongod start` fails (`Unit mongod.service could not be found`).

**The verified, project-compatible way to run MongoDB is the in-memory
`mongodb-memory-server` harness used for all Module 4 Phase 1 & 2 testing.** It
spins up a real `mongod` binary (MongoDB 8.2.6, already cached locally) on a
random local port:

```bash
cd /tmp/opencode/mongo-test
node start.js
```

This prints `MONGO_URI=mongodb://127.0.0.1:PORT/` on stdout and keeps the
server alive. Copy that URI — the backend must be started with the same value
(see §3). The data lives in memory and is wiped when the process stops (safe
for development; regenerate Chroma from MongoDB if you ever want it back).

> The harness: `/tmp/opencode/mongo-test/start.js` →
> `MongoMemoryServer.create({ instance: { dbName: 'lawgpt' } })`. The mongod
> binary is cached at
> `/tmp/opencode/mongo-test/node_modules/.cache/mongodb-memory-server/mongod-x64-ubuntu-8.2.6`.

### If you later want a real, persistent MongoDB service (optional)

Not currently installed. The official path on Ubuntu 24.04 is to add the
MongoDB apt repo and install `mongodb-org`, then `sudo systemctl enable --now
mongod`. That is a separate installation step — none of that is set up or
verified on this machine yet, so the in-memory harness above remains the
supported way to run the project today.

---

## 3. Start backend

```bash
cd ~/LawGPT/backend
MONGO_URI=mongodb://127.0.0.1:PORT/ npm run dev
```

- **Command**: `npm run dev` (runs `nodemon src/server.js`, auto-restarts on
  change). Use `npm start` (plain `node src/server.js`) for a no-watch run.
- **Port**: `5000` (from `PORT` in `backend/.env`; default `5000`).
- **MongoDB**: `MONGO_URI` defaults to `mongodb://localhost:27017/lawgpt`, but
  with the in-memory server you must pass the printed URI on the command line
  (as above) or set it in `backend/.env`.
- **AI service URL**: `PYTHON_AI_SERVICE_URL` defaults to
  `http://localhost:8000`.
- **Health check**:
  ```bash
  curl http://localhost:5000/health
  # {"success":true,"message":"LawGPT API is running","env":"development"}
  ```
- The backend also starts the Module 4 document-pipeline worker (polls MongoDB
  for `pending` documents) — that worker needs python-ai running to process
  documents.

---

## 4. Start Python AI service

```bash
cd ~/LawGPT/python-ai
source .venv/bin/activate
export TESSDATA_PREFIX=/tmp/opencode/tess/extracted/usr/share/tesseract-ocr/5/tessdata
export LD_LIBRARY_PATH=/tmp/opencode/tess/extracted/usr/lib/x86_64-linux-gnu
export TESSERACT_CMD=/tmp/opencode/tess/extracted/usr/bin/tesseract
uvicorn app.main:app --reload --port 8000
```

- **cd**: `cd ~/LawGPT/python-ai`
- **Activate venv**: `source .venv/bin/activate` (venv already has every dep
  from `requirements.txt`; binary is `.venv/bin/uvicorn`).
- **Startup command**: `uvicorn app.main:app --reload --port 8000`
- **Port**: `8000` (default from `python-ai/.env` / `app/core/config.py`).
- The three `TESSERACT_*` exports are **required for OCR** because Tesseract is
  a portable binary, not on PATH. You may instead set `TESSERACT_CMD` in
  `python-ai/.env` (then only `TESSDATA_PREFIX` + `LD_LIBRARY_PATH` need
  exporting). See §10.

---

## 5. Start frontend

```bash
cd ~/LawGPT/frontend
npm run dev
```

- **Command**: `npm run dev` (runs `vite`).
- **Port**: `5173` (fixed in `frontend/vite.config.js`).
- **Backend URL**: `VITE_API_BASE_URL` from `frontend/.env` defaults to
  `http://localhost:5000/api`.
- `npm run build` produces the production build in `frontend/dist/`.

---

## 6. Recommended terminal layout

| Terminal | Service | Command (working dir) |
|---|---|---|
| 1 | MongoDB | `node start.js` (`/tmp/opencode/mongo-test`) |
| 2 | Backend | `npm run dev` (`~/LawGPT/backend`) |
| 3 | Python AI | `source .venv/bin/activate && uvicorn app.main:app --reload --port 8000` (`~/LawGPT/python-ai`) |
| 4 | Frontend | `npm run dev` (`~/LawGPT/frontend`) |

---

## 7. Health checks

```bash
# Backend (Terminal 2)
curl http://localhost:5000/health
# {"success":true,"message":"LawGPT API is running","env":"development"}

# Python AI (Terminal 3)
curl http://localhost:8000/health
# {"success":true,"message":"LawGPT AI service is running"}

# Frontend (Terminal 4) — open in browser
# http://localhost:5173
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # 200
```

---

## 8. Stop / restart commands

- **Stop** any of them with `Ctrl+C` in its terminal.
- **Restart** = `Ctrl+C` then re-run the same start command.
- If a background port lingers after `Ctrl+C`:
  ```bash
  lsof -i :5000   # or: ss -ltnp | grep :5000
  kill <PID>
  ```
- MongoDB (in-memory): killing it loses all data in that run — restart it
  with `node start.js` again and re-pass the new `MONGO_URI` to the backend.
- Graceful shutdown of the backend (SIGINT/SIGTERM) stops the document worker
  and closes the HTTP server cleanly.

---

## 9. Common problems

### EADDRINUSE port 5000
Something already holds 5000 (e.g. an old backend). Find and kill it:
```bash
lsof -i :5000          # or ss -ltnp | grep :5000
kill <PID>
```
If it's a stale `node src/server.js`, `pkill -f "node src/server.js"`.

### MongoDB ECONNREFUSED 127.0.0.1:27017
The backend defaults to `mongodb://localhost:27017/lawgpt`, but nothing listens
there — MongoDB is not installed as a service. You must start the in-memory
server (§2) and pass its printed URI:
```bash
# Terminal 1
cd /tmp/opencode/mongo-test && node start.js   # prints MONGO_URI=...
# Terminal 2
cd ~/LawGPT/backend && MONGO_URI=mongodb://127.0.0.1:PORT/ npm run dev
```
If the error persists, confirm the URI actually matches (random port each run).

### `/tmp/opencode` is gone (after reboot / /tmp cleanup)
The MongoDB harness and the portable Tesseract live in `/tmp`, which is wiped
on reboot.
- **MongoDB**: `mongodb-memory-server` will re-download its binary on first
  `node start.js` run (~220 MB) as long as `/tmp/opencode/mongo-test` still
  exists; if the folder is gone, recreate it:
  ```bash
  mkdir -p /tmp/opencode/mongo-test && cd /tmp/opencode/mongo-test
  npm init -y && npm install mongodb-memory-server@^11.2.0
  # create start.js:
  # const { MongoMemoryServer } = require('mongodb-memory-server');
  # (async () => { const m = await MongoMemoryServer.create({ instance: { dbName: 'lawgpt' } });
  #   console.log('MONGO_URI=' + m.getUri()); setInterval(() => {}, 1 << 30); })();
  ```
- **Tesseract**: see §10 — re-extract the portable binary or install
  `tesseract-ocr` + `tesseract-ocr-kan` with apt.

### Python virtual environment
- Venv is at `python-ai/.venv`. Activate: `source .venv/bin/activate`.
- If `uvicorn: command not found`, the venv isn't active — check
  `which uvicorn` and re-activate, or call `.venv/bin/uvicorn` directly.
- If deps are missing: `pip install -r requirements.txt` (inside the venv).
- Do not use system `pip` to install project deps — keep everything in the venv.

### Node / nvm
- Node is provided by nvm; a new shell may not have it loaded. Run
  `source ~/.bashrc` (or `command -v nvm`).
- Wrong version → `nvm install 20 && nvm use 20 && nvm alias default 20`.
- `node: command not found` → the nvm shim isn't on PATH; re-source
  `~/.bashrc` or add nvm's init to `~/.bashrc`.

### Tesseract
- `tesseract: command not found` is **expected** — it is not installed
  system-wide. Use the portable binary and the env exports from §4:
  `TESSERACT_CMD=/tmp/opencode/tess/extracted/usr/bin/tesseract`
  plus `TESSDATA_PREFIX` and `LD_LIBRARY_PATH`.
- If you prefer a system install:
  `sudo apt install -y tesseract-ocr` (this adds `eng`).
- Verification: `tesseract --version` and `tesseract --list-langs`.

### Kannada OCR
- `ocr_lang` in `python-ai/.env` (`OCR_LANG=kan` or `OCR_LANG=kan+eng`).
- Portable setup already includes `kan.traineddata` (§10).
- System install option: `sudo apt install -y tesseract-ocr-kan` then verify
  `tesseract --list-langs` shows `kan`.
- If Kannada text comes back garbled, the traineddata is missing — see §10.

### ChromaDB
- Persistent index lives in `python-ai/vectorstore/` (gitignored, regenerable).
- On startup python-ai imports `chromadb` and `sentence-transformers` (model
  `BAAI/bge-small-en-v1.5`) — first call downloads the embedding model.
- A corrupt/mismatched vectorstore after a version bump:
  stop python-ai, `rm -rf python-ai/vectorstore/*`, restart, and re-run the
  document pipeline (pages are re-embeddable from MongoDB `DocumentPage`
  records).

---

## 10. Kannada OCR setup

- **Language code**: `kan` (correct Tesseract language code for Kannada).
- **Ubuntu package**: `tesseract-ocr-kan` (install with
  `sudo apt install -y tesseract-ocr-kan`).
- **Verification**:
  ```bash
  tesseract --list-langs
  ```
  must list `kan` alongside `eng`.

**Current state on this machine**: Tesseract is a portable build at
`/tmp/opencode/tess/extracted` (version 5.3.4) and **`kan.traineddata` is
already present** — verified:

```bash
export TESSDATA_PREFIX=/tmp/opencode/tess/extracted/usr/share/tesseract-ocr/5/tessdata
export LD_LIBRARY_PATH=/tmp/opencode/tess/extracted/usr/lib/x86_64-linux-gnu
/tmp/opencode/tess/extracted/usr/bin/tesseract --list-langs
# List of available languages ... (2):
#   eng
#   kan
```

To OCR Kannada documents, set in `python-ai/.env`:
```ini
OCR_LANG=kan          # or kan+eng for mixed Kannada+English documents
TESSERACT_CMD=/tmp/opencode/tess/extracted/usr/bin/tesseract
```
and export `TESSDATA_PREFIX` + `LD_LIBRARY_PATH` before starting uvicorn (§4).
If the portable binary disappears (reboot), either re-extract it or install the
system packages `tesseract-ocr` + `tesseract-ocr-kan`.

---

## 11. Important project directories

```
~/LawGPT/
├── backend/                 Express + MongoDB API (port 5000)
│   ├── src/                 server.js, app.js, routes/, controllers/, models/, services/
│   ├── src/config/          db.js, env.js, upload.js
│   ├── uploads/             uploaded case documents (gitignored)
│   ├── logs/                combined.log, error.log
│   └── .env / .env.example
├── python-ai/               FastAPI + LangChain + ChromaDB + Gemini (port 8000)
│   ├── app/                 main.py, api/routes/, core/, models/, services/
│   ├── .venv/               Python virtual environment (Python 3.12.3)
│   ├── vectorstore/         ChromaDB persistent index (gitignored, regenerable)
│   ├── reports/             generated PDF reports (gitignored)
│   └── .env / .env.example
├── frontend/                React + Vite + Tailwind (port 5173)
│   ├── src/                 UI source
│   ├── dist/                production build
│   └── .env / .env.example
├── docs/                    ARCHITECTURE.md, MODULE2_AUTH.md, MODULE3_CASES.md, MODULE4_DOCUMENTS.md
├── PROJECT_MEMORY.md        living project doc, updated each module
└── README.md

/tmp/opencode/               dev harness used for Module 4 testing (ephemeral — wiped on reboot)
├── mongo-test/              mongodb-memory-server (in-memory MongoDB)
└── tess/extracted/          portable Tesseract 5.3.4 + eng/kan traineddata
```

---

## 12. Service summary

| Service | Port | Start command | Health check |
|---|---|---|---|
| MongoDB | random (in-memory) | `cd /tmp/opencode/mongo-test && node start.js` | prints `MONGO_URI=...` |
| Backend | 5000 | `cd ~/LawGPT/backend && npm run dev` | `curl localhost:5000/health` |
| Python AI | 8000 | `cd ~/LawGPT/python-ai && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000` | `curl localhost:8000/health` |
| Frontend | 5173 | `cd ~/LawGPT/frontend && npm run dev` | `curl localhost:5173` → 200 |