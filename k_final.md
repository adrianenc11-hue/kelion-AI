# K FINAL — Documentație Completă Unificată

**Proiect:** Kelion AI — kelionai.app
**Data documentului:** 12 Februarie 2026, 20:37 (actualizat)
**Locație:** `C:\Users\adria\Downloads\k new\kelionat_clean\`

---

## 1. STRUCTURA PROIECT

```
kelionat_clean/
├── public/                    # 18 pagini HTML + assets
│   ├── components/            # 48 componente frontend JS
│   ├── config/                # Configurări
│   ├── images/                # Imagini
│   ├── models/                # Modele 3D
│   └── Realistic_Male_Head_3D_Model_Animated_with_Facial_Expressions/
├── netlify/
│   └── functions/             # 138 funcții backend (Netlify Functions)
├── supabase/
│   └── migrations/            # 14 migrații SQL
├── trading-bot/               # Bot trading (1 fișier)
├── scripts/                   # 2 setup scripts
├── tests/                     # 2 test files (Playwright)
├── .k1_backups/               # Backup-uri automate
└── 14 root scripts            # Validare, audit, migrare
```

---

## 2. PAGINI HTML (18 pagini)

| # | Pagină | Dimensiune | Ce face |
|---|--------|-----------|---------|
| 1 | `landing.html` | 70 KB | Prima pagină — prezentare, avatar selection, pricing, sponsors |
| 2 | `app.html` | 254 KB | Aplicația principală — hologramă 3D, chat voice, GPS, weather, maps |
| 3 | `chat.html` | 118 KB | Chat avansat — professions (avocat, profesor, etc.), documents |
| 4 | `subscribe.html` | 41 KB | Login + Showcase funcții (stânga=marketing, dreapta=login) |
| 5 | `admin.html` | 40 KB | Panel admin — 5 tab-uri (Overview, Trafic, AI Credits, Trading, Messengers) |
| 6 | `trading.html` | 35 KB | Trading dashboard — Alpaca paper trading, charts |
| 7 | `developers.html` | 48 KB | Portal dezvoltatori — API docs, SDK |
| 8 | `brain-map.html` | 39 KB | Flow Tracer — vizualizare traseu AI real-time din Supabase |
| 9 | `marketing.html` | 35 KB | Pagina marketing |
| 10 | `premium.html` | 32 KB | Planuri premium |
| 11 | `avatar-demo.html` | 28 KB | Demo avatar 3D |
| 12 | `gdpr.html` | 27 KB | GDPR compliance |
| 13 | `privacy.html` | 21 KB | Politica de confidențialitate |
| 14 | `account.html` | 19 KB | Cont utilizator — setări, profil |
| 15 | `terms.html` | 14 KB | Termeni și condiții |
| 16 | `cookies.html` | 13 KB | Politica cookies |
| 17 | `k-manager.html` | 11 KB | Manager K |
| 18 | `inspect.html` | 2 KB | Inspector debug |

**Fișiere extra:** `manifest.json`, `sw.js` (PWA), `favicon.ico`, `robots.txt`, `sitemap.xml`, `_redirects`, `tiktokd9...txt`

---

## 3. FUNCȚII BACKEND — 138 Netlify Functions

### 🤖 AI & Chat (15)

| Funcție | Ce face |
|---------|---------|
| `chat.js` | Chat principal — orchestrare AI, trace-uri, session management |
| `smart-brain.js` | Cascadă AI (GPT-4o → Gemini → DeepSeek), professions, tools |
| `deepseek.js` | DeepSeek AI engine |
| `claude-orchestrator.js` | Claude AI orchestrator |
| `claude-audit.js` | Claude audit cod |
| `neurai-ai.js` | NeurAI engine |
| `deep-research.js` | Cercetare profundă AI |
| `code-interpreter.js` | Interpretor cod (E2B sandbox) |
| `story-generator.js` | Generator povești |
| `quiz-generator-kids.js` | Quiz-uri pentru copii |
| `age-adapter.js` | Adaptare conținut pe vârstă |
| `brain-memory.js` | Memorie persistentă AI (Supabase) |
| `k-supreme-intelligence.js` | Procesare voce K Supreme |
| `engine-discovery.js` | Descoperire AI engines noi |
| `k-presentation.js` | Generator prezentări |

### 🔐 Autentificare (12)

| Funcție | Ce face |
|---------|---------|
| `auth.js` | Middleware autentificare |
| `auth-login.js` | Login (email+parolă) |
| `auth-register.js` | Înregistrare cont nou |
| `auth-logout.js` | Logout |
| `auth-me.js` | Profil utilizator curent |
| `auth-refresh.js` | Refresh token JWT |
| `auth-verify-email.js` | Verificare email (link 24h) |
| `auth-resend-verification.js` | Retrimite email verificare |
| `auth-forgot-password.js` | Resetare parolă - cerere |
| `auth-reset-password.js` | Resetare parolă - confirmare |
| `check-user.js` | Verifică dacă user există |
| `free-trial.js` | Activare trial gratuit |

### 💰 Trading & Finanțe (12)

| Funcție | Ce face |
|---------|---------|
| `trading-engine.js` | Motor principal trading |
| `trading-alerts.js` | Alerte trading (RO) |
| `trading-memory.js` | Memorie trading (jurnal) |
| `backtesting-engine.js` | Backtesting strategii |
| `order-executor.js` | Executare ordine |
| `portfolio-tracker.js` | Tracker portofoliu |
| `risk-calculator.js` | Calculator risc |
| `chart-generator.js` | Generator grafice |
| `chart-generator-financial.js` | Grafice financiare avansate |
| `crypto-feed.js` | Feed crypto real-time |
| `market-data-feed.js` | Feed date piață |
| `financial-calculator.js` | Calculator financiar |

### 🖼️ Media & Generare (9)

| Funcție | Ce face |
|---------|---------|
| `dalle.js` | Generare imagini DALL-E |
| `generate-image.js` | Generare imagini (alternativ) |
| `stable-diffusion.js` | Stable Diffusion (Stability AI) |
| `image-editor.js` | Editor imagini |
| `audio-editor.js` | Editor audio |
| `video-editor.js` | Editor video |
| `generate-video.js` | Generare video |
| `podcast.js` | Generator podcast |
| `canvas.js` | Canvas drawing AI |

### 📧 Email & Comunicare (7)

| Funcție | Ce face |
|---------|---------|
| `email-alerts.js` | Alerte email (Resend) |
| `email-manager.js` | Manager email |
| `email-webhook.js` | Webhook email inbound |
| `send-email.js` | Trimitere email (welcome, verify) |
| `messenger-webhook.js` | Facebook Messenger webhook |
| `group-chat.js` | Chat de grup |
| `notifications.js` | Sistem notificări |

### 📱 Social Media (4)

| Funcție | Ce face |
|---------|---------|
| `auto-poster.js` | Auto-poster FB principal |
| `auto-poster-api.js` | API management auto-poster |
| `auto-poster-core.js` | Core logic postare |
| `social-share.js` | Sharing social media |

### 🛠️ Utilități & Tools (22)

| Funcție | Ce face |
|---------|---------|
| `web-search.js` | Căutare web (DuckDuckGo fallback) |
| `search.js` | Căutare generală |
| `browse-live.js` | Browse pagini live |
| `currency-converter.js` | Convertor valutar |
| `document-checker.js` | Verificare documente |
| `route-optimizer.js` | Optimizare rute |
| `inventory-tracker.js` | Tracker inventar |
| `booking-system.js` | Sistem rezervări |
| `calendar.js` | Calendar |
| `language-processor.js` | Procesor limbă |
| `i18n.js` | Internaționalizare |
| `export-document.js` | Export documente (PDF/HTML/TXT/MD) |
| `file-upload.js` | Upload fișiere |
| `maps-config.js` | Configurare Google Maps |
| `get-weather.js` | Date meteo |
| `lullaby-generator.js` | Generator melodii leagăn |
| `cry-detector.js` | Detector plâns bebeluș |
| `baby-monitor-mode.js` | Monitor bebeluș |
| `k-analytics.js` | Analytics K |
| `k-strategic-planner.js` | Planner strategic |
| `workout-planner.js` | Planner antrenamente |
| `recipe-calculator.js` | Calculator rețete |

### 📊 Admin & Analytics (10)

| Funcție | Ce face |
|---------|---------|
| `admin-panel.js` | Backend panel admin |
| `admin-notify.js` | Notificări admin |
| `admin-traffic.js` | Trafic admin |
| `analytics-dashboard.js` | Dashboard analytics |
| `audit-log.js` | Log audit |
| `trace-collector.js` | Colector trace-uri AI |
| `page-tracking.js` | Tracking pagini |
| `ab-testing.js` | A/B testing |
| `usage-analytics.js` | Analytics utilizare |
| `cost-tracker.js` | Tracker costuri API |

### 💳 Plăți & Credite (6)

| Funcție | Ce face |
|---------|---------|
| `buy-credits.js` | Cumpărare credite |
| `credit-codes.js` | Coduri credit (redeem) |
| `ai-credits.js` | Management credite AI |
| `api-subscription.js` | Abonamente API |
| `referral.js` | Sistem referral |
| `gdpr-cleanup.js` | Cleanup GDPR date |

### 🔧 Infrastructură (11)

| Funcție | Ce face |
|---------|---------|
| `api-gateway.js` | Gateway API central |
| `api-keys.js` | Management chei API (B2B) |
| `env-check.js` | Verificare variabile mediu |
| `engine-status.js` | Status engines AI |
| `health.js` | Health check |
| `get-porcupine-key.js` | Cheie Porcupine (wake word) |
| `elevenlabs-tts.js` | Text-to-Speech ElevenLabs |
| `vector-store.js` | Vector store (Pinecone) |
| `memory.js` | Memorie utilizatori |
| `webhook-monitor.js` | Monitor webhooks |
| `push-subscribe.js` | Push notifications subscribe |

### 🎤 Voce & Media Avansată (8)

| Funcție | Ce face |
|---------|---------|
| `speech-to-text.js` | Transcriere voce → text |
| `voice-clone.js` | Clonare voce |
| `tts.js` | Text-to-speech generic |
| `translate.js` | Traducere |
| `vision.js` | Analiză imagini (Vision API) |
| `ocr.js` | OCR — text din imagini |
| `qr-scanner.js` | Scanner QR |
| `hologram-chat.js` | Chat hologramă |

### Altele (22 rămase)

`sentiment-analysis.js`, `recipe-engine.js`, `habit-tracker.js`, `learn-topic.js`, `meditation.js`, `journal.js`, `gift-finder.js`, `news-feed.js`, `meme-generator.js`, `virtual-pet.js`, `price-tracker.js`, `interview-prep.js`, `study-planner.js`, `debate-helper.js`, `dream-interpreter.js`, `playlist-generator.js`, `travel-planner.js`, `legal-helper.js`, `resume-builder.js`, `gardening-helper.js`, `home-repair.js`, `pet-care.js`

---

## 4. COMPONENTE FRONTEND — 48 fișiere JS

| Componentă | Ce face |
|------------|---------|
| `realtime-voice.js` | Sistem voce real-time (wake word, VAD, TTS) |
| `task-workspace.js` | Workspace task-uri (maps, navigation) |
| `k-universal-workspace.js` | Workspace universal K |
| `k-workspace-panel.js` | Panel workspace |
| `k-enhanced-chat.js` | Chat enhanced |
| `gemini-live-voice.js` | Gemini Live Voice |
| `kelion-gps.js` | GPS + locație |
| `kelion-weather.js` | Meteo (Open-Meteo) |
| `kelion-vision.js` | Vision (cameră) |
| `camera-capture.js` | Captură cameră |
| `audio-recorder.js` | Recorder audio |
| `advanced-vad.js` | Voice Activity Detection avansat |
| `wake-word.js` | Wake word detection |
| `face-security.js` | Securitate facială |
| `visual-memory.js` | Memorie vizuală |
| `vision-compliments.js` | Complimente vizuale |
| `mediapipe-gestures.js` | Gesturi MediaPipe |
| `smart-functions.js` | Funcții smart |
| `tool-library.js` | Bibliotecă tools |
| `k-brain-monitor.js` | Monitor creier K |
| `k-multitask.js` | Multitasking K |
| `k-onboarding.js` | Onboarding utilizator |
| `k-presentation-workspace.js` | Workspace prezentări |
| `k-referral-teletext.js` | Teletext referral |
| `k-qrcode.js` | Generator QR |
| `k-keywords.js` | Keywords K |
| `k-dev-tools.js` | Dev tools K |
| `k1-client.js` | Client K1 |
| `conversion-engine.js` | Motor conversie |
| `subscription.js` | Management subscripții |
| `cookie-banner.js` | Banner cookies |
| `ai-disclosure.js` | Disclosure AI |
| `age-gate.js` | Gate vârstă |
| `gdpr-contact.js` | Contact GDPR |
| `tracking.js` | Tracking vizitatori |
| `file-upload.js` | Upload fișiere frontend |
| `file-browser.js` | Browser fișiere |
| `browser-viewer.js` | Viewer browser |
| `screen-share.js` | Screen sharing |
| `download-buttons.js` | Butoane download |
| `code-detector.js` | Detector cod |
| `task-manager.js` | Manager task-uri |
| `language-learning.js` | Învățare limbi |
| `ambient-sound.js` | Sunete ambient |
| `version-badge.js` | Badge versiune |
| `evolution-dashboard.js` | Dashboard evoluție |
| `agent-dashboard.js` | Dashboard agent |
| `chrome-extension-control.js` | Control extensie Chrome |

---

## 5. MIGRAȚII SQL — 14 fișiere

| # | Fișier | Ce creează |
|---|--------|-----------|
| 1 | `app-secrets-migration.sql` | Tabel `app_secrets` (vault) |
| 2 | `audit-migration.sql` | Tabele audit |
| 3 | `k-agent-schema.sql` | Schema agent K |
| 4 | `create_ai_trace.sql` | Tabel `ai_trace` (flow tracer) |
| 5 | `create_audit_and_pageviews.sql` | Tabele `audit_log` + `page_views` |
| 6 | `create_credit_codes.sql` | Tabel `credit_codes` |
| 7 | `create_email_and_ab.sql` | Tabele email + A/B testing |
| 8 | `create_inbound_emails.sql` | Tabel `inbound_emails` |
| 9 | `create_messenger_logs.sql` | Tabel `messenger_logs` |
| 10 | `create_push_and_webhooks.sql` | Tabele push + webhooks |
| 11 | `create_referrals.sql` | Tabel `referrals` |
| 12 | `create_trading_bot.sql` | Tabele trading bot complet |
| 13 | `fix_page_views_columns.sql` | Fix coloane `page_views` |
| 14 | `k1_audit_analytics_full.sql` | Audit + analytics complet |

---

## 6. SCRIPTURI ROOT — 14 fișiere

| Script | Ce face |
|--------|---------|
| `validate-code.js` | Validare sintaxă JS (138 funcții) |
| `audit_complete.js` | Audit HTTP pe toate endpoint-urile |
| `audit-live.js` | Audit pe site-ul live |
| `validate-fake-data.js` | Detectare date false/placeholder |
| `integrity-guard.js` | Guard integritate cod |
| `_real_test.js` | Test real cu payload-uri corecte |
| `_run_migration.js` | Runner migrații SQL |
| `_check_tables.js` | Verificare tabele Supabase |
| `_truncation_scan.js` | Scan truncări cod |
| `fix-patch-vault.js` | Patch vault secrets |
| `patch-vault.js` | Patch vault |
| `remove-env-vars.js` | Eliminare env vars |
| `review-page.js` | Review pagini |
| `playwright.config.js` | Config Playwright |

---

## 7. TRADING BOT

| Fișier | Ce face |
|--------|---------|
| `trading-bot/bot.js` | Bot principal — EMA, RSI, MACD, circuit breakers, multi-market |

---

## 8. TESTE

| Fișier | Ce face |
|--------|---------|
| `tests/kelion-full.spec.js` | Test E2E Playwright complet |
| `tests/example.spec.js` | Test exemplu |

---

## 9. CE S-A ADĂUGAT AZI (12 Februarie 2026)

### Sesiunea 1 (7b4e2b41) — ~19:33 → 08:23

- **11 endpoint-uri fixate** (500→200): audit-log, trace-collector, email-alerts, order-executor, analytics-dashboard, web-search, search, engine-status, dalle, generate-image, k-presentation
- **~115 endpoint-uri verificate** funcționale
- **Custom Profession Creator** — meserii custom în chat
- **review_notes.md** — Plan master 93 puncte / 6 etape

### Sesiunea 2 (8168f575) — 08:29 → 10:47

- **5 tabele DB create:** page_views fix, brain_memory, user_memories, vector-store update, maps-config
- **Custom Professions** implementat complet (frontend + backend)
- **Podcast** — adăugat status action

### Sesiunea 3 (ca1c7d14) — 12:05 → 17:14

- **Subscribe.html** → doar Login (41KB, -19KB)
- **Showcase** funcții în panoul stâng
- **PayPal** setup (credentials din vault)
- **Trading Bot complet:** Alpaca API, multi-market (London, Frankfurt, US, Tokyo), EOD close, daily report, recommendations DB
- **Email system:** welcome email (Resend), CC admin, verify link 24h, refund policy
- **TikTok:** domain verified, URL prefix, products, form 7/8 complete
- **Facebook:** blocat (Meta email verification)
- **credit-codes.js** — funcție nouă
- **ab-testing.js** — funcție nouă

### Sesiunea 4 (4a6092ba) — 17:15 → 17:30

- **app.html** — investigat `${destination}` → NU e bug, e template literal JS valid în handler `isNavigationRequest`
- **app.html** — investigat avatar 3D → fallback brain emoji cauza: model path CORS pe CDN extern
- **app.html** — verificat ticker text afișat în română

### Sesiunea 5 (098c1fab) — 17:31 → 18:08

- **landing.html** — investigat avatar display (blazon vs. față reală)
- **k_final.md** — creat documentație completă unificată (479 linii)
- **comparison_report.md** — raport comparație 8 Feb vs 12 Feb

### Sesiunea 6 (edadc64d) — 20:00 → 20:37

- **subscribe.html** — eliminat formularul de signup (50 linii HTML + 76 linii JS)
- **subscribe.html** — eliminat linkul "Create one now" → acum e DOAR LOGIN ✅
- **subscribe.html** — verificat vizual în browser: Email + Password + Log In + Google + credit code
- **landing.html** — verificat nav: doar "Get started" (linkul Login NU mai există) ✅
- **app.html** — verificat `${destination}`: e template literal JS valid, NU e bug ✅
- **IMPLEMENTATION_STATUS.md** — marcat Etapa 2 punkt 3 ca [x] completat
- **Backup** salvat în `.k1_backups/subscribe.html.bak_20260212_*`

### Sesiunea 7 (d5b3084a) — 22:00 → 23:01

- **Avatar 3D compresie:** `k-female.glb` 34MB→7.1MB (−79%), `k-male.glb` 32MB→5.5MB (−83%) cu gltf-transform Draco+WebP
- **Eyebrow fix:** offset `0.0008`→`0.002` + `polygonOffset` + `renderOrder` pentru sprânceana dreaptă Kira
- **Stripe 6 planuri create LIVE** și salvate în Supabase vault:
  - `STRIPE_PRICE_MONTHLY` = `price_1T08tbE0lEIhKK8ioYWSpsna` (£15/mo)
  - `STRIPE_PRICE_ANNUAL` = `price_1T08tcE0lEIhKK8ipYWVwCyb` (£100/yr)
  - `STRIPE_PRICE_FAMILY_MONTHLY` = `price_1T08tcE0lEIhKK8ivaVhtrhp` (£25/mo)
  - `STRIPE_PRICE_FAMILY_ANNUAL` = `price_1T08tcE0lEIhKK8iK6yekEx9` (£180/yr)
  - `STRIPE_PRICE_BUSINESS_MONTHLY` = `price_1T08tdE0lEIhKK8iiHKYPAwj` (£99/mo)
  - `STRIPE_PRICE_BUSINESS_ANNUAL` = `price_1T08tdE0lEIhKK8ipQqEbv8c` (£800/yr)
- **Stripe Product ID:** `prod_Ty533aNLEZTKPT`
- **PayPal confirmat LIVE:** 8 planuri active, 7 produse
- **TikTok DNS:** TXT record propagat, gata de verificare pe portal
- **Audit live:** 136/136 OK, 0 fail, 54 chei vault
- **Monitor avatari:** Playwright + GitHub Actions (hourly)
- **Anti-minciună model router:** `tools/anti-minciuna/model_router.mjs`

---

## 10. COMPARAȚIE VECHI (8 Feb) vs NOU (12 Feb)

| Metric | 8 Februarie | 12 Februarie | Diferență |
|--------|------------|-------------|-----------|
| Funcții backend | 128 | 138 | **+10** |
| Pagini HTML | 24 | 18 | -6 (consolidate) |
| Componente frontend | 48 | 48 | = |
| Migrații SQL | ~5 | 14 | **+9** |
| Endpoint-uri broken | ~11 | 0 | **✅ Toate fixate** |
| admin.html | 145 KB | 40 KB | **-105KB** (curățat fake data) |
| subscribe.html | 60 KB | 41 KB | **-19KB** (simplificat) |
| app.html | 233 KB | 254 KB | **+21KB** (features noi) |
| landing.html | 59 KB | 70 KB | **+11KB** (avatar, showcase) |
| chat.html | **NU EXISTA** | 118 KB | **🆕 NOU** |
| brain-map.html | **NU EXISTA** | 39 KB | **🆕 NOU** |
| index.html | 12 KB | **ELIMINAT** | 🗑️ Înlocuit cu landing.html |

### Funcții Noi Adăugate

`ab-testing.js`, `admin-panel.js`, `auto-poster.js`, `auto-poster-api.js`, `auto-poster-core.js`, `brain-memory.js`, `credit-codes.js`, `usage-analytics.js`, `video-editor.js`, `workout-planner.js`

---

## 11. PLAN MASTER — STATUS PE ETAPE (93+ PUNCTE)

### Etapa 1: Landing & App — 36 puncte → ~94% ✅

Toate 36 marcate complete. 2-3 bug-uri recurente rămase (vezi §12).

### Etapa 2: Login & Plăți — 12 puncte → ~85% ✅

- ✅ Subscribe = doar login
- ✅ Showcase stânga
- ✅ Flow: Create Account după avatar
- ✅ PayPal LIVE (8 planuri active, 7 produse)
- ✅ Stripe LIVE (6 planuri create + salvate în vault, Product: prod_Ty533aNLEZTKPT)
- ✅ Meserii: profesor + custom professions
- ✅ TUTOR_UNIVERSAL_RO.md
- ⚠️ Referral tracking incomplet (?ref= URL)
- ❌ API Keys B2B — logic existentă dar netestat

### Etapa 3: Trading — 7 puncte → ~86% ✅

- ✅ Trading deschis, Alpaca conectat, bot complet
- ✅ Multi-market, EMA/RSI/MACD, circuit breakers
- ✅ Daily report, recommendations
- ❌ Admin gateway separată

### Etapa 4: FB & Media — 7 puncte → ~35% ⚠️

- ⚠️ Auto-poster cod complet, neconectat la pagini reale
- ❌ Meta App Review — blocat
- ⚠️ TikTok 90% — lipsește demo video
- ❌ Monitorizare public — parțial

### Etapa 5: Admin Panel — 15 puncte → ~13% ❌

- ✅ HTML 5 tab-uri + backend
- ✅ Supabase connection funcțional (4 useri, 54 vault keys)
- ❌ Zero fake data nerealizat
- ❌ Trafic, credits, trading, messengers — nefuncționale real

### Etapa 6: Avatar Upgrade & Protecție — 16 puncte → 0% ❌

Neatinsă.

---

## 12. PROBLEME RECURENTE — STATUS ACTUALIZAT (20:37)

| # | Bug raportat | Status | Verificare |
|---|-------------|--------|------------|
| 1 | `${destination}` apare raw | ✅ **NU E BUG** — template literal JS valid în funcția de navigație | Verificat cod: `app.html:4034` — backtick string în handler `isNavigationRequest` |
| 2 | Avatar 3D nu se încarcă (🧠 fallback) | ⚠️ **PARȚIAL** — cauza e model path/CORS pe CDN extern | Investigat în sesiunile 4+5, necesită model GLB valid pe CDN |
| 3 | Login button încă în nav | ✅ **REZOLVAT** — nav-ul are doar "Get started" | Verificat HTML: `landing.html:1373` — doar `<a class="signup">Get started</a>` |

### Notă

- Bugurile 1 și 3: confirmate ca neexistente/rezolvate
- Bugul 2: rămâne parțial — avatarul 3D necesită model GLB valid pe CDN + CORS headers
- `validate-code.js` / `audit_complete.js` nu detectează probleme UI
- **Recomandat:** Test Playwright E2E care verifică DOM-ul paginilor

---

## 13. FIȘIERE DOCUMENTAȚIE PROIECT

| Fișier | Ce conține |
|--------|-----------|
| `IMPLEMENTATION_STATUS.md` | Status pe 93 puncte / 6 etape |
| `AI_SERVICES_LIST.md` | Lista serviciilor AI |
| `INTEGRATION_GUIDE.md` | Ghid integrare |
| `K_CLASSIFIED.md` | Informații clasificate K |
| `K_PENSION_ASSISTANT.md` | Asistent pensii |
| `K_PROFESSIONS.md` | Meserii K (53KB, detaliat) |
| `SECRETS_MANAGEMENT.md` | Management secrete |
| `E2B_SETUP.md` | Setup sandbox E2B |
| `BACKUP_REPORT.md` | Raport backup |
| `TUTOR_UNIVERSAL_RO.md` | Tutor cetățenie RO/EU |
| `integrity-manifest.json` | Manifest integritate fișiere |
