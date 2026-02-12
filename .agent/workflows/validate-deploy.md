---
description: Validate all code before any deploy or commit
---

# Pre-Deploy Validation Workflow

// turbo-all

1. Run integrity guard (5-layer protection — MANDATORY FIRST):

```
node integrity-guard.js
```

1. Run code validation:

```
node validate-code.js
```

1. Run fake data & hardcode audit (blocks deploy if CRITICAL found):

```
node validate-fake-data.js
```

1. If all validations pass (exit code 0), deploy:

```
npx netlify-cli deploy --prod --dir=public --functions=netlify/functions
```

1. After deploy, run live audit:

```
node audit-live.js
```

1. Check health endpoint:

```
curl -s https://kelionai.app/api/health
```

**BLOCARE DEPLOY**: Deploy blocat dacă step 1, 2, sau 3 pică.
**REGULĂ DE AUR**: SE REPARĂ CODUL SURSĂ, NU SE MODIFICĂ TESTELE!
