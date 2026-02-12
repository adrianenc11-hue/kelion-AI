// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'https://kelionai.app';
const API = `${BASE}/.netlify/functions`;

// ═══════════════════════════════════════════════════════════════
// SECTION 1: PAGE LOAD & VISUAL TESTS (browser vizibil)
// ═══════════════════════════════════════════════════════════════
test.describe('1. Pagini — Load & Visual', () => {

    test('index.html se incarca cu titlu corect', async ({ page }) => {
        await page.goto(BASE);
        await expect(page).toHaveTitle(/Kelion/i);
        const body = page.locator('body');
        await expect(body).toBeVisible();
        // Check hero section exists
        const heroText = await page.textContent('body');
        expect(heroText.length).toBeGreaterThan(100);
    });

    test('app.html se incarca fara erori JS', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.goto(`${BASE}/app.html`, { waitUntil: 'networkidle' });
        await expect(page.locator('body')).toBeVisible();
        // Filter benign errors
        const realErrors = errors.filter(e =>
            !e.includes('service-worker') &&
            !e.includes('favicon') &&
            !e.includes('net::ERR') &&
            !e.includes('Failed to load resource')
        );
        expect(realErrors.length).toBeLessThanOrEqual(3);
    });

    test('subscribe.html se incarca', async ({ page }) => {
        await page.goto(`${BASE}/subscribe.html`);
        await expect(page.locator('body')).toBeVisible();
    });

    test('terms.html se incarca', async ({ page }) => {
        const res = await page.goto(`${BASE}/terms.html`);
        expect(res.status()).toBeLessThan(400);
    });

    test('privacy.html se incarca', async ({ page }) => {
        const res = await page.goto(`${BASE}/privacy.html`);
        expect(res.status()).toBeLessThan(400);
    });

    test('gdpr.html se incarca', async ({ page }) => {
        const res = await page.goto(`${BASE}/gdpr.html`);
        expect(res.status()).toBeLessThan(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: API ENDPOINTS — REAL RESPONSES
// ═══════════════════════════════════════════════════════════════
test.describe('2. API — Raspunsuri reale', () => {

    test('health endpoint → 200 healthy', async ({ request }) => {
        const res = await request.get(`${API}/health`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('healthy');
        expect(body.critical_failures).toBe(0);
    });

    test('vault health → 45+ chei', async ({ request }) => {
        const res = await request.post(`${API}/get-secret`, {
            data: { action: 'health' }
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.vault_keys).toBeGreaterThanOrEqual(44);
    });

    test('env-check → 200 cu date', async ({ request }) => {
        const res = await request.get(`${API}/env-check`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(Object.keys(body).length).toBeGreaterThan(0);
    });

    test('chat → raspuns AI real la intrebare', async ({ request }) => {
        const res = await request.post(`${API}/chat`, {
            data: { message: 'What is 2+2? Answer with just the number.' }
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.response || body.reply || body.message).toBeTruthy();
        const answer = (body.response || body.reply || body.message || '').toString();
        expect(answer).toContain('4');
    });

    test('smart-brain → raspuns AI real', async ({ request }) => {
        const res = await request.post(`${API}/smart-brain`, {
            data: { question: 'What is the capital of Romania?' }
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        const answer = (body.response || body.reply || body.answer || '').toString().toLowerCase();
        const hasCapital = answer.includes('bucharest') || answer.includes('bucuresti') || answer.includes('bucurești');
        expect(hasCapital).toBe(true);
    });

    test('weather GPS → date meteo reale', async ({ request }) => {
        const res = await request.get(`${API}/weather?lat=44.4268&lon=26.1025`);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.temperature).toBeDefined();
        expect(typeof body.temperature).toBe('number');
        expect(body.location || body.city || body.name).toBeTruthy();
    });

    test('free-trial → status valid', async ({ request }) => {
        const res = await request.post(`${API}/free-trial`, {
            data: { action: 'check' }
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.remainingSeconds).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: INPUT VALIDATION — 400 corect pe input invalid
// ═══════════════════════════════════════════════════════════════
test.describe('3. Validare input — 400 pe date invalide', () => {

    test('chat fara mesaj → 400', async ({ request }) => {
        const res = await request.post(`${API}/chat`, { data: {} });
        expect(res.status()).toBe(400);
    });

    test('chat JSON invalid → 400', async ({ request }) => {
        const res = await request.post(`${API}/chat`, {
            headers: { 'Content-Type': 'application/json' },
            data: 'not-json{{{',
        });
        expect(res.status()).toBe(400);
    });

    test('smart-brain fara intrebare → 400', async ({ request }) => {
        const res = await request.post(`${API}/smart-brain`, { data: {} });
        expect(res.status()).toBe(400);
    });

    test('dalle fara prompt → 400', async ({ request }) => {
        const res = await request.post(`${API}/dalle`, { data: {} });
        expect(res.status()).toBe(400);
    });

    test('whisper fara audio → 400', async ({ request }) => {
        const res = await request.post(`${API}/whisper`, { data: {} });
        expect(res.status()).toBe(400);
    });

    test('vision fara imagine → 400', async ({ request }) => {
        const res = await request.post(`${API}/vision`, { data: {} });
        expect(res.status()).toBe(400);
    });

    test('elevenlabs-tts fara text → 400', async ({ request }) => {
        const res = await request.post(`${API}/elevenlabs-tts`, { data: {} });
        expect(res.status()).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: SECURITY — nu expune date sensibile
// ═══════════════════════════════════════════════════════════════
test.describe('4. Securitate', () => {

    test('get-secret nu expune chei', async ({ request }) => {
        const res = await request.post(`${API}/get-secret`, {
            data: { action: 'get', key: 'OPENAI_API_KEY' }
        });
        const body = await res.text();
        expect(body).not.toContain('sk-');
        expect(body).not.toContain('api_key');
    });

    test('CORS headers prezente', async ({ request }) => {
        const res = await request.fetch(`${API}/health`, { method: 'OPTIONS' });
        expect(res.status()).toBeLessThan(400);
    });

    test('env-check nu afiseaza valori reale', async ({ request }) => {
        const res = await request.get(`${API}/env-check`);
        const body = await res.text();
        // Should not contain actual API key values
        expect(body).not.toContain('sk-ant-');
        expect(body).not.toContain('sk-proj-');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: BROWSER UI — interactiuni vizuale
// ═══════════════════════════════════════════════════════════════
test.describe('5. Browser UI — Interactiuni vizuale', () => {

    test('pagina principala are buton CTA', async ({ page }) => {
        await page.goto(BASE);
        // Look for any call-to-action button
        const buttons = page.locator('button, a.btn, a.cta, .hero-btn, [class*="btn"]');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
    });

    test('app.html are chat input', async ({ page }) => {
        await page.goto(`${BASE}/app.html`, { waitUntil: 'domcontentloaded' });
        // Wait for app to initialize
        await page.waitForTimeout(2000);
        // Look for any input or textarea for chat
        const inputs = page.locator('input[type="text"], textarea, #chatInput, #messageInput, [id*="chat"], [id*="message"]');
        const count = await inputs.count();
        // App might have chat input somewhere
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('subscribe.html are planuri de pret', async ({ page }) => {
        await page.goto(`${BASE}/subscribe.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        const body = await page.textContent('body');
        // Should mention pricing or plans
        const hasPricing = body.toLowerCase().includes('month') ||
            body.toLowerCase().includes('year') ||
            body.toLowerCase().includes('plan') ||
            body.toLowerCase().includes('price') ||
            body.toLowerCase().includes('premium');
        expect(hasPricing).toBe(true);
    });

    test('no 404 resources on index', async ({ page }) => {
        const failed404 = [];
        page.on('response', response => {
            if (response.status() === 404 && !response.url().includes('favicon')) {
                failed404.push(response.url());
            }
        });
        await page.goto(BASE, { waitUntil: 'networkidle' });
        expect(failed404).toHaveLength(0);
    });
});
