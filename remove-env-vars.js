// Fast env var removal with progress bar
const { execSync } = require('child_process');

const keys = [
    'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'AI21_API_KEY',
    'ALPACA_API_KEY', 'ALPACA_PAPER', 'ALPACA_SECRET_KEY',
    'ANTHROPIC_API_KEY', 'COHERE_API_KEY',
    'DEEPGRAM_API_KEY', 'DEEPSEEK_API_KEY', 'DEEPSEEK_KEY',
    'E2B_API_KEY', 'ELEVENLABS_API_KEY', 'ENCRYPTION_KEY',
    'GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GROK_API_KEY', 'GROQ_API_KEY',
    'MISTRAL_API_KEY', 'OPENAI_API_KEY', 'OPENWEATHER_API_KEY',
    'PAYPAL_CLIENT_ID', 'PAYPAL_MODE',
    'PAYPAL_PLAN_ANNUAL', 'PAYPAL_PLAN_BUSINESS_ANNUAL', 'PAYPAL_PLAN_BUSINESS_MONTHLY',
    'PAYPAL_PLAN_FAMILY_ANNUAL', 'PAYPAL_PLAN_FAMILY_MONTHLY', 'PAYPAL_PLAN_MONTHLY',
    'PAYPAL_SECRET', 'PAYPAL_WEBHOOK_ID',
    'PERPLEXITY_API_KEY', 'PINECONE_API_KEY', 'PINECONE_HOST',
    'REPLICATE_API_TOKEN', 'RESEND_API_KEY', 'RESEND_FROM',
    'STRIPE_PRICE_ANNUAL', 'STRIPE_PRICE_MONTHLY',
    'TOGETHER_API_KEY', 'TTS_API_KEY', 'USER_PASSWORD',
    'VECTOR_DB_API_KEY', 'WOLFRAM_APP_ID'
];

const total = keys.length;
let done = 0, ok = 0, skip = 0;

function bar(pct) {
    const filled = Math.round(pct / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

for (const key of keys) {
    done++;
    const pct = Math.round((done / total) * 100);
    process.stdout.write(`\r[${bar(pct)}] ${pct}% (${done}/${total}) ${key.padEnd(35)}`);
    try {
        execSync(`netlify env:unset ${key}`, { timeout: 15000, stdio: 'pipe' });
        ok++;
    } catch (e) {
        skip++;
    }
}

console.log(`\n\n✅ Done: ${ok} removed, ${skip} skipped/already gone`);
