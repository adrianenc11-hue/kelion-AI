---
description: Validate all code before any deploy or commit
---

# Pre-Deploy Validation Workflow

// turbo-all

1. Run code validation:

```
node validate-code.js
```

1. If validation passes, deploy:

```
netlify deploy --prod
```

1. After deploy, run function tests:

```
node test-functions.js
```

1. Check health endpoint:

```
curl -s https://kelionai.app/api/health
```
