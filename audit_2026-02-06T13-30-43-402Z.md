# K1 Forensic Audit
- time_utc: 2026-02-06T13:30:16.218Z
- base: https://kelionai.app
- timeoutMs: 25000
- authProvided: false

## Summary
- total: 12
- ok_2xx: 7
- needs_input_400: 3
- server_5xx: 2
- other_fail: 0

## 5xx Priority Fix List (proof-based)
- **dalle** (HTTP 500) — SERVER_BUG
  - hint: Unhandled exception in function. Add try/catch + structured error output + check logs.
  - proof: `{"error":"400 Invalid value: '512x512'. Supported values are: '1024x1024', '1024x1792', and '1792x1024'."}`
- **run-migration** (HTTP 503) — DB
  - hint: Database/storage connectivity/config issue (Supabase URL/key, tables, migrations).
  - proof: `{"error":"Database connection failed","message":"getaddrinfo ENOTFOUND db.lqhkqznjdrkuvtpsgwhq.supabase.co","hint":"Check DATABASE_URL format and credentials","config_issue":true}`

## Full Results
### health
- GET https://kelionai.app/.netlify/functions/health
- status: 200 | latency_ms: 1095
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{
  "healthy": true,
  "timestamp": "2026-02-06T13:30:17.187Z",
  "environment": {
    "configured": 7,
    "total": 7,
    "details": {
      "LLM_API_KEY": true,
      "TTS_API_KEY": true,
      "SEARCH_API_KEY": true,
      "DB_URL": true,
      "VECTOR_DB_API_KEY": true,
      "ENCRYPTION_KEY": true,
      "JWT_SIGNING_KEY": true
    }
  },
  "services": {
    "chat": "ready",
    "tts": "ready",
    "search": "ready",
    "memory": "ready",
    "encryption": "ready"
  }
}
```

### realtime-token
- GET https://kelionai.app/.netlify/functions/realtime-token
- status: 200 | latency_ms: 1468
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{"object":"realtime.session","id":"sess_D6GCYHj7R0Wik8erkUYo4","model":"gpt-4o-realtime","modalities":["audio","text"],"instructions":"You are K (Kelion), a friendly AI hologram assistant with a camera.\n\nCURRENT TIME: Friday, 6 February 2026 at 13:30 (UK timezone)\n\nCRITICAL LOCATION RULE:\n- NEVER assume the user is in any specific country or city\n- ALWAYS use ONLY the GPS location data provided to you\n- The user's REAL location is in the system context - USE IT\n- For \"tomorrow\" or future weather, use the SAME GPS location, not a different country\n- ONLY use a different location if the user EXPLICITLY names a city\n\nLOGIC VERIFICATION (CRITICAL):\nYou MUST continuously verify the LOGIC of everything:\n1. TIME AWARENESS: If user says \"good morning\" but it's evening, politely correct them: \"Actually, it's evening now - good evening!\"\n2. REALITY CHECK: Verify facts and statements against known reality\n3. CONSISTENCY: Point out contradictions in what user says (politely)\n4. CONTEXT: Consider time of day, season, location in your responses\n5. Be helpful when correcting - don't be rude, just gently inform\n\nCRITICAL SILENCE RULES:\n1. IGNORE background voices, TV, rad…(truncated)
```

### chat
- POST https://kelionai.app/.netlify/functions/chat
- status: 200 | latency_ms: 1966
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{"choices":[{"message":{"role":"assistant","content":"Hello! How can I help you today? If you have any questions or need assistance with something, feel free to ask."}}],"model":"moonshot-v1-128k","source":"kimi"}
```

### chat-stream
- POST https://kelionai.app/.netlify/functions/chat-stream
- status: 200 | latency_ms: 1735
- json_ok: false | json_error: Unexpected token 'd', "data: {"to"... is not valid JSON
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
data: {"token":"P","fullText":"P"}

data: {"token":"inging","fullText":"Pinging"}

data: {"token":" K","fullText":"Pinging K"}

data: {"token":"1","fullText":"Pinging K1"}

data: {"token":" audit","fullText":"Pinging K1 audit"}

data: {"token":"...","fullText":"Pinging K1 audit..."}

data: {"token":" Please","fullText":"Pinging K1 audit... Please"}

data: {"token":" wait","fullText":"Pinging K1 audit... Please wait"}

data: {"token":".","fullText":"Pinging K1 audit... Please wait."}

data: {"done":true,"fullText":"Pinging K1 audit... Please wait."}


```

### smart-brain
- POST https://kelionai.app/.netlify/functions/smart-brain
- status: 400 | latency_ms: 608
- json_ok: true
- classification: NEEDS_INPUT
- hint: 400: endpoint needs body/params (normal for whisper/vision etc.)
- body_preview:

```
{"error":"Question is required"}
```

### vision-compliment
- POST https://kelionai.app/.netlify/functions/vision-compliment
- status: 200 | latency_ms: 1958
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{"text":"It's great to see you here!"}
```

### memory-cleanup
- POST https://kelionai.app/.netlify/functions/memory-cleanup
- status: 200 | latency_ms: 1063
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{"success":true,"deleted":0,"checked_at":"2026-02-06T13:30:25.642Z","message":"Cleanup complete. Deleted 0 expired memories."}
```

### generate-image
- POST https://kelionai.app/.netlify/functions/generate-image
- status: 200 | latency_ms: 14272
- json_ok: true
- classification: OTHER
- hint: Check response body/headers.
- body_preview:

```
{"success":true,"imageUrl":"https://oaidalleapiprodscus.blob.core.windows.net/private/org-EaCn8ubYI8hJUCzjyTL4roJl/user-CNtfGSOd4lSz1net9nJyXD9Q/img-hWuiMfMs9oQYHMku6yVCi9cQ.png?st=2026-02-06T12%3A30%3A40Z&se=2026-02-06T14%3A30%3A40Z&sp=r&sv=2026-02-06&sr=b&rscd=inline&rsct=image/png&skoid=8eb2c87c-0531-4dab-acb3-b5e2adddce6c&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2026-02-05T23%3A00%3A36Z&ske=2026-02-06T23%3A00%3A36Z&sks=b&skv=2026-02-06&sig=ZD5tKqfOTZhV0pf6xtni1/qk0BGpI8q/M52sAhdv7P4%3D","revisedPrompt":"A visual representation of the K1 audit process. The image includes documents, financial graphs, numerical notations, and a computer screen displaying spreadsheets. The entire scene is showcased in a professional work environment, with a female Caucasian accountant studying the documents and a male South Asian colleague discussing the same with her. The image has a feeling of concentration and focus.","originalPrompt":"K1 audit test image"}
```

### dalle
- POST https://kelionai.app/.netlify/functions/dalle
- status: 500 | latency_ms: 879
- json_ok: true
- classification: SERVER_BUG
- hint: Unhandled exception in function. Add try/catch + structured error output + check logs.
- body_preview:

```
{"error":"400 Invalid value: '512x512'. Supported values are: '1024x1024', '1024x1792', and '1792x1024'."}
```

### run-migration
- POST https://kelionai.app/.netlify/functions/run-migration
- status: 503 | latency_ms: 745
- json_ok: true
- classification: DB
- hint: Database/storage connectivity/config issue (Supabase URL/key, tables, migrations).
- body_preview:

```
{"error":"Database connection failed","message":"getaddrinfo ENOTFOUND db.lqhkqznjdrkuvtpsgwhq.supabase.co","hint":"Check DATABASE_URL format and credentials","config_issue":true}
```

### whisper
- POST https://kelionai.app/.netlify/functions/whisper
- status: 400 | latency_ms: 736
- json_ok: true
- classification: NEEDS_INPUT
- hint: 400: endpoint needs body/params (normal for whisper/vision etc.)
- body_preview:

```
{"error":"Audio data required (base64)"}
```

### vision
- POST https://kelionai.app/.netlify/functions/vision
- status: 400 | latency_ms: 639
- json_ok: true
- classification: NEEDS_INPUT
- hint: 400: endpoint needs body/params (normal for whisper/vision etc.)
- body_preview:

```
{"error":"Image (base64) is required"}
```
