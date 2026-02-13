const { test, expect } = require('@playwright/test');

test('monitor avatars visibility', async ({ page }) => {
    // 1. Go to live site
    console.log('Navigating to https://kelionai.app ...');
    await page.goto('https://kelionai.app', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 2. Wait for avatar overlay to be present (it might be hidden if user selection logic runs fast, but we check existence)
    // Actually, on landing page, avatars are in .avatar-overlay which is visible initially or handles selection.
    // We want to check the 3D canvases specifically.

    const maleCanvas = page.locator('#av3d-male');
    const femaleCanvas = page.locator('#av3d-female');

    // 3. Check visibility
    // Note: If overlay is hidden because user is "logged in" or "selected", we might need to clear storage first.
    // But for a fresh "incognito" visit (which Playwright does), it should be visible.

    await expect(maleCanvas).toBeVisible({ timeout: 10000 });
    await expect(femaleCanvas).toBeVisible({ timeout: 10000 });

    console.log('✅ Both Avatars are VISIBLE on the page.');

    // 4. Take screenshot for proof
    await page.screenshot({ path: 'avatar-monitor-proof.png', fullPage: true });
    console.log('📸 Screenshot saved to avatar-monitor-proof.png');
});
