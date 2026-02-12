// version-badge.js — Displays live version from health-check API
// Shows in bottom-left corner of all pages
(function () {
    if (window._versionBadgeLoaded) return;
    window._versionBadgeLoaded = true;

    const badge = document.createElement('div');
    badge.id = 'version-badge';
    badge.style.cssText = 'position:fixed;bottom:8px;left:8px;padding:3px 10px;border-radius:12px;background:rgba(0,0,0,0.3);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.04);font-size:.6rem;color:rgba(255,255,255,0.2);font-family:monospace;z-index:50;cursor:default;transition:opacity .3s';
    badge.textContent = 'v...';
    badge.title = 'Kelion AI Version';
    document.body.appendChild(badge);

    fetch('/.netlify/functions/health-check')
        .then(r => r.json())
        .then(d => {
            badge.textContent = d.version || 'v?';
            badge.title = `Kelion AI ${d.version} — ${d.status === 'ok' ? 'All systems online' : 'Issues detected'}`;
            badge.style.borderColor = d.status === 'ok' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)';
        })
        .catch(() => { badge.textContent = 'v?'; });
})();
