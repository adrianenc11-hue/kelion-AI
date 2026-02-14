#!/usr/bin/env node
/**
 * K1 Netlify Web Doctor (single-file)
 * - installs deps (npm ci / npm install)
 * - starts Netlify dev (site + functions) via `npx netlify dev`
 * - probes HTTP endpoints (/, /app.html, /.netlify/functions/*)
 * - optional: runs Playwright E2E if detected
 * - produces proof artifacts: report.md, report.json, doctor.log
 *
 * Requirements:
 * - Node 18+ (fetch built-in)
 *
 * Run:
 *   node k1_netlify_web_doctor.js
 *
 * ENV (optional):
 *   PORT=8888
 *   BASE_URL=http://localhost:8888
 *   START_CMD="npx netlify dev --port 8888"
 *   INSTALL_CMD="npm ci"
 *   PROBE_PATHS="/,/app.html,/health,/.netlify/functions/health,/.netlify/functions/search,/.netlify/functions/chat"
 *   RUN_E2E=1
 *   SKIP_INSTALL=1
 *   SKIP_START=1
 *   TIMEOUT_MS=900000
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const ROOT = process.cwd();
const ART = path.join(ROOT, "artifacts_netlify_doctor");
const LOG = path.join(ART, "doctor.log");
const REPORT_MD = path.join(ART, "report.md");
const REPORT_JSON = path.join(ART, "report.json");

const NOW = new Date().toISOString();
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "900000", 10);

const DEFAULT_PORT = parseInt(process.env.PORT || "8888", 10);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${DEFAULT_PORT}`).replace(/\/+$/, "");

const SKIP_INSTALL = process.env.SKIP_INSTALL === "1";
const SKIP_START = process.env.SKIP_START === "1";
const RUN_E2E = process.env.RUN_E2E === "1";

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
    fs.writeFileSync(p, content, "utf8");
}

function appendLog(line) {
    fs.appendFileSync(LOG, line + "\n", "utf8");
}

function readJsonIfExists(p) {
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function existsAny(...relPaths) {
    return relPaths.some(rp => fs.existsSync(path.join(ROOT, rp)));
}

function shellParse(cmd) {
    // minimal safe splitter: supports quoted strings
    const out = [];
    let cur = "";
    let q = null;
    for (let i = 0; i < cmd.length; i++) {
        const ch = cmd[i];
        if (q) {
            if (ch === q) q = null;
            else cur += ch;
        } else {
            if (ch === "'" || ch === '"') q = ch;
            else if (/\s/.test(ch)) { if (cur) out.push(cur), (cur = ""); }
            else cur += ch;
        }
    }
    if (cur) out.push(cur);
    return out;
}

function withHomeEnv(extraEnv = {}) {
    const env = { ...process.env, ...extraEnv };
    // Fix common CI/runners issues where HOME is not set (Playwright/Netlify CLI can require it)
    if (!env.HOME) env.HOME = env.USERPROFILE || os.homedir();
    if (!env.USERPROFILE && process.platform === "win32") env.USERPROFILE = os.homedir();
    return env;
}

function runCmd(cmd, opts = {}) {
    const startedAt = Date.now();
    const parts = Array.isArray(cmd) ? cmd : shellParse(cmd);
    const bin = parts[0];
    const args = parts.slice(1);

    appendLog(`\n$ ${[bin, ...args].join(" ")}\n`);

    return new Promise((resolve) => {
        const child = cp.spawn(bin, args, {
            cwd: ROOT,
            env: withHomeEnv(opts.env || {}),
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        const killTimer = setTimeout(() => {
            appendLog(`[timeout] killing process after ${opts.timeoutMs ?? TIMEOUT_MS}ms`);
            try { child.kill("SIGKILL"); } catch { }
        }, opts.timeoutMs ?? TIMEOUT_MS);

        child.stdout.on("data", (d) => {
            const s = d.toString();
            stdout += s;
            fs.appendFileSync(LOG, s, "utf8");
        });

        child.stderr.on("data", (d) => {
            const s = d.toString();
            stderr += s;
            fs.appendFileSync(LOG, s, "utf8");
        });

        child.on("close", (code, signal) => {
            clearTimeout(killTimer);
            resolve({
                ok: code === 0,
                code,
                signal,
                ms: Date.now() - startedAt,
                stdout,
                stderr,
                cmd: [bin, ...args].join(" "),
            });
        });
    });
}

async function httpProbe(url) {
    const startedAt = Date.now();
    try {
        const res = await fetch(url, { method: "GET" });
        const txt = await res.text().catch(() => "");
        // Consider reachable if we got ANY HTTP status (even 404/405). Unreachable is network error.
        const reachable = res.status >= 100 && res.status < 600;
        return {
            ok: reachable,
            status: res.status,
            ms: Date.now() - startedAt,
            bytes: txt.length,
            sample: txt.slice(0, 500),
        };
    } catch (e) {
        return { ok: false, error: String(e), ms: Date.now() - startedAt };
    }
}

async function waitForServer(baseUrl, tries = 60, delayMs = 1000) {
    for (let i = 0; i < tries; i++) {
        const r = await httpProbe(baseUrl + "/");
        if (r.ok) return { ok: true, attempt: i + 1, last: r };
        await new Promise(res => setTimeout(res, delayMs));
    }
    return { ok: false };
}

function detectInstallCmd() {
    if (process.env.INSTALL_CMD) return process.env.INSTALL_CMD;
    const hasPkgLock = fs.existsSync(path.join(ROOT, "package-lock.json"));
    return hasPkgLock ? "npm ci" : "npm install";
}

function detectNetlifyStartCmd(port) {
    if (process.env.START_CMD) return process.env.START_CMD;
    // Netlify: prefer `npx netlify dev --port <port> --offline`
    // --offline prevents plugin download/install that crashes on Windows (algolia tsc issue)
    return `npx netlify dev --port ${port} --offline`;
}

function detectProjectScripts(pkg) {
    const scripts = (pkg && pkg.scripts) || {};
    const has = (k) => typeof scripts[k] === "string" && scripts[k].trim().length > 0;

    // Optional steps (only if present)
    const lint = has("lint") ? "npm run lint" : null;
    const typecheck = has("typecheck") ? "npm run typecheck" : null;
    const test = has("test") ? "npm test" : null;
    const build = has("build") ? "npm run build" : null;

    // E2E
    const e2e =
        (has("test:e2e") ? "npm run test:e2e" : null) ||
        (has("e2e") ? "npm run e2e" : null) ||
        (has("playwright") ? "npm run playwright" : null);

    return { lint, typecheck, test, build, e2e };
}

function defaultProbePaths() {
    // Safe defaults for Netlify apps + functions
    return [
        "/",
        "/app.html",
        "/health",
        "/.netlify/functions/health",
        "/.netlify/functions/search",
        "/.netlify/functions/chat",
        "/.netlify/functions/realtime-token",
        "/.netlify/functions/vision",
    ];
}

function getProbePaths() {
    if (process.env.PROBE_PATHS) {
        return process.env.PROBE_PATHS.split(",").map(s => s.trim()).filter(Boolean);
    }
    return defaultProbePaths();
}

function makeArtifactsList() {
    return [
        "artifacts_netlify_doctor/doctor.log",
        "artifacts_netlify_doctor/report.md",
        "artifacts_netlify_doctor/report.json",
    ];
}

function summarizeFailureHints(results) {
    const hints = [];
    const logTxt = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8") : "";

    if (/netlify: not found|is not recognized|command not found/i.test(logTxt)) {
        hints.push("Netlify CLI not found. Add it as devDependency: `npm i -D netlify-cli`, then rerun.");
    }
    if (/You are not logged in|netlify login/i.test(logTxt)) {
        hints.push("Netlify CLI wants login for some env features. For local dev, prefer .env + netlify.toml; login only if needed.");
    }
    if (/Functions bundling failed|error loading function|lambda/i.test(logTxt)) {
        hints.push("Netlify Functions bundling/loading failed. Check functions directory, dependencies, and Node version compatibility.");
    }
    if (/EADDRINUSE|address already in use/i.test(logTxt)) {
        hints.push(`Port conflict. Change PORT (e.g. PORT=8899) and rerun.`);
    }

    for (const p of results.probes) {
        if (!p.ok) hints.push(`Endpoint unreachable: ${p.url}. Server may not have started or routing/functions config is wrong.`);
    }

    return hints;
}

// ═══════════════════════════════════════════════════════════════
// AUTO-DIAGNOSIS & AUTO-FIX ENGINE
// ═══════════════════════════════════════════════════════════════

const KNOWN_PROBLEMS = [
    // ─── Missing Dependencies ───
    {
        id: "missing_typescript",
        detect: (ctx) => /tsc.*not found|tsc.*not recognized|Cannot find.*tsc/i.test(ctx.logTxt),
        diagnosis: "TypeScript compiler (tsc) not found — needed by Netlify plugins",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Installing TypeScript globally...");
            return ctx.runFix("npm install -g typescript");
        }
    },
    {
        id: "missing_netlify_cli",
        detect: (ctx) => /netlify.*not found|netlify.*not recognized|command not found.*netlify/i.test(ctx.logTxt),
        diagnosis: "Netlify CLI not installed",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Installing netlify-cli as devDependency...");
            return ctx.runFix("npm install -D netlify-cli");
        }
    },
    {
        id: "missing_bcryptjs",
        detect: (ctx) => /Cannot find module.*bcryptjs/i.test(ctx.logTxt),
        diagnosis: "bcryptjs module missing",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Installing bcryptjs...");
            return ctx.runFix("npm install bcryptjs");
        }
    },
    {
        id: "missing_jsonwebtoken",
        detect: (ctx) => /Cannot find module.*jsonwebtoken/i.test(ctx.logTxt),
        diagnosis: "jsonwebtoken module missing",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Installing jsonwebtoken...");
            return ctx.runFix("npm install jsonwebtoken");
        }
    },
    {
        id: "missing_generic_module",
        detect: (ctx) => {
            const m = ctx.logTxt.match(/Cannot find module '([^']+)'/i);
            if (m && !m[1].startsWith(".") && !m[1].startsWith("/")) {
                ctx._missingModule = m[1].split("/")[0]; // get the package name (not path)
                if (ctx._missingModule.startsWith("@")) {
                    const parts = m[1].split("/");
                    ctx._missingModule = parts.slice(0, 2).join("/");
                }
                return true;
            }
            return false;
        },
        diagnosis: (ctx) => `Node module '${ctx._missingModule}' not installed`,
        fix: async (ctx) => {
            ctx.log(`[AUTO-FIX] Installing missing module: ${ctx._missingModule}...`);
            return ctx.runFix(`npm install ${ctx._missingModule}`);
        }
    },

    // ─── Port Conflicts ───
    {
        id: "port_in_use",
        detect: (ctx) => /EADDRINUSE|address already in use/i.test(ctx.logTxt),
        diagnosis: "Port is already in use by another process",
        fix: async (ctx) => {
            ctx.log(`[AUTO-FIX] Killing process on port ${DEFAULT_PORT}...`);
            if (process.platform === "win32") {
                return ctx.runFix(`cmd /c "for /f \\"tokens=5\\" %a in ('netstat -aon ^| findstr :${DEFAULT_PORT}') do taskkill /PID %a /F"`);
            } else {
                return ctx.runFix(`fuser -k ${DEFAULT_PORT}/tcp`);
            }
        }
    },

    // ─── HTTP/Function Errors ───
    {
        id: "function_500",
        detect: (ctx) => ctx.probeResults && ctx.probeResults.some(p => p.status === 500 && p.url.includes("functions")),
        diagnosis: (ctx) => {
            const failing = ctx.probeResults.filter(p => p.status === 500 && p.url.includes("functions"));
            return `Netlify function(s) returning HTTP 500: ${failing.map(p => p.url).join(", ")}`;
        },
        fix: null // Cannot auto-fix function code errors — report for manual review
    },
    {
        id: "missing_page_404",
        detect: (ctx) => ctx.probeResults && ctx.probeResults.some(p => p.status === 404 && !p.url.includes("functions")),
        diagnosis: (ctx) => {
            const missing = ctx.probeResults.filter(p => p.status === 404 && !p.url.includes("functions"));
            return `Pages not found (404): ${missing.map(p => p.url).join(", ")}`;
        },
        fix: null // Cannot auto-create pages — report for manual review
    },

    // ─── Plugin Crashes ───
    {
        id: "algolia_tsc_crash",
        detect: (ctx) => /algolia.*netlify.*plugin.*tsc|tsc.*-b.*ENOENT/i.test(ctx.logTxt),
        diagnosis: "Algolia Netlify plugin crashes because TypeScript is not installed",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Installing TypeScript globally to fix Algolia plugin...");
            return ctx.runFix("npm install -g typescript");
        }
    },

    // ─── Lockfile / npm issues ───
    {
        id: "lockfile_mismatch",
        detect: (ctx) => /npm warn.*overriding|Cannot read properties.*package-lock|npm ERR.*could not resolve/i.test(ctx.logTxt),
        diagnosis: "package-lock.json may be corrupt or mismatched",
        fix: async (ctx) => {
            ctx.log("[AUTO-FIX] Removing lockfile and reinstalling...");
            const lockPath = path.join(ROOT, "package-lock.json");
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
            return ctx.runFix("npm install");
        }
    },

    // ─── Missing env vars (common) ───
    {
        id: "missing_jwt_secret",
        detect: (ctx) => /CRITICAL.*JWT_SECRET.*not set/i.test(ctx.logTxt),
        diagnosis: "JWT_SECRET environment variable is not set — auth functions will fail",
        fix: null // Cannot auto-set secrets — report for manual config
    },
    {
        id: "missing_supabase_url",
        detect: (ctx) => /SUPABASE_URL.*undefined|supabaseUrl.*required/i.test(ctx.logTxt),
        diagnosis: "SUPABASE_URL environment variable is not set — database functions will fail",
        fix: null
    },
];

async function runAutoFix(results) {
    const logTxt = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8") : "";
    const fixes = [];
    const ctx = {
        logTxt,
        probeResults: results.probes,
        log: (msg) => {
            appendLog(msg);
            console.log(msg);
        },
        runFix: async (cmd) => {
            appendLog(`\n[auto-fix-cmd] ${cmd}\n`);
            const r = await runCmd(cmd, { timeoutMs: 120000 });
            return r;
        },
    };

    appendLog("\n" + "═".repeat(60));
    appendLog("AUTO-DIAGNOSIS ENGINE — Scanning for known problems...");
    appendLog("═".repeat(60) + "\n");
    console.log("\n🔬 AUTO-DIAGNOSIS — Scanning for known problems...");

    for (const problem of KNOWN_PROBLEMS) {
        let detected = false;
        try { detected = problem.detect(ctx); } catch { detected = false; }

        if (!detected) continue;

        const diagnosis = typeof problem.diagnosis === "function" ? problem.diagnosis(ctx) : problem.diagnosis;
        appendLog(`[DETECTED] ${problem.id}: ${diagnosis}`);
        console.log(`  🔴 ${diagnosis}`);

        const fixEntry = { id: problem.id, diagnosis, fixApplied: false, fixResult: null };

        if (problem.fix) {
            console.log(`  🔧 Applying auto-fix for: ${problem.id}`);
            try {
                const fixResult = await problem.fix(ctx);
                fixEntry.fixApplied = true;
                fixEntry.fixResult = fixResult ? { ok: fixResult.ok, code: fixResult.code } : { ok: true };
                const emoji = fixResult?.ok !== false ? "✅" : "❌";
                console.log(`  ${emoji} Fix ${fixResult?.ok !== false ? "succeeded" : "failed"}: ${problem.id}`);
                appendLog(`[FIX ${fixResult?.ok !== false ? "OK" : "FAIL"}] ${problem.id}`);
                // Re-read log after fix for subsequent pattern checks
                ctx.logTxt = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8") : "";
            } catch (e) {
                fixEntry.fixApplied = true;
                fixEntry.fixResult = { ok: false, error: String(e) };
                console.log(`  ❌ Fix crashed: ${e.message}`);
                appendLog(`[FIX CRASH] ${problem.id}: ${e.message}`);
            }
        } else {
            console.log(`  ⚠️  No auto-fix available — manual intervention required`);
            appendLog(`[NO AUTO-FIX] ${problem.id}: requires manual intervention`);
        }

        fixes.push(fixEntry);
    }

    if (fixes.length === 0) {
        console.log("  ✅ No known problems detected.");
        appendLog("[AUTO-DIAGNOSIS] No known problems detected.");
    }

    return fixes;
}

async function main() {
    ensureDir(ART);
    writeFile(LOG, `K1 Netlify Web Doctor log\nStarted: ${NOW}\nRoot: ${ROOT}\nBase URL: ${BASE_URL}\n\n`);

    const results = {
        meta: {
            started_at: NOW,
            root: ROOT,
            base_url: BASE_URL,
            node: process.version,
            platform: `${process.platform} ${os.release()}`,
            port: DEFAULT_PORT,
        },
        steps: [],
        probes: [],
        summary: { ok: true, failures: 0 },
        notes_for_ai_fix: [],
        artifacts: makeArtifactsList(),
    };

    const pkgPath = path.join(ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) {
        results.summary.ok = false;
        results.summary.failures++;
        results.notes_for_ai_fix.push("Missing package.json in project root.");
        finalize(results);
        process.exitCode = 2;
        return;
    }

    const pkg = readJsonIfExists(pkgPath);
    const ps = detectProjectScripts(pkg);

    // Quick Netlify footprint check (informational)
    const looksNetlify =
        existsAny("netlify.toml", "netlify/functions") ||
        existsAny(".netlify/functions") ||
        existsAny("functions");

    results.steps.push({
        name: "env",
        ok: true,
        detail: {
            node: process.version,
            base_url: BASE_URL,
            looks_netlify: looksNetlify,
            detected_scripts: ps,
        },
    });

    // Install deps
    if (!SKIP_INSTALL) {
        const installCmd = detectInstallCmd();
        const r = await runCmd(installCmd);
        results.steps.push({ name: "install", ...r, detail: { installCmd } });
        if (!r.ok) {
            results.summary.ok = false;
            results.summary.failures++;
            results.notes_for_ai_fix.push("Dependency install failed. See doctor.log (npm errors / lockfile / peer deps).");
            finalize(results);
            process.exitCode = 3;
            return;
        }
    } else {
        results.steps.push({ name: "install", ok: true, skipped: true, reason: "SKIP_INSTALL=1" });
    }

    // Optional: lint/typecheck/test/build (only if scripts exist)
    for (const step of [
        ["lint", ps.lint],
        ["typecheck", ps.typecheck],
        ["unit_tests", ps.test],
        ["build", ps.build],
    ]) {
        const [name, cmd] = step;
        if (!cmd) {
            results.steps.push({ name, ok: true, skipped: true, reason: "No script in package.json" });
            continue;
        }
        const r = await runCmd(cmd);
        results.steps.push({ name, ...r });
        if (!r.ok) {
            results.summary.ok = false;
            results.summary.failures++;
            results.notes_for_ai_fix.push(`${name} failed. Fix errors shown in doctor.log.`);
            // keep going; still try to start/probe to collect more evidence
        }
    }

    // Start Netlify dev
    let serverProc = null;
    if (!SKIP_START) {
        const startCmd = detectNetlifyStartCmd(DEFAULT_PORT);
        appendLog(`\n[start] launching Netlify dev: ${startCmd}\n`);

        const parts = shellParse(startCmd);
        serverProc = cp.spawn(parts[0], parts.slice(1), {
            cwd: ROOT,
            env: withHomeEnv({ PORT: String(DEFAULT_PORT) }),
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
        });

        serverProc.stdout.on("data", (d) => fs.appendFileSync(LOG, d.toString(), "utf8"));
        serverProc.stderr.on("data", (d) => fs.appendFileSync(LOG, d.toString(), "utf8"));

        const w = await waitForServer(BASE_URL, 80, 1000);
        results.steps.push({ name: "start_netlify_dev", ok: w.ok, detail: { ...w, startCmd } });
        if (!w.ok) {
            results.summary.ok = false;
            results.summary.failures++;
            results.notes_for_ai_fix.push(`Netlify dev did not become reachable at ${BASE_URL}. Check PORT/BASE_URL, netlify.toml, and logs.`);
        }
    } else {
        results.steps.push({ name: "start_netlify_dev", ok: true, skipped: true, reason: "SKIP_START=1 (assume already running)" });
    }

    // Probes
    const probePaths = getProbePaths();
    for (const p of probePaths) {
        const url = p.startsWith("http") ? p : (BASE_URL + (p.startsWith("/") ? p : `/${p}`));
        const r = await httpProbe(url);
        results.probes.push({ url, ...r });

        if (!r.ok) {
            results.summary.ok = false;
            results.summary.failures++;
            results.notes_for_ai_fix.push(`HTTP probe unreachable: ${url} (${r.error || "no response"}).`);
        }
    }

    // Playwright E2E (optional)
    const hasPlaywrightCfg =
        existsAny("playwright.config.ts", "playwright.config.js") ||
        (pkg && pkg.devDependencies && (pkg.devDependencies.playwright || pkg.devDependencies["@playwright/test"])) ||
        (pkg && pkg.dependencies && (pkg.dependencies.playwright || pkg.dependencies["@playwright/test"]));

    const shouldE2E = RUN_E2E || ps.e2e || hasPlaywrightCfg;
    if (shouldE2E) {
        const r1 = await runCmd("npx playwright --version");
        results.steps.push({ name: "playwright_version", ...r1 });

        if (r1.ok) {
            const r2 = await runCmd("npx playwright install", { timeoutMs: TIMEOUT_MS });
            results.steps.push({ name: "playwright_install", ...r2 });

            const e2eCmd = ps.e2e || "npx playwright test";
            const r3 = await runCmd(e2eCmd, { timeoutMs: TIMEOUT_MS, env: { BASE_URL } });
            results.steps.push({ name: "e2e", ...r3 });

            if (!r3.ok) {
                results.summary.ok = false;
                results.summary.failures++;
                results.notes_for_ai_fix.push("E2E failed. Check Playwright output and doctor.log; add trace/screenshots if needed.");
            }
        } else {
            results.steps.push({ name: "e2e", ok: true, skipped: true, reason: "Playwright not detected. Install @playwright/test then rerun." });
        }
    } else {
        results.steps.push({ name: "e2e", ok: true, skipped: true, reason: "No Playwright config/scripts detected" });
    }

    // Stop server
    if (serverProc) {
        appendLog("\n[stop] stopping Netlify dev process\n");
        try { serverProc.kill("SIGTERM"); } catch { }
    }

    // ═══ AUTO-DIAGNOSIS & AUTO-FIX ═══
    const autoFixResults = await runAutoFix(results);
    results.auto_fixes = autoFixResults;

    // Re-probe after fixes to verify repairs
    if (autoFixResults.some(f => f.fixApplied && f.fixResult?.ok)) {
        appendLog("\n[RE-VERIFY] Re-probing endpoints after auto-fixes...\n");
        console.log("\n🔄 Re-probing endpoints after auto-fixes...");
        const reProbes = [];
        for (const p of probePaths) {
            const url = p.startsWith("http") ? p : (BASE_URL + (p.startsWith("/") ? p : `/${p}`));
            const r = await httpProbe(url);
            reProbes.push({ url, ...r });
        }
        results.re_probes = reProbes;

        // Update summary based on re-probes
        const stillBroken = reProbes.filter(p => !p.ok);
        if (stillBroken.length < results.probes.filter(p => !p.ok).length) {
            console.log(`  ✅ Auto-fix improved results: ${stillBroken.length} issues remaining (was ${results.probes.filter(p => !p.ok).length})`);
        }
    }

    // Extra hints from logs
    for (const h of summarizeFailureHints(results)) {
        if (!results.notes_for_ai_fix.includes(h)) results.notes_for_ai_fix.push(h);
    }

    finalize(results);
    process.exitCode = results.summary.ok ? 0 : 1;
}

function finalize(results) {
    // JSON
    writeFile(REPORT_JSON, JSON.stringify(results, null, 2));

    // Markdown report (for humans + AI)
    const lines = [];
    lines.push(`# K1 Netlify Web Doctor Report`);
    lines.push(`- Started: ${results.meta.started_at}`);
    lines.push(`- Root: \`${results.meta.root}\``);
    lines.push(`- Base URL: \`${results.meta.base_url}\``);
    lines.push(`- Port: \`${results.meta.port}\``);
    lines.push(`- Node: \`${results.meta.node}\``);
    lines.push(`- Platform: \`${results.meta.platform}\``);
    lines.push(``);

    lines.push(`## Verdict`);
    lines.push(results.summary.ok ? `✅ PASS` : `❌ FAIL (${results.summary.failures} failure(s))`);
    lines.push(``);

    lines.push(`## Steps`);
    for (const s of results.steps) {
        const status = s.skipped ? "⏭️ SKIP" : (s.ok ? "✅ OK" : "❌ FAIL");
        lines.push(`- ${status} **${s.name}**${s.code !== undefined ? ` (exit=${s.code})` : ""}${s.ms ? ` — ${s.ms}ms` : ""}`);
    }
    lines.push(``);

    lines.push(`## HTTP Probes`);
    for (const p of results.probes) {
        const status = p.ok ? "✅" : "❌";
        const st = (p.status !== undefined) ? `status=${p.status}` : "no status";
        lines.push(`- ${status} ${p.url} — ${st}${p.ms ? ` (${p.ms}ms)` : ""}`);
    }
    lines.push(``);

    // Auto-fixes section
    if (results.auto_fixes && results.auto_fixes.length > 0) {
        lines.push(`## 🔧 Auto-Diagnosis & Fixes`);
        for (const f of results.auto_fixes) {
            const fixStatus = f.fixApplied
                ? (f.fixResult?.ok !== false ? "✅ Fixed" : "❌ Fix failed")
                : "⚠️ Manual fix needed";
            lines.push(`- ${fixStatus} **${f.id}**: ${f.diagnosis}`);
        }
        lines.push(``);
    }

    // Re-probes section
    if (results.re_probes) {
        lines.push(`## 🔄 Re-Probes After Fix`);
        for (const p of results.re_probes) {
            const status = p.ok ? "✅" : "❌";
            const st = (p.status !== undefined) ? `status=${p.status}` : "no status";
            lines.push(`- ${status} ${p.url} — ${st}${p.ms ? ` (${p.ms}ms)` : ""}`);
        }
        lines.push(``);
    }

    lines.push(`## Notes for AI fix`);
    if (!results.notes_for_ai_fix.length) lines.push(`- (none)`);
    else results.notes_for_ai_fix.forEach(n => lines.push(`- ${n}`));
    lines.push(``);

    lines.push(`## Proof Artifacts`);
    for (const a of results.artifacts) lines.push(`- \`${a}\``);
    lines.push(``);
    lines.push(`## Rule (non-negotiable)`);
    lines.push(`AI may claim "fixed" ONLY if re-running this script returns PASS (exit code 0) and probes are reachable.`);
    lines.push(``);

    writeFile(REPORT_MD, lines.join("\n"));
}

main().catch((e) => {
    ensureDir(ART);
    appendLog(`[fatal] ${String(e)}\n`);
    const fail = {
        meta: { started_at: NOW, root: ROOT, base_url: BASE_URL, node: process.version },
        summary: { ok: false, failures: 1 },
        fatal: String(e),
        artifacts: makeArtifactsList(),
    };
    writeFile(REPORT_JSON, JSON.stringify(fail, null, 2));
    writeFile(REPORT_MD, `# K1 Netlify Web Doctor Report\n\n❌ FATAL\n\n${String(e)}\n`);
    process.exitCode = 2;
});
