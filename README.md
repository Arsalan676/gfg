# AI-Powered Fact & Claim Verification System

A production-grade Django backend for autonomous fact-checking using Google Gemini 1.5 Pro, LangChain, and the Tavily search API.

## Features

- **Multi-input** — accepts plain text or a URL
- **Atomic claim extraction** — LLM isolates specific, falsifiable statements
- **Parallel evidence retrieval** — Tavily web search per claim (optional)
- **Chain-of-thought verification** — Gemini reasons over evidence and returns a verdict
- **Real-time SSE streaming** — frontend receives pipeline events as they happen
- **AI text detection** — hybrid LLM + linguistic heuristics (entropy, TTR, variance)
- **Deepfake / AI image detection** — Gemini 1.5 Pro Vision per image (bonus)
- **Structured accuracy report** — overall score, per-verdict counts, citations

---

## Quick start

### 1. Clone & install
```bash
git clone <repo_url> && cd hackfest
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in GEMINI_API_KEY and (optionally) TAVILY_API_KEY
# Generate a secret key:
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

> **TAVILY_API_KEY is optional.** Without it, evidence search is skipped and claims are marked `unverifiable`. The rest of the pipeline (extraction, AI detection, report) still runs.

### 3. Migrate & run
```bash
python manage.py migrate
python manage.py runserver
```

### 4. Test
```bash
# Built-in sample text
python test_pipeline.py

# Custom URL
python test_pipeline.py --url https://www.bbc.com/news/some-article

# Custom text
python test_pipeline.py --text "The Eiffel Tower is 330 meters tall and located in Paris."
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health/` | Health check |
| `POST` | `/api/verify/` | Submit text or URL, returns `job_id` |
| `GET` | `/api/jobs/` | List all jobs |
| `GET` | `/api/jobs/<id>/` | Full job detail + claims + report |
| `GET` | `/api/jobs/<id>/stream/` | SSE pipeline stream |
| `GET` | `/api/schema/` | OpenAPI schema |
| `GET` | `/api/docs/` | Swagger UI |

See [API_DOCS.md](API_DOCS.md) for request/response details and SSE event types.

---

## Architecture

```
POST /api/verify/  →  VerificationJob created
GET  /stream/      →  Pipeline runs inline, yields SSE events

URL input ──► trafilatura / newspaper3k / BS4
                │
                ▼
         Claim Extraction (Gemini)
                │
         ┌──────┴──────┐
         │  parallel   │
         ▼             ▼
   Tavily Search   Tavily Search   (optional)
         │
         ▼
   Claim Verification (Gemini CoT)
         │
         ▼
   AI Text Detection (LLM + heuristics)
         │
         ▼
   AccuracyReport saved to DB
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Django 4.2 + DRF |
| LLM | Google Gemini 1.5 Pro |
| Orchestration | LangChain |
| Search | Tavily Search API *(optional)* |
| Scraping | trafilatura · newspaper3k · BeautifulSoup4 |
| Streaming | Django `StreamingHttpResponse` (native SSE) |
| Database | SQLite (dev) |
| API docs | drf-spectacular (OpenAPI / Swagger) |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Django secret key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `TAVILY_API_KEY` | **No** | Tavily search key — omit to run without evidence search |
| `DEBUG` | No | `True` / `False` (default `True`) |
| `ALLOWED_HOSTS` | No | Comma-separated hosts (default `localhost,127.0.0.1`) |

---

## Project structure

```
hackfest/
├── factcheck_backend/      # Django project config
│   ├── settings.py
│   └── urls.py
├── verifier/               # Main app
│   ├── models.py           # VerificationJob, Claim, AccuracyReport, ImageAnalysis
│   ├── views.py            # API views + SSE stream
│   ├── serializers.py
│   ├── urls.py
│   ├── pipeline.py         # Pipeline orchestrator (SSE generator)
│   ├── ai_detector.py      # AI text detection
│   ├── image_analyzer.py   # Deepfake / AI image detection
│   ├── rate_limiter.py     # In-memory rate limiting
│   ├── middleware.py       # Global exception handler
│   ├── health.py
│   └── agents/
│       ├── claim_extractor.py
│       ├── url_scraper.py
│       ├── evidence_retriever.py   # Tavily (optional)
│       ├── verifier_agent.py
│       ├── report_builder.py
│       └── prompt_templates.py
├── test_pipeline.py        # Integration test script
├── API_DOCS.md
├── requirements.txt
└── manage.py
```

---

## Rate limiting

10 requests per IP per minute. Returns HTTP 429 when exceeded.

## Production notes

- Set `DEBUG=False` and a strong `DJANGO_SECRET_KEY`
- Swap SQLite for PostgreSQL
- Serve with Gunicorn behind Nginx
- Add `ALLOWED_HOSTS` to your domain

---

Built for the hackathon.
