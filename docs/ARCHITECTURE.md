# Architecture — LawGPT

## 1. Services and folder-by-folder purpose

### `frontend/` — React + Vite + Tailwind + shadcn/ui

```
frontend/
├── public/                  static assets
├── src/
│   ├── components/
│   │   ├── ui/               shadcn primitives (button, input, dialog, card, ...)
│   │   ├── layout/            navbar, sidebar, page shell
│   │   ├── auth/               login/register forms
│   │   ├── dashboard/         case list, stats cards, charts (Chart.js)
│   │   ├── upload/              drag-drop uploader, upload progress
│   │   ├── analysis/           summary, timeline, entities, IPC/BNS tags
│   │   ├── chatbot/             chat window, message bubbles
│   │   └── reports/            report preview, download button
│   ├── pages/                one component per route (Landing, Login, Register,
│   │                          Dashboard, Upload, Analysis, SimilarCases, Chatbot,
│   │                          Reports, Profile)
│   ├── context/                AuthContext (JWT + user), CaseContext (active case)
│   ├── hooks/                  useAuth, useCase, useChat, etc.
│   ├── services/                axios instance + one file per API resource
│   ├── utils/                    formatters, constants
│   └── routes/                    route table + ProtectedRoute wrapper
```

### `backend/` — Node.js + Express + MongoDB

```
backend/
├── src/
│   ├── config/          db.js (mongoose connection), env.js
│   ├── models/           User, Document, Case, Report, Chat (Mongoose schemas)
│   ├── controllers/      one per resource — thin, delegate to services
│   ├── routes/           Express routers, mounted in server.js
│   ├── middleware/       auth (JWT verify), error handler, multer upload, rate limit
│   ├── services/         calls into python-ai over REST (axios) + business logic
│   ├── utils/             logger (winston), response helpers
│   └── validators/        express-validator schemas per route
└── logs/                  winston file transport output
```

### `python-ai/` — FastAPI + LangChain + ChromaDB

```
python-ai/
├── app/
│   ├── main.py            FastAPI app, router registration, CORS
│   ├── api/routes/        upload, analysis, similar_cases, arguments,
│   │                       evidence, chat, report — one router per feature
│   ├── core/                config.py (pydantic-settings), logging.py
│   ├── services/
│   │   ├── ocr_service.py           Tesseract for scanned images/PDF pages
│   │   ├── extraction_service.py    PyMuPDF text extraction, docx/txt parsing
│   │   ├── chunking_service.py       LangChain text splitters
│   │   ├── embedding_service.py     BAAI/bge-small-en-v1.5 via sentence-transformers
│   │   ├── vectorstore_service.py    ChromaDB persistence + similarity search
│   │   ├── llm_service.py             Gemini API wrapper (prompt templates)
│   │   ├── rag_service.py            retrieval + prompt assembly, shared by
│   │   │                              analysis / similar-cases / arguments / chat
│   │   ├── analysis_service.py       summary, timeline, entities, IPC/BNS tags
│   │   ├── arguments_service.py      prosecution / defence / risk analysis
│   │   ├── evidence_service.py        weak / medium / strong scoring + rationale
│   │   ├── chat_service.py            grounded Q&A, refuses to answer outside context
│   │   └── report_service.py          ReportLab PDF assembly
│   ├── models/            Pydantic request/response schemas
│   ├── nlp/                spaCy pipeline, IPC↔BNS section reference data
│   └── utils/
├── datasets/judgments/    sample judgment corpus used to seed the RAG index
├── vectorstore/            persisted Chroma index (gitignored, regenerable)
└── reports/                 generated PDF reports (gitignored)
```

## 2. End-to-end pipeline (as specified)

```
Upload → OCR (if image) → Extract text → Clean text → Chunk → Embed
      → Store in vector DB → RAG retrieval → LLM → Structured response
```

Every downstream feature (analysis, similar judgments, arguments, evidence
scoring, chat) is a different **prompt + retrieval strategy** layered on top
of the same chunked, embedded document — which is why `rag_service.py` is
shared rather than duplicated per feature.

## 3. MongoDB collections (sketch — full schemas land in Module 2)

- **Users** — name, email, passwordHash, role, timestamps
- **Documents** — owner, case ref, original filename, storage path, type
  (FIR/complaint/statement/chargesheet/court doc), OCR status, extracted text ref
- **Cases** — owner, title, linked documents, summary, timeline, entities,
  IPC/BNS sections, status
- **Reports** — case ref, generated PDF path, generated-at, version
- **Chats** — case ref, message history (role, content, citedChunks, timestamp)

`python-ai` does **not** talk to MongoDB directly in this design — it's
stateless per request and returns structured JSON that `backend` persists.
That keeps a single source of truth for case data and avoids two services
racing to write the same record. (Worth confirming this is what you want
before Module 2 — the alternative is letting `python-ai` write directly,
which is slightly less latency but muddies the data-ownership boundary.)

## 4. Why this module order

1. **Auth first** — every other route needs a logged-in user; nothing else can
   be demoed without it.
2. **Upload pipeline before analysis** — analysis, RAG, arguments, and chat
   all depend on documents already being chunked and embedded.
3. **Analysis before similar-judgments/arguments/evidence** — those three
   reuse the same retrieval plumbing that analysis proves out first.
4. **Chatbot after analysis** — reuses `rag_service.py` directly; cheap once
   the retrieval path is working.
5. **Report last** — it aggregates everything else, so it should be assembled
   once the other pieces exist and their output shapes are stable.
6. **Polish/logging/error-handling pass at the end** — easier to do once real
   endpoints exist to harden, rather than guessing ahead of time.

Each module is a working vertical slice (backend + AI service + frontend
page), not a horizontal layer — so after every module you have something
demoable, not just isolated code.

## 5. Assumptions made in this scaffold (flag anything you want changed)

- **LLM**: Gemini API as primary (per your spec), with `llm_service.py`
  written so swapping to OpenAI later is a one-file change.
- **Vector DB**: ChromaDB over FAISS — simpler persistence story for a
  student project (no manual index serialization), still swappable.
- **Frontend tooling**: Vite (not CRA) — current standard, fast dev server.
- **Auth token storage**: JWT returned in response body, stored client-side,
  sent as `Authorization: Bearer <token>`. Simpler to demo than httpOnly
  cookies + CSRF handling; worth revisiting if your evaluators care about
  production-grade auth hardening.
- **MongoDB**: local instance by default via `MONGO_URI` in `.env`; swapping
  to Atlas is just changing that one string.
- **Language parameter (added after the frontend went multi-language)**:
  every `python-ai` request schema from Module 3 onward should accept a
  `language: Literal['en', 'kn']` field, threaded through from the
  frontend's current i18n language, so AI responses can eventually come
  back in the user's chosen language. Not implemented yet — python-ai has
  no endpoints until Module 3 — but the schemas should be designed with
  this from the start rather than bolted on later.

## 6. A note for the viva

Evaluators for a project like this usually poke at the pipeline, not just
the UI — "why Chroma over FAISS," "how do you stop the chatbot from
hallucinating outside the case documents," "what happens if OCR fails." It's
worth actually tracing through each module as we build it so you can answer
those live, rather than only at demo time.
