# 🔐 Secrets Management — K Application

## Architecture

All API keys are stored in **Supabase** table `app_secrets`, NOT in Netlify env vars.
Only ~9 critical vars remain in Netlify env (Supabase URL/keys, JWT, Stripe SDK).

```
Netlify env (9 vars)          Supabase app_secrets (44+ keys)
├── SUPABASE_URL              ├── OPENAI_API_KEY
├── SUPABASE_KEY              ├── GEMINI_API_KEY
├── SUPABASE_SERVICE_KEY      ├── ANTHROPIC_API_KEY
├── JWT_SECRET                ├── DEEPSEEK_API_KEY
├── JWT_SIGNING_KEY           ├── GROQ_API_KEY
├── STRIPE_SECRET_KEY         ├── REPLICATE_API_TOKEN
├── STRIPE_WEBHOOK_SECRET     ├── PAYPAL_CLIENT_ID
├── URL                       ├── ... (44+ keys)
└── DATABASE_URL              └── (unlimited growth)
```

## How functions access secrets

Functions use `patchProcessEnv()` from `get-secret.js` to load vault secrets into `process.env`:

```javascript
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    // ...
    try {
        await patchProcessEnv(); // Loads ALL vault secrets into process.env
        // Now process.env.OPENAI_API_KEY works normally
    }
};
```

## Adding a NEW API key

### Step 1: Add to Supabase

Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/lqhkqznjdrkuvtpsgwhq/sql/new) and run:

```sql
INSERT INTO app_secrets (key_name, key_value, category, description)
VALUES ('NEW_KEY_NAME', 'actual-key-value', 'api_key', 'Description of this key')
ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value, updated_at = NOW();
```

**Categories:** `api_key`, `secret`, `payment`, `payment_config`, `oauth`, `admin`, `config`

### Step 2: Use in function

Add `const { patchProcessEnv } = require('./get-secret');` at the top, and `await patchProcessEnv();` in the handler. Then use `process.env.NEW_KEY_NAME` as normal.

### Step 3: Verify

```bash
curl -s -X POST https://kelionai.app/.netlify/functions/get-secret \
  -H "Content-Type: application/json" \
  -d '{"action":"health"}'
```

Should return `{"ok":true,"vault_keys":45,...}` (count increases with each new key).

## Updating an existing key

```sql
UPDATE app_secrets 
SET key_value = 'new-value-here' 
WHERE key_name = 'OPENAI_API_KEY';
```

Or via SQL editor. Changes take effect within 5 minutes (cache TTL).

## Deleting a key

```sql
DELETE FROM app_secrets WHERE key_name = 'OLD_KEY_NAME';
```

## ⚠️ NEVER add to Netlify env

Do NOT add new API keys to Netlify environment variables.
Always use the `app_secrets` table in Supabase instead.
The only exception is if a key is needed at **module load time** (before any async code runs).

## Security

- Table protected by RLS — only `service_role` can read/write
- Keys never exposed via HTTP endpoints
- `get-secret` endpoint only exposes count and health, not values
- Cache invalidates every 5 minutes automatically
