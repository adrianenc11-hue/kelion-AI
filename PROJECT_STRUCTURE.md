# ⚡ KELION AI — PROJECT KNOWLEDGE BASE & ARCHITECTURE

> **DOCUMENT MASTER — SURSA DE ADEVĂR**
> _Acest fișier conține "memoria" proiectului. Orice AI Agent trebuie să-l citească pentru a înțelege arhitectura, regulile și fluxurile._
> _Actualizat: 13 Feb 2026_

---

## 📂 1. Harta Sistemului

### Frontend (`/public`)

Interfața este pur HTML/JS/CSS, fără framework-uri grele (Vanilla).

* **`landing.html`**: Pagină de prezentare, Login/Register popup, WebGL Hero (Three.js).
* **`app.html`**: **MAIN APP**. Chat interface, 3D Avatar, Voice Input/Output.
* **`admin.html`**: **ADMIN PANEL**. Securizat. Dashboard complet pentru monitorizare.
* **`trading.html`**: Dashboard dedicat pentru Trading Bot.
* **`brain-init.js`**: Inițializează starea clientului, verifică auth.

### Backend (`/netlify/functions`)

Arhitectură Serverless (AWS Lambda via Netlify).

* **CORE AI**: `smart-brain.js` (Orchestrator), `truth-detector.js` (Validator).
* **TRADING**: `trading-bot-scheduler.js` (Cron), `trading-bot-engine.js` (Logic), `trading-memory.js`.
* **SOCIAL**: `messenger-webhook.js` (Meta Integration), `auto-poster.js` (Content Gen), `auto-poster-api.js`.
* **SYSTEM**: `admin-panel.js` (API), `integrity-guard.js` (Security), `usage-limiter.js`.

### Database (Supabase)

PostgreSQL cu extensia `pgvector` pentru AI Memory.

* **Tables**: `users`, `conversations`, `messages`, `memories` (vector), `trades`, `audit_logs`, `ai_usage_log`.

---

## 🧠 2. SMART BRAIN ARCHITECTURE (`smart-brain.js`)

"Creierul" central al aplicației. Nu este doar un wrapper peste OpenAI.

### Fluxul de Procesare

1. **Input Analysis**: `analyzeQuery(query)` determină intenția (Math, Code, Creative, Search, Legal, General).
    * Ex: "Calculați integrala..." -> `Math` -> Route to `Groq` (Llama 3 70B).
    * Ex: "Scrie un cod Python..." -> `Code` -> Route to `Claude Sonnet`.
2. **Emotion Detection**: Analizează tonul utilizatorului (Urgent, Frustrated, Happy, Sad) și ajustează prompt-ul.
3. **RAG (Retrieval)**: Caută context relevant în Pinecone/Supabase și îl atașează la prompt.
4. **Live Info**:
    * `Auto-Search`: Dacă cere știri/fapte recente -> Google Search API via `search-router`.
    * `Auto-Browse`: Dacă conține un URL -> Scrape & Analyze via `browse-live`.
5. **Execution Modes**:
    * **Direct**: Interogare un singur model (cel mai potrivit).
    * **Parallel**: Interogare simultană 6+ modele (`mode: 'parallel'`).
    * **Mesh**: Primary Engine răspunde, Verifier Engine verifică (`mode: 'mesh'`).
    * **Profession**: Activează prompt-uri specializate (System Engineer, Lawyer, Doctor, etc.).

### AI Engine Cascade (Fallback System)

Dacă modelul primar eșuează, trece automat la următorul:

1. **Primary** (ales de `analyzeQuery`, ex: Gemini 2.0).
2. **Fallback** (ex: Groq / Llama 3).
3. **Cascade** (DeepSeek -> Claude -> OpenAI -> Mistral -> Cohere).

---

## 📈 3. TRADING SYSTEM (`trading-bot-scheduler.js`)

Sistem autonom de tranzacționare închis (Paper/Live).

### Ciclu de Operare (Cron 5 min)

1. **Market Awareness**: Știe orarul burselor (London, Frankfurt, NY, Tokyo).
2. **Cycle Execution**: Apelează `execute_cycle` în `trading-bot-engine`.
    * Fetch Market Data (Alpaca API).
    * Analyze Technicals (RSI, MACD, EMA).
    * Decision: BUY / SELL / HOLD.
3. **Alerts**: Notifică utilizatorul/adminul despre tranzacții.
4. **EOD Close (15:55 EST)**:
    * Închide TOATE pozițiile (Day Trading only).
    * Generează raport P&L zilnic.
    * Trimite email cu rezumatul.
5. **Auto-Learning**: Analizează trade-urile zilei și își ajustează parametrii.

---

## 🛡️ 4. INTEGRITY & SECURITY LAYERS

Sistemul de "imunitate" al proiectului.

### Layer 1: Integrity Guard (`integrity-guard.js`)

* Rulează la **fiecare deploy** sau start local.
* Verifică **SHA256 Hash** pentru fișierele critice (`validate-code.js`, teste).
* **Blochează total** execuția dacă detectează modificări neautorizate în fișierele de securitate.
* Folosește un "Vault" (Supabase Secrets) pentru a stoca hash-urile corecte, fallback la `integrity-manifest.json`.

### Layer 2: Code Validation (`validate-code.js`)

* Analiză statică (Linting).
* Interzice: `eval()`, hardcoded secrets, console.log excesiv, sintaxă invalidă.
* **Regulă de Aur**: "Nu modifica testele ca să treacă codul. Repară codul!"

### Layer 3: System Audit (`audit_complete.js`)

* Verifică endpoint-urile API live (Health Check).
* Verifică existența fișierelor critice.
* Simulează request-uri pentru a confirma funcționarea logică.

---

## ⚙️ 5. ADMIN API (`admin-panel.js`)

API-ul din spatele `/admin.html`. Securizat prin verificarea rolului `admin` în DB.

* `traffic`: Statistici vizitatori, pagini, referrers.
* `ai_credits`: Consum tokeni, costuri per user/model.
* `trading_dashboard`: Monitorizare bot live, istoric, P&L.
* `messenger_conversations`: Citire mesaje utilizatori (FB/Insta/TikTok).
* `social_media_post_now`: Postare manuală pe social media.
* `user_requests`: Clasificare topic-uri (ce întreabă userii cel mai des).

---

## 🔄 6. DEPENDENȚE CRITICE

* **Supabase**: Sursa datelor persistente. Fără el, aplicația e "amnezică".
* **Netlify**: Găzduire frontend + Rulare funcții backend.
* **External APIs**:
  * OpenAI / Anthropic / Google / Groq (AI Intelligence).
  * Alpaca Markets (Trading Data & Execution).
  * Meta Graph API (Messenger & Instagram).
  * Pinecone (Vector Database pentru RAG).

---

## ⚠️ REGULI PENTRU AI AGENTS (MANDATORY)

1. **CITEȘTE** `IMPLEMENTATION_STATUS.md` la începutul fiecărei sesiuni.
2. **NU MODIFICA** `integrity-guard.js` sau `validate-code.js` decât dacă ai permisiunea explicită de "System Upgrade".
3. **BACKUP** înainte de orice modificare majoră (folder `.k1_backups`).
4. **TESTEAZĂ** local cu `node validate-code.js` înainte de a propune un cod.
5. **CONFIRMĂ** acțiunile distructive (ștergere, overwrite masiv).
