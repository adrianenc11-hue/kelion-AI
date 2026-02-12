#!/usr/bin/env node
/**
 * model_router.mjs — Single-file model router + verifier + fallback
 *
 * What it does:
 * - Classifies the task quickly (heuristics).
 * - Routes to the best model/provider for the job (Claude/Gemini/OSS/OpenAI style adapters).
 * - Optionally runs a verifier model to catch mistakes and request corrections.
 * - Retries/fallbacks if a provider fails.
 *
 * Requirements:
 * - Node.js 18+ (for global fetch). Works on Windows/macOS/Linux.
 *
 * Env vars (set only what you use):
 * - ANTHROPIC_API_KEY=...
 * - GOOGLE_API_KEY=...         (Gemini API key)
 * - OPENAI_API_KEY=...         (optional adapter; endpoints may vary by provider config)
 *
 * Usage:
 *   echo "Fix this bug... stacktrace..." | node model_router.mjs
 *   node model_router.mjs --file prompt.txt --verify
 *   node model_router.mjs --json request.json
 *
 * request.json format:
 * {
 *   "prompt": "text...",
 *   "meta": { "need_vision": false, "strict": true, "task_hint": "debug" }
 * }
 */

import fs from "fs";
import path from "path";

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;

function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs(argv) {
    const args = { verify: false, file: null, json: null, out: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--verify") args.verify = true;
        else if (a === "--file") args.file = argv[++i];
        else if (a === "--json") args.json = argv[++i];
        else if (a === "--out") args.out = argv[++i];
    }
    return args;
}

async function readStdin() {
    return await new Promise((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (c) => (data += c));
        process.stdin.on("end", () => resolve(data));
    });
}

function writeLogLine(line, logPath) {
    const s = `[${nowISO()}] ${line}\n`;
    fs.appendFileSync(logPath, s, "utf8");
}

function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
}

/** ---------------------------
 *  Task classification
 *  ---------------------------
 * Cheap, deterministic heuristic classifier.
 * You can expand these rules anytime.
 */
function classifyTask(prompt, meta = {}) {
    const p = (prompt || "").toLowerCase();

    const hasStack = /stack|traceback|exception|error|failed|segfault|panic|exit code/.test(p);
    const hasDeploy = /deploy|ci\/cd|pipeline|railway|netlify|docker|kubernetes|build|release/.test(p);
    const hasSecurity = /security|vulnerability|audit|cve|leak|secret|key|gdpr|pii/.test(p);
    const hasPayments = /stripe|paypal|webhook|payment|checkout|subscription/.test(p);
    const hasDb = /supabase|postgres|sql|rls|policy|migration|schema/.test(p);
    const hasVision = meta.need_vision === true || /image|screenshot|png|jpg|vision|ocr/.test(p);
    const hasWriting = /email|reply|translate|rewrite|cv|letter|complaint/.test(p);

    const isLong = (prompt || "").length > 1800;
    const isStrict = meta.strict === true || /must|mandatory|cannot be skipped|100%|proof|gate/.test(p);

    // Task hint can override
    const hint = (meta.task_hint || "").toLowerCase();
    if (hint) {
        return { kind: hint, strict: isStrict, long: isLong, vision: hasVision };
    }

    // Priority: vision → deep debug/architecture → payments/security → db/admin → writing → general
    if (hasVision) return { kind: "vision", strict: isStrict, long: isLong, vision: true };
    if (hasDeploy || hasStack) return { kind: "debug", strict: isStrict, long: isLong, vision: false };
    if (hasSecurity) return { kind: "security", strict: true, long: isLong, vision: false };
    if (hasPayments) return { kind: "payments", strict: true, long: isLong, vision: false };
    if (hasDb) return { kind: "database", strict: isStrict, long: isLong, vision: false };
    if (hasWriting) return { kind: "writing", strict: false, long: isLong, vision: false };

    return { kind: "general", strict: isStrict, long: isLong, vision: false };
}

/** ---------------------------
 *  Routing policy
 *  ---------------------------
 * Map tasks to models/providers.
 * These are names; adapters below implement calls per provider.
 */
function route(task) {
    // Your “best practice” pairing:
    // - primary = fast+strong
    // - verifier = stricter “thinking” model
    const routes = {
        debug: {
            primary: { provider: "anthropic", model: task.long || task.strict ? "claude-opus-4.6-thinking" : "claude-sonnet-4.5-thinking" },
            verifier: { provider: "anthropic", model: "claude-opus-4.6-thinking" },
        },
        security: {
            primary: { provider: "anthropic", model: "claude-opus-4.6-thinking" },
            verifier: { provider: "anthropic", model: "claude-opus-4.6-thinking" },
        },
        payments: {
            primary: { provider: "anthropic", model: "claude-sonnet-4.5-thinking" },
            verifier: { provider: "anthropic", model: "claude-opus-4.6-thinking" },
        },
        database: {
            primary: { provider: "anthropic", model: task.strict ? "claude-sonnet-4.5-thinking" : "claude-sonnet-4.5" },
            verifier: { provider: "anthropic", model: "claude-sonnet-4.5-thinking" },
        },
        vision: {
            primary: { provider: "google", model: "gemini-3-pro-high" },
            verifier: { provider: "anthropic", model: "claude-sonnet-4.5-thinking" },
        },
        writing: {
            primary: { provider: "google", model: "gemini-3-flash" },
            verifier: { provider: "anthropic", model: "claude-sonnet-4.5" },
        },
        general: {
            primary: { provider: "anthropic", model: task.strict ? "claude-sonnet-4.5-thinking" : "claude-sonnet-4.5" },
            verifier: { provider: "anthropic", model: "claude-sonnet-4.5-thinking" },
        },
    };

    return routes[task.kind] || routes.general;
}

/** ---------------------------
 *  Provider adapters
 *  ---------------------------
 * NOTE: API shapes change over time.
 * If a provider returns an error, we log it and fallback.
 */

async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: c.signal });
        return res;
    } finally {
        clearTimeout(t);
    }
}

function normalizeResponseText(provider, json) {
    // Keep this permissive.
    if (!json) return "";
    if (provider === "anthropic") {
        // Common pattern: { content: [{type:"text", text:"..."}], ... }
        const parts = json.content || json?.message?.content;
        if (Array.isArray(parts)) return parts.map(p => p.text || "").join("");
    }
    if (provider === "google") {
        // Gemini: candidates[0].content.parts[0].text (often)
        const c0 = json.candidates?.[0];
        const parts = c0?.content?.parts;
        if (Array.isArray(parts)) return parts.map(p => p.text || "").join("");
        // Sometimes: text output in candidates[0].output
        if (typeof c0?.output === "string") return c0.output;
    }
    if (provider === "openai") {
        // Varies by endpoint; try a few common shapes
        const o = json.output?.[0];
        const parts = o?.content;
        if (Array.isArray(parts)) return parts.map(p => p.text || p?.value || "").join("");
        if (typeof json?.choices?.[0]?.message?.content === "string") return json.choices[0].message.content;
    }
    // fallback: best effort stringify
    return json.text || json.output_text || "";
}

async function callAnthropic({ model, system, user, maxTokens = 1200 }) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

    // Endpoint is typical for Anthropic Messages API (may change; adjust if needed)
    const url = "https://api.anthropic.com/v1/messages";

    const body = {
        model,
        max_tokens: maxTokens,
        system: system || "",
        messages: [{ role: "user", content: user }],
    };

    const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 300)}`);
    return { raw: json, text: normalizeResponseText("anthropic", json) };
}

async function callGoogleGemini({ model, system, user }) {
    const key = process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("Missing GOOGLE_API_KEY");

    // Typical Generative Language endpoint (may change; adjust if needed)
    // Using "generateContent" style.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const body = {
        contents: [
            { role: "user", parts: [{ text: (system ? `SYSTEM:\n${system}\n\n` : "") + user }] }
        ],
    };

    const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${text.slice(0, 300)}`);
    return { raw: json, text: normalizeResponseText("google", json) };
}

// Optional adapter (kept generic because OpenAI endpoints/models can differ by setup)
async function callOpenAI({ model, system, user }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");

    // This is a placeholder. If you use OpenAI Responses API or Chat Completions,
    // adjust the URL + body accordingly.
    const url = "https://api.openai.com/v1/chat/completions";
    const body = {
        model,
        messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: user },
        ],
        temperature: 0.2,
    };

    const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${key}` },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`);
    return { raw: json, text: normalizeResponseText("openai", json) };
}

async function callProvider(spec, { system, user }) {
    const { provider, model } = spec;

    if (provider === "anthropic") return await callAnthropic({ model, system, user });
    if (provider === "google") return await callGoogleGemini({ model, system, user });
    if (provider === "openai") return await callOpenAI({ model, system, user });

    throw new Error(`Unknown provider: ${provider}`);
}

/** ---------------------------
 *  Verifier loop
 *  ---------------------------
 * Primary answer → verifier checks → if issues, ask primary to fix with verifier notes.
 */
const SYSTEM_PRIMARY = `
You are a production-grade engineer.
Rules:
- Do not claim you ran tests unless you show commands/logs or the user provided logs.
- If anything is uncertain, say what you would verify and how.
- Prefer step-by-step + exact file paths/commands.
- If user asked "single file", provide a single file.
`;

const SYSTEM_VERIFIER = `
You are a strict reviewer ("Truth Guard").
Task:
- Find missing steps, risky assumptions, contradictions, security issues, or unclear instructions.
- If the answer lacks proof, demand specific proof artifacts.
- Output MUST be: (1) PASS or FAIL, (2) bullet list of issues, (3) concrete fix instructions.
Be concise and brutal.
`;

function buildFixPrompt(originalUserPrompt, draft, verifierReport) {
    return `
User request:
${originalUserPrompt}

Your previous draft:
${draft}

Verifier report (must address ALL):
${verifierReport}

Now produce a corrected final answer.
Rules:
- Keep it practical.
- If code is requested, ensure it runs.
- If you cannot verify something, give exact verification steps.
`;
}

/** ---------------------------
 *  Main
 *  ---------------------------
 */
async function main() {
    const args = parseArgs(process.argv);

    const logPath = path.resolve(process.cwd(), "model_router.log");
    writeLogLine("START", logPath);

    let payload = { prompt: "", meta: {} };

    if (args.json) {
        const raw = fs.readFileSync(args.json, "utf8");
        const j = JSON.parse(raw);
        payload.prompt = j.prompt || "";
        payload.meta = j.meta || {};
    } else if (args.file) {
        payload.prompt = fs.readFileSync(args.file, "utf8");
    } else {
        payload.prompt = (await readStdin()).trim();
    }

    if (!payload.prompt) {
        console.error("No prompt provided. Use stdin or --file or --json.");
        process.exit(2);
    }

    const task = classifyTask(payload.prompt, payload.meta);
    const plan = route(task);

    writeLogLine(`TASK kind=${task.kind} strict=${task.strict} long=${task.long} vision=${task.vision}`, logPath);
    writeLogLine(`ROUTE primary=${plan.primary.provider}:${plan.primary.model} verifier=${plan.verifier.provider}:${plan.verifier.model}`, logPath);

    const fallbackChain = [
        plan.primary,
        // fallback options (tune as you like)
        { provider: "anthropic", model: "claude-sonnet-4.5-thinking" },
        { provider: "google", model: "gemini-3-flash" },
    ];

    let draft = null;
    let usedPrimary = null;

    for (const spec of fallbackChain) {
        try {
            writeLogLine(`CALL primary ${spec.provider}:${spec.model}`, logPath);
            const r = await callProvider(spec, { system: SYSTEM_PRIMARY, user: payload.prompt });
            draft = r.text?.trim();
            usedPrimary = spec;
            if (!draft) throw new Error("Empty response text");
            break;
        } catch (e) {
            writeLogLine(`PRIMARY FAIL ${spec.provider}:${spec.model} :: ${String(e.message || e)}`, logPath);
        }
    }

    if (!draft) {
        console.error("All providers failed. Check model_router.log");
        process.exit(1);
    }

    let finalText = draft;
    let verifier = null;
    let verifierText = null;

    if (args.verify || payload.meta.strict === true) {
        // verifier
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                writeLogLine(`CALL verifier ${plan.verifier.provider}:${plan.verifier.model} attempt=${attempt}`, logPath);
                verifier = await callProvider(plan.verifier, {
                    system: SYSTEM_VERIFIER,
                    user: `Verify this answer:\n\n${finalText}`,
                });
                verifierText = (verifier.text || "").trim();

                const isFail = /\bFAIL\b/i.test(verifierText) && !/\bPASS\b/i.test(verifierText);
                if (!isFail) break;

                // Fix loop: ask primary to correct based on verifier
                writeLogLine(`VERIFIER FAIL → FIX LOOP attempt=${attempt}`, logPath);
                const fixPrompt = buildFixPrompt(payload.prompt, finalText, verifierText);

                const fixed = await callProvider(usedPrimary, { system: SYSTEM_PRIMARY, user: fixPrompt });
                finalText = (fixed.text || "").trim();

                await sleep(250);
            } catch (e) {
                writeLogLine(`VERIFIER ERROR attempt=${attempt} :: ${String(e.message || e)}`, logPath);
                break; // don't block delivery if verifier fails
            }
        }
    }

    const output = {
        meta: {
            task,
            primary_used: usedPrimary,
            verifier_used: (args.verify || payload.meta.strict === true) ? plan.verifier : null,
            log_file: logPath,
            note: "If using UI dropdown, this router is for API-based execution.",
        },
        answer: finalText,
        verifier_report: verifierText || null,
    };

    const outStr = JSON.stringify(output, null, 2);
    if (args.out) {
        fs.writeFileSync(args.out, outStr, "utf8");
        console.log(`Saved: ${args.out}`);
    } else {
        console.log(outStr);
    }

    writeLogLine("DONE", logPath);
}

main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
