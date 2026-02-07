# Kelion AI Browser Control Extension

## Installation Guide

### Step 1: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Navigate to: `c:\Users\adria\Downloads\k new\kelionat_clean\chrome-extension\`
5. Click **Select Folder**

✅ Extension is now installed!

### Step 2: Verify Installation

1. Look for Kelion AI icon in Chrome toolbar (purple/cyan gradient)
2. Click the icon to open popup
3. Should show "Status: Active"

### Step 3: Test Extension

1. Go to <https://radiozu.ro>
2. Click Kelion AI extension icon
3. Click **Test Click Detection**
4. If "Live" button exists on page, it will be clicked automatically!

## Using with K AI

Once extension is installed, K can control any website!

### Example Commands

**Play Radio ZU Live**:

```
User: "K, play Radio ZU live"
→ K: navigateAndClick('radiozu.ro', 'Live')
→ Radio starts playing!
```

**Search YouTube**:

```
User: "K, search YouTube for AI tutorials"
→ K: navigateTo('youtube.com')
→ K: fillForm([{selector: 'input[name="search_query"]', value: 'AI tutorials'}])
→ K: clickElement('button[type="submit"]')
```

**Google Search**:

```
User: "K, google 'weather in Bucharest'"
→ K: navigateTo('google.com/search?q=weather+in+Bucharest')
```

## Advanced Usage

### From Browser Console

```javascript
// Navigate and click
await chromeExtensionControl.navigateAndClick('https://radiozu.ro', 'Live');

// Click existing element
await chromeExtensionControl.clickElement(null, 'Login');

// Fill form
await chromeExtensionControl.fillForm([
  { selector: '#email', value: 'user@example.com' },
  { selector: '#password', value: 'secret' }
]);

// Take screenshot
const screenshot = await chromeExtensionControl.takeScreenshot();
```

## Troubleshooting

**Extension not working?**

- Check Chrome Extensions page: `chrome://extensions/`
- Ensure extension is **Enabled**
- Click **Reload** if needed

**"Extension not detected" error?**

- Refresh the page (Ctrl+R)
- Open Developer Console (F12) and check for errors

**Element not found?**

- Try different button text (case-insensitive)
- Check if page has loaded completely
- Use browser DevTools to inspect element

## Features

✅ Smart element detection (text, aria-label, title)
✅ Auto-scroll to elements
✅ Form filling
✅ Screenshot capture
✅ Multi-page workflows
✅ Error handling & retry logic

## Security

- Extension only responds to kelionai.app domain
- No data collection
- Runs only when user commands
- Full source code available

---

**Version**: 1.0.0  
**Author**: Kelion AI  
**Website**: <https://kelionai.app>
