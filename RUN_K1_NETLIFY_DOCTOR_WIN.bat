@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  RUN_K1_NETLIFY_DOCTOR_WIN.bat
REM  Purpose:
REM   - Runs Netlify Web Doctor on Windows (CMD)
REM   - Produces proof artifacts for AI fixing:
REM       artifacts_netlify_doctor\report.md
REM       artifacts_netlify_doctor\report.json
REM       artifacts_netlify_doctor\doctor.log
REM
REM  Requirements:
REM   - Run this from the project root (where package.json is)
REM   - k1_netlify_web_doctor.js must exist in the project root
REM   - Node 18+ installed
REM
REM  Optional usage:
REM   RUN_K1_NETLIFY_DOCTOR_WIN.bat 8899
REM ============================================================

REM --- Detect project root sanity
if not exist "package.json" (
  echo [ERROR] package.json not found. Run this .bat from the project root folder.
  exit /b 2
)

if not exist "k1_netlify_web_doctor.js" (
  echo [ERROR] k1_netlify_web_doctor.js not found in this folder.
  echo         Put k1_netlify_web_doctor.js in the project root, then re-run.
  exit /b 2
)

REM --- Check Node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH. Install Node 18+ then reopen CMD.
  exit /b 2
)

echo [INFO] Node version:
node -v
echo [INFO] NPM version:
npm -v
echo.

REM --- Port selection
set "PORT=8888"
if not "%~1"=="" set "PORT=%~1"

set "BASE_URL=http://localhost:%PORT%"

REM --- Configure probes (edit if you want)
set "PROBE_PATHS=/,/app.html,/health,/.netlify/functions/health,/.netlify/functions/search,/.netlify/functions/chat,/.netlify/functions/realtime-token,/.netlify/functions/vision"

REM --- Optional: Force E2E (set to 1 if you want)
REM set "RUN_E2E=1"

REM --- Optional: Skip install or skip start if you want
REM set "SKIP_INSTALL=1"
REM set "SKIP_START=1"

echo ============================================================
echo [INFO] Running Netlify Doctor
echo [INFO] PORT=%PORT%
echo [INFO] BASE_URL=%BASE_URL%
echo [INFO] PROBE_PATHS=%PROBE_PATHS%
echo ============================================================
echo.

REM --- Run doctor
set "PORT=%PORT%"
set "BASE_URL=%BASE_URL%"
set "PROBE_PATHS=%PROBE_PATHS%"

node k1_netlify_web_doctor.js
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
echo [RESULT] EXIT_CODE=%EXIT_CODE%
echo ============================================================
echo.

REM --- Validate artifacts existence
set "ART_DIR=artifacts_netlify_doctor"
set "RMD=%ART_DIR%\report.md"
set "RJSON=%ART_DIR%\report.json"
set "RLOG=%ART_DIR%\doctor.log"

if not exist "%ART_DIR%" (
  echo [ERROR] Missing artifacts folder: %ART_DIR%
  echo         The doctor script likely crashed early.
  exit /b %EXIT_CODE%
)

echo [INFO] Artifacts:
if exist "%RMD%"  (echo   - %RMD%)  else (echo   - [MISSING] %RMD%)
if exist "%RJSON%" (echo   - %RJSON%) else (echo   - [MISSING] %RJSON%)
if exist "%RLOG%" (echo   - %RLOG%) else (echo   - [MISSING] %RLOG%)
echo.

REM --- Print quick verdict hint
if exist "%RMD%" (
  findstr /C:"✅ PASS" "%RMD%" >nul 2>nul
  if not errorlevel 1 (
    echo [VERDICT] PASS detected in report.md
  ) else (
    echo [VERDICT] PASS not found in report.md (likely FAIL). Open report.md + doctor.log for details.
  )
) else (
  echo [WARN] report.md missing; open doctor.log.
)

echo.
echo ============================================================
echo [AI RULE] You may claim "FIXED" ONLY if:
echo          - EXIT_CODE=0
echo          - report.md contains "✅ PASS"
echo          - Probes are reachable
echo ============================================================
echo.

REM --- Optionally show last lines of log to help debugging immediately
if exist "%RLOG%" (
  echo [INFO] Last 60 lines of doctor.log:
  echo ------------------------------------------------------------
  powershell -NoProfile -Command "Get-Content -Path '%RLOG%' -Tail 60"
  echo ------------------------------------------------------------
)

exit /b %EXIT_CODE%
