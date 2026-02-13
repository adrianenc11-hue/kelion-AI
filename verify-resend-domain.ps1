# ============================================================================
# Kelion AI — Resend Domain Verification & Switch Script
# Run after DNS records are fully propagated
# ============================================================================

Write-Host "=== KELION AI - DOMAIN VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check DNS propagation
Write-Host "[1/5] Checking DNS propagation..." -ForegroundColor Yellow

Write-Host "  DKIM TXT:"
$dkim = nslookup -type=TXT resend._domainkey.kelionai.app 8.8.8.8 2>&1 | Out-String
if ($dkim -match "DQEBAQUAA4GN") {
    Write-Host "  ✅ DKIM propagated" -ForegroundColor Green
}
else {
    Write-Host "  ❌ DKIM NOT propagated" -ForegroundColor Red
}

Write-Host "  SPF TXT:"
$spf = nslookup -type=TXT send.kelionai.app 8.8.8.8 2>&1 | Out-String
if ($spf -match "amazonses") {
    Write-Host "  ✅ SPF TXT propagated" -ForegroundColor Green
}
else {
    Write-Host "  ❌ SPF TXT NOT propagated" -ForegroundColor Red
}

Write-Host "  SPF MX:"
$mx = nslookup -type=MX send.kelionai.app 8.8.8.8 2>&1 | Out-String
if ($mx -match "feedback-smtp") {
    Write-Host "  ✅ SPF MX propagated" -ForegroundColor Green
}
else {
    Write-Host "  ❌ SPF MX NOT propagated yet" -ForegroundColor Red
}

Write-Host ""

# Step 2: Get API key
Write-Host "[2/5] Getting Resend API key..." -ForegroundColor Yellow
$key = (netlify env:get RESEND_API_KEY 2>&1 | Select-String "re_").ToString().Trim()
if ($key) {
    Write-Host "  ✅ API key found" -ForegroundColor Green
}
else {
    Write-Host "  ❌ No API key!" -ForegroundColor Red
    exit 1
}

# Step 3: Trigger verification
Write-Host "[3/5] Triggering Resend verification..." -ForegroundColor Yellow
$domainId = "6aac08e8-92ff-49fb-bae7-60c0007b332c"
Invoke-RestMethod -Uri "https://api.resend.com/domains/$domainId/verify" -Method POST -Headers @{Authorization = "Bearer $key" } -ContentType "application/json" 2>&1 | Out-Null
Write-Host "  ✅ Verification triggered, waiting 15s..." -ForegroundColor Green
Start-Sleep -Seconds 15

# Step 4: Check status
Write-Host "[4/5] Checking domain status..." -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "https://api.resend.com/domains/$domainId" -Method GET -Headers @{Authorization = "Bearer $key" } -ContentType "application/json" 2>&1
Write-Host "  Domain: $($r.name) — Status: $($r.status)" -ForegroundColor Cyan
foreach ($rec in $r.records) {
    $icon = if ($rec.status -eq "verified") { "✅" } else { "⏳" }
    Write-Host "  $icon $($rec.record) [$($rec.type)]: $($rec.status)"
}
Write-Host ""

# Step 5: Switch sender if verified
if ($r.status -eq "verified") {
    Write-Host "[5/5] Domain VERIFIED! Switching sender..." -ForegroundColor Green
    netlify env:set RESEND_FROM "Kelion AI <noreply@kelionai.app>" 2>&1 | Out-Null
    Write-Host "  ✅ RESEND_FROM set to: Kelion AI <noreply@kelionai.app>" -ForegroundColor Green
    Write-Host ""
    Write-Host "  🚀 Run 'netlify deploy --prod' to apply!" -ForegroundColor Cyan
    
    # Test email
    Write-Host ""
    Write-Host "  Sending test email..." -ForegroundColor Yellow
    $body = '{"from":"Kelion AI <noreply@kelionai.app>","to":["adrianenc11@gmail.com"],"subject":"✅ Domain Verified — Kelion AI","html":"<h1 style=\"color:#00e5ff\">Domain kelionai.app verified!</h1><p>Emailurile se trimit acum de la @kelionai.app</p>"}'
    try {
        $test = Invoke-RestMethod -Uri "https://api.resend.com/emails" -Method POST -Headers @{Authorization = "Bearer $key" } -ContentType "application/json" -Body $body
        Write-Host "  ✅ Test email sent! ID: $($test.id)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Test failed: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "[5/5] Domain NOT yet verified. Run this script again later." -ForegroundColor Yellow
    Write-Host "  Status: $($r.status)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
