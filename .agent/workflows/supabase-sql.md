---
description: How to run SQL migrations on Supabase directly from CLI
---

# Run Supabase SQL Migration

## Prerequisites

- `npx supabase` CLI available
- `DATABASE_URL` env var set in Netlify (postgresql://postgres:...)
- Working dir: `C:\Users\adria\Downloads\k new\kelionat_clean`

## Steps

### 1. Write SQL to temp file

// turbo

```powershell
@"
YOUR SQL HERE
"@ | Out-File -FilePath "C:\Users\adria\Downloads\k new\kelionat_clean\temp_migration.sql" -Encoding utf8
```

### 2. Get DATABASE_URL and execute SQL

// turbo

```powershell
Get-Content "C:\Users\adria\Downloads\k new\kelionat_clean\temp_migration.sql" | npx -y supabase db execute --db-url (netlify env:get DATABASE_URL 2>&1 | Where-Object { $_ -match '^postgres' } | Select-Object -First 1).ToString().Trim() 2>&1
```

> No output = DDL success. Errors will be printed.

### 3. Verify table exists (via admin-notify or curl)

// turbo

```powershell
curl -s -X POST https://kelionai.app/.netlify/functions/admin-notify -H "Content-Type: application/json" -d '{"action":"get_notifications"}' 2>&1
```

### 4. Cleanup temp file

// turbo

```powershell
Remove-Item "C:\Users\adria\Downloads\k new\kelionat_clean\temp_migration.sql" -ErrorAction SilentlyContinue
```

## Key Notes

- Supabase project ref: `lqhkqznjdrkuvtpsgwhq`
- Supabase dashboard SQL editor: <https://supabase.com/dashboard/project/lqhkqznjdrkuvtpsgwhq/sql/new>
- Browser method backup: if CLI fails, open SQL editor in browser
- Always use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency
- Always add RLS + policy after table creation
- Always add `git add` the `.sql` file to project for records
