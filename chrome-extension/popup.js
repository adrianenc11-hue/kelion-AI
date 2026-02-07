// Popup logic for Kelion Browser Control Extension

document.addEventListener('DOMContentLoaded', async () => {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Update URL display
    const urlDisplay = document.getElementById('current-url');
    try {
        const url = new URL(tab.url);
        urlDisplay.textContent = url.hostname;
    } catch (e) {
        urlDisplay.textContent = 'N/A';
    }

    // Get command count from storage
    chrome.storage.local.get(['commandCount'], (result) => {
        document.getElementById('command-count').textContent = result.commandCount || 0;
    });

    // Test button - demonstrates click detection
    document.getElementById('test-btn').addEventListener('click', async () => {
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'click',
            text: 'Live'  // Try to find and click "Live" button
        });

        if (response.success) {
            alert('✅ Successfully found and clicked "Live" button!');
        } else {
            alert('❌ Could not find "Live" button on this page');
        }
    });

    // Open K button
    document.getElementById('open-k-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://kelionai.app' });
    });
});
