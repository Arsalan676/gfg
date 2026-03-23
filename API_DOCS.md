# Fact & Claim Verification System — API Reference

## Base URL
```
http://localhost:8000
```

---

## Endpoints

### Health Check
`GET /health/`

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-03-24T10:30:00Z"
}
```

---

### Create Verification Job
`POST /api/verify/`

**Request body:**
```json
{ "input_type": "text", "content": "The Eiffel Tower is 330m tall..." }
```
```json
{ "input_type": "url",  "content": "https://example.com/article" }
```

| Field | Type | Rules |
|---|---|---|
| `input_type` | `"text"` \| `"url"` | required |
| `content` | string | 50–50 000 chars; URL must start with `http(s)://` |

**201 Created:**
```json
{ "job_id": "550e8400-e29b-41d4-a716-446655440000", "status": "pending" }
```

**400 Bad Request** — validation errors
**429 Too Many Requests** — rate limit exceeded (10 req / IP / min)

---

### Get Job Detail
`GET /api/jobs/<job_id>/`

**200 OK:**
```json
{
  "id": "550e8400-...",
  "input_type": "text",
  "status": "complete",
  "created_at": "...", "completed_at": "...",
  "claims": [
    {
      "id": 1,
      "claim_text": "The Eiffel Tower is 330m tall",
      "verdict": "true",
      "confidence_score": 0.97,
      "reasoning": "Multiple authoritative sources confirm...",
      "sources": [
        { "url": "...", "title": "...", "content": "...",
          "relevance_score": 0.95, "credibility_score": 0.85 }
      ]
    }
  ],
  "report": {
    "overall_score": 0.91,
    "true_count": 4, "false_count": 0,
    "partially_true_count": 1, "unverifiable_count": 0,
    "ai_text_probability": 0.12,
    "ai_text_indicators": ["Low sentence variance"]
  },
  "image_analyses": [
    {
      "image_url": "https://...",
      "status": "analyzed",
      "is_ai_generated": false,
      "confidence": 0.88,
      "deepfake_probability": 0.04,
      "indicators": []
    }
  ]
}
```

**404 Not Found**

---

### List Jobs
`GET /api/jobs/`

Returns an array of `{ id, input_type, status, created_at, completed_at }` ordered newest first.

---

### Stream Pipeline Events (SSE)
`GET /api/jobs/<job_id>/stream/`

`Content-Type: text/event-stream` — runs the pipeline and streams events in real time.

#### Event types

| Event | Payload |
|---|---|
| `status` | `{ "status": "extracting\|searching\|verifying", "message": "..." }` |
| `claim_extracted` | `{ "claim": "..." }` |
| `evidence_found` | `{ "claim": "...", "source_count": 5 }` |
| `claim_verified` | `{ "claim": "...", "verdict": "true", "confidence_score": 0.97 }` |
| `complete` | AccuracyReport summary dict |
| `error` | `{ "message": "..." }` |

**JavaScript example:**
```js
const es = new EventSource('/api/jobs/<job_id>/stream/');

es.addEventListener('claim_verified', e => {
  const { claim, verdict, confidence_score } = JSON.parse(e.data);
  console.log(`${verdict.toUpperCase()} (${(confidence_score*100).toFixed(0)}%) — ${claim}`);
});

es.addEventListener('complete', e => {
  console.log('Report:', JSON.parse(e.data));
  es.close();
});
```

---

### OpenAPI / Swagger
| URL | Description |
|---|---|
| `GET /api/schema/` | Raw OpenAPI YAML schema |
| `GET /api/docs/` | Interactive Swagger UI |

---

## Verdict values
`true` · `false` · `partially_true` · `unverifiable`

## Job status values
`pending` → `extracting` → `searching` → `verifying` → `complete` / `failed`

## Confidence scores
`0.0–1.0` where ≥ 0.9 = very high, ≥ 0.7 = high, ≥ 0.5 = moderate, < 0.5 = low
