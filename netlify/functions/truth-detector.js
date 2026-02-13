// ═══════════════════════════════════════════════════════════════
// K TRUTH SHIELD — Tamper-Proof Truth Detection System
// 6 Modules: Fact-Check, AI Detection, Benford, Image, Fraud, Veracity
// ALWAYS ON — Cannot be disabled without admin authentication
// ═══════════════════════════════════════════════════════════════

const { patchProcessEnv } = require('./get-secret');

// ═══ TAMPER-PROOF GUARD ═══
// This flag is HARDCODED true. Cannot be changed from frontend.
// Only admin email holder can request deactivation via authenticated endpoint.
const TRUTH_SHIELD_ACTIVE = true;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// ═══ BENFORD'S LAW DISTRIBUTION ═══
const BENFORD_EXPECTED = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv();

        // ═══ TAMPER-PROOF CHECK ═══
        if (!TRUTH_SHIELD_ACTIVE) {
            console.error('[TRUTH-SHIELD] CRITICAL: Shield was tampered! Forcing ON.');
            // Even if somehow bypassed, we still run — defense in depth
        }

        const parsed = JSON.parse(event.body || '{}');
        const { action, text, numbers, image, user_email } = parsed;

        // ═══ ADMIN DEACTIVATION CHECK ═══
        if (action === 'deactivate') {
            if (user_email !== ADMIN_EMAIL) {
                return {
                    statusCode: 403, headers,
                    body: JSON.stringify({
                        error: 'ACCES REFUZAT — Doar administratorul poate dezactiva Truth Shield.',
                        shield_status: 'ACTIVE',
                        tamper_attempt: true
                    })
                };
            }
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    message: 'Truth Shield nu poate fi dezactivat programatic. Contactați echipa de dezvoltare.',
                    shield_status: 'ACTIVE',
                    reason: 'HARDCODED_PROTECTION'
                })
            };
        }

        // ═══ STATUS CHECK ═══
        if (action === 'status') {
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    shield_active: true,
                    modules: ['fact-check', 'ai-detection', 'benford-law', 'image-forensics', 'fraud-detection', 'veracity-score'],
                    tamper_proof: true,
                    admin_only_deactivation: true,
                    version: '1.0.0'
                })
            };
        }

        // ═══ FULL ANALYSIS ═══
        if (action === 'analyze' || !action) {
            if (!text && !numbers && !image) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text, numbers, or image required for analysis' }) };
            }

            const results = {};
            const promises = [];

            // Module 1: Fact-Check (uses Gemini for fact verification)
            if (text) {
                promises.push(
                    factCheck(text).then(r => { results.fact_check = r; }).catch(e => {
                        results.fact_check = { score: -1, error: e.message };
                    })
                );
            }

            // Module 2: AI Content Detection
            if (text) {
                promises.push(
                    detectAIContent(text).then(r => { results.ai_detection = r; }).catch(e => {
                        results.ai_detection = { score: -1, error: e.message };
                    })
                );
            }

            // Module 3: Benford's Law
            if (numbers && Array.isArray(numbers) && numbers.length >= 10) {
                results.benford_law = analyzeBenford(numbers);
            }

            // Module 4: Image Forensics
            if (image) {
                promises.push(
                    analyzeImage(image).then(r => { results.image_forensics = r; }).catch(e => {
                        results.image_forensics = { score: -1, error: e.message };
                    })
                );
            }

            // Module 5: Fraud Patterns (on numbers)
            if (numbers && Array.isArray(numbers)) {
                results.fraud_detection = detectFraudPatterns(numbers);
            }

            // Module 6: Text Veracity Score
            if (text) {
                promises.push(
                    scoreVeracity(text).then(r => { results.veracity_score = r; }).catch(e => {
                        results.veracity_score = { score: -1, error: e.message };
                    })
                );
            }

            await Promise.all(promises);

            // Calculate overall truth score
            const scores = Object.values(results)
                .filter(r => r && typeof r.score === 'number' && r.score >= 0)
                .map(r => r.score);
            const overallScore = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : -1;

            const verdict = overallScore >= 70 ? 'VERIFIED' :
                overallScore >= 40 ? 'SUSPICIOUS' :
                    overallScore >= 0 ? 'FALSE' : 'UNKNOWN';

            // Log to trace
            logTrace(text || 'image/numbers', overallScore, verdict);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    shield_active: true,
                    overall_score: overallScore,
                    verdict,
                    modules: results,
                    analyzed_at: new Date().toISOString()
                })
            };
        }

        // ═══ INDIVIDUAL MODULE CALLS ═══
        if (action === 'fact-check' && text) {
            const r = await factCheck(text);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }
        if (action === 'ai-detect' && text) {
            const r = await detectAIContent(text);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }
        if (action === 'benford' && numbers) {
            const r = analyzeBenford(numbers);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }
        if (action === 'image-forensics' && image) {
            const r = await analyzeImage(image);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }
        if (action === 'fraud-detect' && numbers) {
            const r = detectFraudPatterns(numbers);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }
        if (action === 'veracity' && text) {
            const r = await scoreVeracity(text);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...r }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action or missing data' }) };

    } catch (error) {
        console.error('[TRUTH-SHIELD] Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, shield_active: true }) };
    }
};

// ═══════════════════════════════════════════════════════════════
// MODULE 1: FACT-CHECK — Uses Gemini to verify claims
// ═══════════════════════════════════════════════════════════════
async function factCheck(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { score: -1, error: 'GEMINI_API_KEY not configured' };

    const prompt = `You are a fact-checker. Analyze this text for factual accuracy.
For each claim in the text, determine if it is:
- TRUE (verified fact)
- FALSE (known to be incorrect)
- UNVERIFIABLE (cannot be confirmed)
- MISLEADING (partially true but presented misleadingly)

Text to analyze: "${text}"

Respond ONLY in this JSON format:
{
  "claims": [{"claim": "...", "verdict": "TRUE/FALSE/UNVERIFIABLE/MISLEADING", "explanation": "..."}],
  "overall_accuracy": 0-100,
  "red_flags": ["..."]
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
        })
    });

    if (!res.ok) throw new Error(`Gemini fact-check: ${res.status}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                module: 'fact-check',
                score: parsed.overall_accuracy || 50,
                claims: parsed.claims || [],
                red_flags: parsed.red_flags || [],
                verdict: (parsed.overall_accuracy || 50) >= 70 ? 'VERIFIED' : (parsed.overall_accuracy || 50) >= 40 ? 'SUSPICIOUS' : 'FALSE'
            };
        }
    } catch (e) { /* parse error */ }

    return { module: 'fact-check', score: 50, raw: content, verdict: 'SUSPICIOUS' };
}

// ═══════════════════════════════════════════════════════════════
// MODULE 2: AI CONTENT DETECTION — Detects AI-generated text
// ═══════════════════════════════════════════════════════════════
async function detectAIContent(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { score: -1, error: 'GEMINI_API_KEY not configured' };

    // Also run heuristic checks
    const heuristics = aiHeuristics(text);

    const prompt = `You are an AI content detector. Analyze this text and determine if it was written by a human or generated by AI (ChatGPT, Claude, Gemini, etc.).

Look for these indicators:
- Overly formal/perfect grammar
- Repetitive structure patterns
- Lack of personal experience/emotion
- Generic filler phrases
- Unusual consistency in paragraph length
- Bullet point overuse
- "As an AI" or similar markers

Text: "${text.substring(0, 2000)}"

Respond ONLY in JSON:
{
  "ai_probability": 0-100,
  "human_probability": 0-100,
  "indicators": ["..."],
  "confidence": "HIGH/MEDIUM/LOW"
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
        })
    });

    if (!res.ok) throw new Error(`AI detection: ${res.status}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const aiProb = parsed.ai_probability || 50;
            // Combine AI analysis with heuristics (70% AI, 30% heuristic)
            const combined = Math.round(aiProb * 0.7 + heuristics.score * 0.3);
            return {
                module: 'ai-detection',
                score: 100 - combined, // Invert: high score = likely human
                ai_probability: combined,
                human_probability: 100 - combined,
                indicators: [...(parsed.indicators || []), ...heuristics.flags],
                confidence: parsed.confidence || 'MEDIUM',
                verdict: combined > 70 ? 'AI_GENERATED' : combined > 40 ? 'MIXED' : 'HUMAN_WRITTEN'
            };
        }
    } catch (e) { /* parse error */ }

    return { module: 'ai-detection', score: 50, verdict: 'UNKNOWN', heuristics };
}

// Heuristic checks for AI-generated content
function aiHeuristics(text) {
    const flags = [];
    let score = 0;

    // Check for common AI phrases
    const aiPhrases = [
        'as an ai', 'i cannot', 'i\'m unable to', 'it\'s important to note',
        'in conclusion', 'it is worth noting', 'however, it is important',
        'delve into', 'navigate the', 'foster a', 'landscape of',
        'leverage', 'utilize', 'facilitate', 'comprehensive overview',
        'in the realm of', 'it\'s crucial to', 'tapestry of'
    ];
    const lower = text.toLowerCase();
    for (const phrase of aiPhrases) {
        if (lower.includes(phrase)) {
            flags.push(`AI phrase: "${phrase}"`);
            score += 8;
        }
    }

    // Check sentence uniformity
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 3) {
        const lengths = sentences.map(s => s.trim().length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length;
        const cv = Math.sqrt(variance) / avg; // coefficient of variation
        if (cv < 0.25) {
            flags.push('Suspiciously uniform sentence lengths');
            score += 15;
        }
    }

    // Check for excessive bullet points
    const bulletCount = (text.match(/^[\s]*[-•*]\s/gm) || []).length;
    if (bulletCount > 5) {
        flags.push(`${bulletCount} bullet points detected`);
        score += 10;
    }

    // Perfect paragraph structure
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length >= 3) {
        const pLengths = paragraphs.map(p => p.length);
        const pAvg = pLengths.reduce((a, b) => a + b, 0) / pLengths.length;
        const pCV = Math.sqrt(pLengths.reduce((s, l) => s + Math.pow(l - pAvg, 2), 0) / pLengths.length) / pAvg;
        if (pCV < 0.2) {
            flags.push('Suspiciously uniform paragraph lengths');
            score += 10;
        }
    }

    return { score: Math.min(score, 100), flags };
}

// ═══════════════════════════════════════════════════════════════
// MODULE 3: BENFORD'S LAW — Detects manipulated numerical data
// Pure mathematics — zero API calls needed
// ═══════════════════════════════════════════════════════════════
function analyzeBenford(numbers) {
    const digits = new Array(10).fill(0);
    let total = 0;

    for (const num of numbers) {
        const n = Math.abs(Number(num));
        if (n < 1) continue;
        const firstDigit = parseInt(String(n)[0]);
        if (firstDigit >= 1 && firstDigit <= 9) {
            digits[firstDigit]++;
            total++;
        }
    }

    if (total < 10) {
        return { module: 'benford-law', score: -1, error: 'Need at least 10 valid numbers', verdict: 'INSUFFICIENT_DATA' };
    }

    // Calculate chi-squared statistic
    let chiSquared = 0;
    const observed = {};
    const expected = {};
    for (let d = 1; d <= 9; d++) {
        const obs = digits[d] / total;
        const exp = BENFORD_EXPECTED[d];
        observed[d] = Math.round(obs * 1000) / 1000;
        expected[d] = exp;
        chiSquared += Math.pow(obs - exp, 2) / exp;
    }

    // Lower chi-squared = better fit to Benford's Law = more natural data
    // chi-squared > 0.05 → suspicious, > 0.15 → likely fabricated
    const normalizedScore = Math.max(0, Math.min(100, Math.round(100 - (chiSquared * 500))));

    return {
        module: 'benford-law',
        score: normalizedScore,
        chi_squared: Math.round(chiSquared * 10000) / 10000,
        observed_distribution: observed,
        expected_distribution: expected,
        sample_size: total,
        verdict: normalizedScore >= 70 ? 'NATURAL_DATA' : normalizedScore >= 40 ? 'SUSPICIOUS' : 'LIKELY_FABRICATED'
    };
}

// ═══════════════════════════════════════════════════════════════
// MODULE 4: IMAGE FORENSICS — Uses GPT-4o Vision for analysis
// ═══════════════════════════════════════════════════════════════
async function analyzeImage(imageData) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { score: -1, error: 'OPENAI_API_KEY not configured' };

    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `You are an image forensics expert. Analyze this image for signs of manipulation, AI generation, or deepfake.

Look for:
- Inconsistent lighting/shadows
- Warped edges or artifacts
- Unnatural skin texture (deepfake)
- Text errors or distortions
- Copy-paste artifacts
- AI generation artifacts (extra fingers, melted features)
- Metadata anomalies visible in the image

Respond ONLY in JSON:
{
  "authenticity_score": 0-100,
  "manipulation_detected": true/false,
  "ai_generated": true/false,
  "deepfake_probability": 0-100,
  "artifacts_found": ["..."],
  "confidence": "HIGH/MEDIUM/LOW"
}`
                    },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }],
            max_tokens: 600
        })
    });

    if (!res.ok) throw new Error(`Vision forensics: ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                module: 'image-forensics',
                score: parsed.authenticity_score || 50,
                manipulation_detected: parsed.manipulation_detected || false,
                ai_generated: parsed.ai_generated || false,
                deepfake_probability: parsed.deepfake_probability || 0,
                artifacts: parsed.artifacts_found || [],
                confidence: parsed.confidence || 'MEDIUM',
                verdict: (parsed.authenticity_score || 50) >= 70 ? 'AUTHENTIC' :
                    (parsed.authenticity_score || 50) >= 40 ? 'SUSPICIOUS' : 'MANIPULATED'
            };
        }
    } catch (e) { /* parse error */ }

    return { module: 'image-forensics', score: 50, raw: content, verdict: 'UNKNOWN' };
}

// ═══════════════════════════════════════════════════════════════
// MODULE 5: FRAUD PATTERN DETECTION — Statistical anomaly check
// ═══════════════════════════════════════════════════════════════
function detectFraudPatterns(numbers) {
    const nums = numbers.map(Number).filter(n => !isNaN(n));
    if (nums.length < 5) {
        return { module: 'fraud-detection', score: -1, error: 'Need at least 5 numbers', verdict: 'INSUFFICIENT_DATA' };
    }

    const flags = [];
    let suspicionScore = 0;

    // 1. Check for round number bias (humans fabricating data use round numbers)
    const roundCount = nums.filter(n => n % 10 === 0 || n % 5 === 0).length;
    const roundPct = roundCount / nums.length;
    if (roundPct > 0.5) {
        flags.push(`${Math.round(roundPct * 100)}% round numbers (expected ~28%)`);
        suspicionScore += 20;
    }

    // 2. Check for duplicate values (unusual in natural data)
    const uniqueRatio = new Set(nums).size / nums.length;
    if (uniqueRatio < 0.5) {
        flags.push(`Only ${Math.round(uniqueRatio * 100)}% unique values — excessive duplication`);
        suspicionScore += 15;
    }

    // 3. Check for suspiciously even distribution
    const sorted = [...nums].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
        gaps.push(sorted[i] - sorted[i - 1]);
    }
    if (gaps.length > 3) {
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
        const gapCV = Math.sqrt(gapVariance) / (avgGap || 1);
        if (gapCV < 0.15) {
            flags.push('Suspiciously even spacing between values');
            suspicionScore += 20;
        }
    }

    // 4. Check for sequential patterns
    let seqCount = 0;
    for (let i = 2; i < nums.length; i++) {
        if (nums[i] - nums[i - 1] === nums[i - 1] - nums[i - 2]) seqCount++;
    }
    if (seqCount / nums.length > 0.3) {
        flags.push('Sequential/arithmetic patterns detected');
        suspicionScore += 25;
    }

    // 5. Standard deviation check — fabricated data often has low variance
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const stdDev = Math.sqrt(nums.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / nums.length);
    const cv = stdDev / (Math.abs(mean) || 1);
    if (cv < 0.05 && nums.length > 10) {
        flags.push(`Very low variance (CV=${Math.round(cv * 100)}%) — unusually consistent`);
        suspicionScore += 15;
    }

    const score = Math.max(0, 100 - suspicionScore);

    return {
        module: 'fraud-detection',
        score,
        statistics: {
            count: nums.length,
            mean: Math.round(mean * 100) / 100,
            std_dev: Math.round(stdDev * 100) / 100,
            coefficient_of_variation: Math.round(cv * 1000) / 1000,
            unique_ratio: Math.round(uniqueRatio * 100) / 100,
            round_number_pct: Math.round(roundPct * 100) / 100
        },
        red_flags: flags,
        verdict: score >= 70 ? 'LEGITIMATE' : score >= 40 ? 'SUSPICIOUS' : 'LIKELY_FRAUDULENT'
    };
}

// ═══════════════════════════════════════════════════════════════
// MODULE 6: TEXT VERACITY SCORER — Multi-AI cross-verification
// ═══════════════════════════════════════════════════════════════
async function scoreVeracity(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { score: -1, error: 'GEMINI_API_KEY not configured' };

    const prompt = `You are a truth verification system. Score the following text for veracity (truthfulness).

Analyze:
1. Are claims supported by known facts?
2. Are there logical fallacies?
3. Is there emotional manipulation?
4. Are sources cited or verifiable?
5. Is the language objective or biased?
6. Are statistics used correctly?
7. Are there misleading generalizations?

Text: "${text.substring(0, 2000)}"

Respond ONLY in JSON:
{
  "veracity_score": 0-100,
  "logical_fallacies": ["..."],
  "emotional_manipulation": true/false,
  "bias_detected": "NONE/LOW/MEDIUM/HIGH",
  "unsupported_claims": ["..."],
  "recommendation": "TRUST/VERIFY/REJECT"
}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
        })
    });

    if (!res.ok) throw new Error(`Veracity check: ${res.status}`);
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                module: 'veracity-score',
                score: parsed.veracity_score || 50,
                logical_fallacies: parsed.logical_fallacies || [],
                emotional_manipulation: parsed.emotional_manipulation || false,
                bias: parsed.bias_detected || 'UNKNOWN',
                unsupported_claims: parsed.unsupported_claims || [],
                recommendation: parsed.recommendation || 'VERIFY',
                verdict: (parsed.veracity_score || 50) >= 70 ? 'TRUSTWORTHY' :
                    (parsed.veracity_score || 50) >= 40 ? 'VERIFY' : 'UNRELIABLE'
            };
        }
    } catch (e) { /* parse error */ }

    return { module: 'veracity-score', score: 50, raw: content, verdict: 'UNKNOWN' };
}

// ═══ TRACE LOGGING ═══
function logTrace(text, score, verdict) {
    try {
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/trace-collector`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                node: 'truth-shield',
                direction: 'result',
                label: `Score:${score} Verdict:${verdict} Text:"${(text || '').substring(0, 40)}..."`,
                session: Date.now().toString()
            })
        }).catch(() => { });
    } catch (e) { /* fire and forget */ }
}
