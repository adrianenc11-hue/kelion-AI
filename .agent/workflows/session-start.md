---
description: Auto-run at session start - validates code and verifies all systems
---

# Session Start Workflow (Auto-Run)

// turbo-all

1. Validate all code for errors:

```
node validate-code.js
```

1. Run health check on live system:

```
curl -s https://kelionai.app/api/health
```

1. Test all endpoints:

```
node test-functions.js
```

1. Log session start:

```
curl -s -X POST "https://kelionai.app/api/audit-log" -H "Content-Type: application/json" -d "{\"action\":\"session_start\",\"resource\":\"dev_session\"}"
```
