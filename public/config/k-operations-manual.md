# K Operations Manual — Proceduri Administrative

> **Scop:** Acest fișier documentează toate procedurile pe care K trebuie să le știe pentru administrarea platformei Kelion AI. K poate consulta acest manual pentru a ajuta utilizatorul cu orice operațiune DevOps.

---

## 1. 📧 Email Management (Resend API)

### Trimitere email verificare

```javascript
// Endpoint: POST /.netlify/functions/auth-resend-verification
// Body: { "email": "user@example.com" }
// Trimite email cu template Kelion AI branded (dark theme, cyan accent)
// Sender: process.env.RESEND_FROM || 'Kelion AI <onboarding@resend.dev>'
```

### Trimitere alert sistem

```javascript
// Endpoint: POST /.netlify/functions/email-alerts
// Body: { "to": "admin@kelionai.app", "subject": "Alert", "message": "...", "type": "error|warning|info|success" }
// Fiecare tip are culori diferite: error=roșu, warning=galben, info=cyan, success=verde
```

### Resend API Direct

```bash
# Listare domenii
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains

# Adaugare domeniu nou
curl -X POST https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "kelionai.app"}'

# Verificare domeniu
curl -X POST https://api.resend.com/domains/{DOMAIN_ID}/verify \
  -H "Authorization: Bearer $RESEND_API_KEY"

# Status domeniu
curl https://api.resend.com/domains/{DOMAIN_ID} \
  -H "Authorization: Bearer $RESEND_API_KEY"

# Trimitere email direct
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"Kelion AI <onboarding@resend.dev>","to":["dest@email.com"],"subject":"Test","html":"<h1>Hello</h1>"}'
```

### DNS Records necesare pentru domeniu custom

| Record | Host                 | Type | Value                                                      |
| ------ | -------------------- | ---- | ---------------------------------------------------------- |
| DKIM   | `resend._domainkey`  | TXT  | Cheia DKIM din Resend API                                  |
| SPF    | `send`               | MX   | `feedback-smtp.us-east-1.amazonses.com` (priority 10)      |
| SPF    | `send`               | TXT  | `v=spf1 include:amazonses.com ~all`                        |

**Status actual domeniu:** DKIM verified, SPF pending (MX record lipsă din Namecheap UI)

---

## 2. 🔐 GitHub Backup

### Configurare Git

```bash
git config --global credential.helper manager
git config --global user.name "adrianenc11-hue"
git config --global user.email "adrianenc11@gmail.com"
```

### Push cod

```bash
git add -A
git commit -m "Update: descriere modificări"
git push origin main
```

### Repo: adrianenc11-hue/kelion-AI (privat)

- Remote: <https://github.com/adrianenc11-hue/kelion-AI.git>
- Branch: main
- **ATENȚIE:** Înainte de push, scanează secrete:

```powershell
git ls-files | ForEach-Object {
  $c = Get-Content $_ -Raw -ErrorAction SilentlyContinue
  if ($c -match 'AIzaSy|sk-ant-|sk-[a-zA-Z0-9]{30,}|re_[a-zA-Z0-9]{25,}') {
    Write-Host "SECRET: $_"
  }
}
```

### .gitignore important

```text
.env, .env.local, .env.production
node_modules/, .netlify/
test-*.js, k1-*.js, deep-debug.js
audit_complete.js, extracted_js.js
*.bak_*, index_backup.html
.k1_restore_safety/, .k1_backups/
dns_records.txt, temp_request.json
```

---

## 3. 🚀 Netlify Deploy

### Deploy producție

```bash
netlify deploy --prod --message "descriere deploy"
```

### Environment Variables

```bash
# Listare
netlify env:list

# Setare
netlify env:set VARIABLE_NAME "value"

# Ștergere
netlify env:unset VARIABLE_NAME

# Citire directă
netlify env:get VARIABLE_NAME
```

### Variabile obligatorii

| Variabilă | Scop |
| --- | --- |
| `SUPABASE_URL` | URL Supabase project |
| `SUPABASE_SERVICE_KEY` | Service role key (NU anon key) |
| `OPENAI_API_KEY` | GPT-4o, TTS, Whisper, DALL-E |
| `GEMINI_API_KEY` | Gemini 2.0 Flash |
| `DEEPSEEK_API_KEY` | DeepSeek R1 |
| `RESEND_API_KEY` | Email notifications |
| `REPLICATE_API_TOKEN` | Video generation |
| `ELEVENLABS_API_KEY` | Voice synthesis |
| `PAYPAL_CLIENT_ID` | Payments |
| `PAYPAL_SECRET` | Payments |

---

## 4. 🌐 DNS Management

### Registrar: Namecheap

- URL: <https://ap.www.namecheap.com/domains/domaincontrolpanel/kelionai.app/advancedns>
- User: adrianenc11
- Nameservers: dns1.registrar-servers.com, dns2.registrar-servers.com

### Verificare DNS propagare

```bash
# TXT record
nslookup -type=TXT resend._domainkey.kelionai.app 8.8.8.8

# A record
nslookup kelionai.app 8.8.8.8

# MX record
nslookup -type=MX send.kelionai.app 8.8.8.8
```

### Records existente

| Type  | Host               | Value                              |
| ----- | ------------------ | ---------------------------------- |
| A     | @                  | 75.2.60.5                          |
| CNAME | www                | kelionai-app.netlify.app           |
| TXT   | @                  | v=spf1 include:spf.easywp.c...     |
| TXT   | resend._domainkey  | DKIM key (Resend)                  |
| TXT   | send               | v=spf1 include:amazonses.com ~all  |

---

## 5. 💰 Stock Market / Bursă (Planificat)

### API-uri disponibile

| Provider | Free Tier | Paid | Endpoint |
| --- | --- | --- | --- |
| Alpha Vantage | 25 req/zi | $49/mo | `alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=KEY` |
| Finnhub | 60 req/min | $50/mo | `finnhub.io/api/v1/quote?symbol=AAPL&token=KEY` |
| Yahoo Finance | Nelimitat | Free | `query1.finance.yahoo.com/v8/finance/chart/AAPL` |

### Funcționalități planificate

- Prețuri live acțiuni (real-time/delayed 15min)
- Portofoliu tracking cu P&L
- Alerte voice ("Tesla a crescut 5%!")
- Grafice interactive (candlestick, line)
- AI predictions bazate pe trend analysis

---

## 6. 🔍 Audit & Health Check

### Verificare toate endpointurile

```bash
curl -s -o NUL -w "%{http_code}" https://kelionai.app/.netlify/functions/health-check
curl -s -o NUL -w "%{http_code}" https://kelionai.app/.netlify/functions/smart-brain
curl -s -o NUL -w "%{http_code}" https://kelionai.app/.netlify/functions/auth-login
```

### Verificare completă

```bash
# Toate funcțiile (405 = corect pentru POST-only endpoints)
Get-ChildItem netlify/functions/*.js | ForEach-Object {
  $name = $_.BaseName
  $code = (curl -s -o NUL -w "%{http_code}" "https://kelionai.app/.netlify/functions/$name")
  Write-Host "$name : $code"
}
```

---

## 7. 📊 Supabase Management

### Tabele principale

- `users` — conturi utilizatori
- `api_keys` — chei API dezvoltatori
- `api_key_usage` — tracking folosire API
- `admin_notifications` — notificări admin panel
- `email_verifications` — tokenuri verificare email
- `user_memories` — memorii K per user

### Migrări SQL

```bash
# Workflow salvat: .agent/workflows/supabase-sql.md
# Conectare: Supabase Dashboard > SQL Editor
```

---

## 8. 🛡️ Security Checklist

- [ ] Nu hardcoda secrete — folosește `process.env`
- [ ] Scanează fișiere înainte de git push
- [ ] CORS strict — doar `https://kelionai.app`
- [ ] Rate limiting — 60 req/min per API key
- [ ] Input validation — reject 400 cu field errors
- [ ] Secrets doar server-side — clientul primește doar tokens
- [ ] Backup înainte de orice modificare majoră
