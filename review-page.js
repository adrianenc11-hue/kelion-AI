// Step-by-step review: opens ONE page, blocks redirects, stays open
const { chromium } = require('playwright');

const page_url = process.argv[2] || 'https://kelionai.app';
const page_name = process.argv[3] || 'page';

(async () => {
    console.log('==========================================');
    console.log('  REVIEW: ' + page_name);
    console.log('  URL: ' + page_url);
    console.log('  INCHIDE MANUAL browser-ul cand termini!');
    console.log('==========================================');

    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized', '--disable-popup-blocking']
    });
    const context = await browser.newContext({
        viewport: null,
        permissions: ['camera', 'microphone', 'geolocation']
    });
    const page = await context.newPage();

    // Block redirects after initial load
    await page.goto(page_url, { waitUntil: 'load', timeout: 30000 });

    // Prevent any further navigation/redirects
    await page.evaluate(() => {
        // Block window.location changes
        const origAssign = window.location.assign;
        const origReplace = window.location.replace;
        window.location.assign = () => console.log('BLOCKED redirect');
        window.location.replace = () => console.log('BLOCKED redirect');
        // Block window.close
        window.close = () => console.log('BLOCKED close');
    });

    console.log('  Pagina incarcata! Asteapta review...');

    // Wait for browser to be closed manually by user
    await new Promise(resolve => browser.on('disconnected', resolve));

    console.log('  Browser inchis. Review complet.');
})();
