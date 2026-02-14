const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

(async () => {
    console.log('🤖 Human Simulator (Crawler Mode): STARTING...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 K-Human-Sim/2.0'
    });

    // Config
    const START_URL = 'https://kelionai.app/';
    const MAX_PAGES = 30; // Safety limit
    const visited = new Set();
    const queue = [START_URL];
    const reportPath = path.join(__dirname, 'human_simulation_report.md');

    let reportContent = '# 🤖 Human Simulator Report (Full Crawl)\n\nDate: ' + new Date().toISOString() + '\n\n';
    let errorCount = 0;
    let screenshotCount = 0;
    let pageCount = 0;

    // --- HELPER: LOGGING ---
    function log(msg, type = 'INFO') {
        const line = `[${type}] ${msg}`;
        console.log(line);
        reportContent += `- ${line}\n`;
        if (type === 'ERROR') errorCount++;
    }

    async function takeScreenshot(page, name) {
        screenshotCount++;
        const filename = `sim_evidence_${screenshotCount}_${name.replace(/[^a-z0-9]/gi, '_')}.png`;
        const filepath = path.join(__dirname, filename);
        try {
            await page.screenshot({ path: filepath, fullPage: false });
            log(`📸 Captured: ${filename}`, 'EVIDENCE');
            reportContent += `\n![${name}](${filename})\n`;
        } catch (e) {
            log(`Screenshot failed: ${e.message}`, 'WARNING');
        }
    }

    // --- CRAWL LOOP ---
    while (queue.length > 0 && pageCount < MAX_PAGES) {
        const currentUrl = queue.shift();

        // Normalize URL to avoid duplicates (strip trailing slash)
        const normalizedUrl = currentUrl.endsWith('/') && currentUrl.length > 1 ? currentUrl.slice(0, -1) : currentUrl;

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        pageCount++;
        const page = await context.newPage();

        // Setup listeners for THIS page
        page.on('console', msg => {
            if (msg.type() === 'error') log(`[${normalizedUrl}] Console Error: ${msg.text()}`, 'ERROR');
        });
        page.on('pageerror', err => log(`[${normalizedUrl}] Uncaught: ${err.message}`, 'ERROR'));
        page.on('requestfailed', req => {
            const failure = req.failure();
            if (failure && failure.errorText !== 'net::ERR_ABORTED') {
                log(`[${normalizedUrl}] Net Fail: ${req.url()} (${failure.errorText})`, 'ERROR');
            }
        });
        page.on('response', resp => {
            if (resp.status() >= 400 && resp.url().includes('kelionai.app')) {
                log(`[${normalizedUrl}] HTTP ${resp.status()} ${resp.url()}`, 'ERROR');
            }
        });

        try {
            reportContent += `\n## Page ${pageCount}: ${normalizedUrl}\n`;
            log(`Visiting: ${normalizedUrl}...`);

            await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1000); // Human pause

            // 1. SCROLL
            log(`Scrolling...`, 'ACTION');
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 400;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 50);
                });
            });
            await page.waitForTimeout(500);

            // 2. EVIDENCE
            await takeScreenshot(page, `visit_${pageCount}_${path.basename(normalizedUrl) || 'home'}`);

            // 3. EXTRACT INTERNAL LINKS
            const hrefs = await page.$$eval('a', as => as.map(a => a.href));
            const internalLinks = hrefs.filter(href => {
                try {
                    const u = new URL(href);
                    // Only crawl same domain, exclude anchors usually
                    return u.origin === 'https://kelionai.app' && !href.includes('#');
                } catch { return false; }
            });

            for (const link of internalLinks) {
                const cleanLink = link.endsWith('/') && link.length > 1 ? link.slice(0, -1) : link;
                if (!visited.has(cleanLink) && !queue.includes(link)) {
                    queue.push(link);
                }
            }
            log(`Found ${internalLinks.length} links. Queue size: ${queue.length}`);

        } catch (err) {
            log(`Failed to process ${normalizedUrl}: ${err.message}`, 'ERROR');
        } finally {
            await page.close();
        }
    }

    // --- FINAL REPORT ---
    await browser.close();
    reportContent += `\n## Summary\n- **Pages Visited**: ${pageCount}\n- **Total Errors**: ${errorCount}\n- **Screenshots**: ${screenshotCount}\n`;
    fs.writeFileSync(reportPath, reportContent);
    console.log(`✅ Simulation Complete. Visited ${pageCount} pages.`);
})();
