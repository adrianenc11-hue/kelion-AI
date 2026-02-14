# K1 Netlify Web Doctor Report
- Started: 2026-02-14T05:01:10.090Z
- Root: `C:\Users\adria\Downloads\k new\kelionat_clean`
- Base URL: `https://kelionai.app`
- Port: `8888`
- Node: `v20.11.0`
- Platform: `win32 10.0.26200`

## Verdict
✅ PASS

## Steps
- ✅ OK **env**
- ⏭️ SKIP **install**
- ⏭️ SKIP **lint**
- ⏭️ SKIP **typecheck**
- ⏭️ SKIP **unit_tests**
- ⏭️ SKIP **build**
- ⏭️ SKIP **start_netlify_dev**
- ✅ OK **playwright_version** (exit=0) — 1789ms
- ✅ OK **playwright_install** (exit=0) — 1919ms
- ✅ OK **e2e** (exit=0) — 76147ms

## HTTP Probes
- ✅ https://kelionai.app/ — status=200 (210ms)
- ✅ https://kelionai.app/landing.html — status=200 (40ms)
- ✅ https://kelionai.app/app.html — status=200 (124ms)
- ✅ https://kelionai.app/subscribe.html — status=200 (34ms)
- ✅ https://kelionai.app/chat.html — status=200 (33ms)
- ✅ https://kelionai.app/reset-password.html — status=404 (32ms)
- ✅ https://kelionai.app/verify-email.html — status=404 (38ms)
- ✅ https://kelionai.app/health — status=200 (2095ms)
- ✅ https://kelionai.app/.netlify/functions/health — status=200 (341ms)
- ✅ https://kelionai.app/.netlify/functions/search — status=405 (586ms)
- ✅ https://kelionai.app/.netlify/functions/chat — status=405 (599ms)
- ✅ https://kelionai.app/.netlify/functions/auth-login — status=405 (745ms)
- ✅ https://kelionai.app/.netlify/functions/auth-register — status=405 (814ms)
- ✅ https://kelionai.app/.netlify/functions/auth-forgot-password — status=405 (689ms)
- ✅ https://kelionai.app/.netlify/functions/realtime-token — status=200 (1636ms)
- ✅ https://kelionai.app/.netlify/functions/vision — status=405 (647ms)
- ✅ https://kelionai.app/.netlify/functions/env-check — status=200 (994ms)

## 🔧 Auto-Diagnosis & Fixes
- ⚠️ Manual fix needed **missing_page_404**: Pages not found (404): https://kelionai.app/reset-password.html, https://kelionai.app/verify-email.html

## Notes for AI fix
- (none)

## Proof Artifacts
- `artifacts_netlify_doctor/doctor.log`
- `artifacts_netlify_doctor/report.md`
- `artifacts_netlify_doctor/report.json`

## Rule (non-negotiable)
AI may claim "fixed" ONLY if re-running this script returns PASS (exit code 0) and probes are reachable.
