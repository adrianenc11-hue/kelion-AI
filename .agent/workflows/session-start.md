---
description: Auto-run at session start - validates code and verifies all systems
---

# Session Start Workflow (Auto-Run)

// turbo-all

1. OBLIGATORIU: Citește IMPLEMENTATION_STATUS.md — lista completă de funcționalități (93+ puncte, 6 etape). Aceasta este sursa de adevăr:

```
cat IMPLEMENTATION_STATUS.md
```

1. Run integrity guard (5-layer — MANDATORY FIRST):

```
node integrity-guard.js
```

1. Validate all code for errors:

```
node validate-code.js
```

1. Run fake data & hardcode audit:

```
node validate-fake-data.js
```

1. Run health check on live system:

```
curl -s https://kelionai.app/api/health
```

1. Log session start:

```
curl -s -X POST "https://kelionai.app/api/audit-log" -H "Content-Type: application/json" -d "{\"action\":\"session_start\",\"resource\":\"dev_session\"}"
```
