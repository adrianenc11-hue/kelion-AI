/**
 * ═══════════════════════════════════════════════════════
 * K-BRAIN UI v1.0 — Brain Visual Components
 * ═══════════════════════════════════════════════════════
 * 
 * All UI components for the brain module:
 *   - Chat response rendering (emotion, confidence, feedback)
 *   - Brain Status Dashboard panel
 *   - Proactive suggestion bubbles
 */

(function (global) {
    'use strict';

    const BrainUI = {

        // ═══ CHAT RESPONSE BUBBLE ═══
        renderResponse(data, container) {
            const { reply, engine, model, usage, routing, emotion, confidence, suggestion } = data;

            const tokensInfo = (usage?.input || usage?.output)
                ? ` · ${usage?.input || 0}in/${usage?.output || 0}out` : '';
            const routingInfo = routing?.type ? ` · 🎯 ${routing.type}` : '';
            const emotionInfo = emotion?.emoji ? ` · ${emotion.emoji}` : '';

            const confScore = confidence?.score || 0;
            const confColor = confScore >= 80 ? '#00ff64' : confScore >= 60 ? '#ffc800' : confScore >= 40 ? '#ff9600' : '#ff3333';

            const confBar = confidence?.score ? `
                <div style="margin-top:6px;display:flex;align-items:center;gap:6px;">
                    <span style="color:#888;font-size:0.65rem;">🧠 Confidence:</span>
                    <div style="flex:1;height:4px;background:#333;border-radius:2px;max-width:100px;">
                        <div style="width:${confScore}%;height:100%;background:${confColor};border-radius:2px;transition:width 0.3s;"></div>
                    </div>
                    <span style="color:${confColor};font-size:0.65rem;font-weight:600;">${confScore}%</span>
                </div>` : '';

            const msgId = 'msg-' + Date.now();
            const bubble = document.createElement('div');
            bubble.style.cssText = 'text-align:left;margin:6px 0;animation:fadeIn 0.3s;';
            bubble.innerHTML = `<span id="${msgId}" style="background:#1a1a2e;color:#e0e0e0;padding:10px 14px;border-radius:16px 16px 16px 4px;display:inline-block;max-width:85%;word-wrap:break-word;border-left:3px solid #00ffff;">
                <span style="color:#00ffff;font-weight:700;font-size:0.8rem;">🧠 Brain</span>
                <span style="color:rgba(255,255,255,0.35);font-size:0.7rem;margin-left:6px;">${engine || 'brain'} · ${model || 'cascade'}${tokensInfo}${routingInfo}${emotionInfo}</span>
                <br><span style="font-size:0.9rem;">${reply}</span>
                ${confBar}
                <div style="margin-top:6px;display:flex;gap:8px;align-items:center;" id="${msgId}-feedback">
                    <button onclick="KBrain.learning.feedback('${engine}', 1); BrainUI.onFeedback('${msgId}', '${engine}', 1)" style="background:none;border:1px solid #333;border-radius:12px;padding:2px 10px;cursor:pointer;color:#888;font-size:0.8rem;transition:all 0.2s;" onmouseover="this.style.borderColor='#00ff64';this.style.color='#00ff64'" onmouseout="this.style.borderColor='#333';this.style.color='#888'">👍</button>
                    <button onclick="KBrain.learning.feedback('${engine}', -1); BrainUI.onFeedback('${msgId}', '${engine}', -1)" style="background:none;border:1px solid #333;border-radius:12px;padding:2px 10px;cursor:pointer;color:#888;font-size:0.8rem;transition:all 0.2s;" onmouseover="this.style.borderColor='#ff3333';this.style.color='#ff3333'" onmouseout="this.style.borderColor='#333';this.style.color='#888'">👎</button>
                </div>
            </span>`;

            if (container) {
                container.appendChild(bubble);
                container.scrollTop = container.scrollHeight;
            }

            // Show suggestion if available
            if (suggestion) {
                this.renderSuggestion(suggestion, container);
            }

            return bubble;
        },

        // ═══ FEEDBACK HANDLER ═══
        onFeedback(msgId, engine, score) {
            const feedbackDiv = document.getElementById(msgId + '-feedback');
            if (feedbackDiv) {
                const total = KBrain.learning.getScores()[engine] || 0;
                feedbackDiv.innerHTML = score > 0
                    ? `<span style="color:#00ff64;font-size:0.75rem;">✅ Mulțumesc! ${engine} +1 (total: ${total})</span>`
                    : `<span style="color:#ff6666;font-size:0.75rem;">📝 Notat. ${engine} ${total} — voi ajusta</span>`;
            }
        },

        // ═══ SUGGESTION BUBBLE ═══
        renderSuggestion(text, container) {
            const sugBub = document.createElement('div');
            sugBub.style.cssText = 'text-align:left;margin:6px 0;animation:fadeIn 0.3s;';
            sugBub.innerHTML = `<span style="background:rgba(0,255,204,0.08);color:#00ffcc;padding:8px 14px;border-radius:16px;display:inline-block;font-size:0.8rem;border:1px solid rgba(0,255,204,0.2);">
                💡 <strong>K sugerează:</strong> ${text}
            </span>`;
            if (container) {
                container.appendChild(sugBub);
                container.scrollTop = container.scrollHeight;
            }
        },

        // ═══ BRAIN STATUS DASHBOARD ═══
        createDashboard() {
            if (document.getElementById('brain-dashboard')) return;

            const dashboard = document.createElement('div');
            dashboard.id = 'brain-dashboard';
            dashboard.style.cssText = `
                position:fixed; bottom:80px; right:20px; width:320px;
                background:rgba(10,10,30,0.95); border:1px solid rgba(0,255,255,0.3);
                border-radius:16px; padding:16px; z-index:10000;
                font-family:'Inter',sans-serif; color:#e0e0e0;
                backdrop-filter:blur(12px); box-shadow:0 8px 32px rgba(0,0,0,0.5);
                display:none; transition:all 0.3s ease;
                max-height:70vh; overflow-y:auto;
            `;

            dashboard.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3 style="margin:0;color:#00ffff;font-size:0.95rem;">🧠 K-Brain Status</h3>
                    <span id="brain-dash-close" style="cursor:pointer;color:#888;font-size:1.2rem;" onclick="BrainUI.toggleDashboard()">✕</span>
                </div>
                <div id="brain-dash-content"></div>
            `;

            document.body.appendChild(dashboard);

            // Toggle button
            const btn = document.createElement('div');
            btn.id = 'brain-dash-toggle';
            btn.style.cssText = `
                position:fixed; bottom:20px; right:20px; width:50px; height:50px;
                background:linear-gradient(135deg, #0a0a1e, #1a1a3e);
                border:2px solid rgba(0,255,255,0.4); border-radius:50%;
                display:flex; align-items:center; justify-content:center;
                cursor:pointer; z-index:10001; font-size:1.5rem;
                box-shadow:0 4px 20px rgba(0,255,255,0.2);
                transition:all 0.3s; animation: brainPulse 3s infinite;
            `;
            btn.innerHTML = '🧠';
            btn.onclick = () => this.toggleDashboard();
            document.body.appendChild(btn);

            // Pulse animation
            if (!document.getElementById('brain-dash-styles')) {
                const style = document.createElement('style');
                style.id = 'brain-dash-styles';
                style.textContent = `
                    @keyframes brainPulse {
                        0%, 100% { box-shadow: 0 4px 20px rgba(0,255,255,0.2); }
                        50% { box-shadow: 0 4px 30px rgba(0,255,255,0.5); }
                    }
                    #brain-dashboard::-webkit-scrollbar { width: 4px; }
                    #brain-dashboard::-webkit-scrollbar-thumb { background: #00ffff33; border-radius: 4px; }
                `;
                document.head.appendChild(style);
            }

            // Auto-refresh every 5 seconds
            setInterval(() => {
                if (dashboard.style.display !== 'none') this.updateDashboard();
            }, 5000);
        },

        toggleDashboard() {
            const dash = document.getElementById('brain-dashboard');
            if (!dash) return;
            dash.style.display = dash.style.display === 'none' ? 'block' : 'none';
            if (dash.style.display !== 'none') this.updateDashboard();
        },

        updateDashboard() {
            const content = document.getElementById('brain-dash-content');
            if (!content || !global.KBrain) return;

            const status = global.KBrain.getStatus();
            const scores = status.engineScores;
            const patterns = status.patterns;
            const lastEmo = status.lastEmotion;

            // Build engine scores bar chart
            let engineBars = '';
            const sortedEngines = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 6);
            if (sortedEngines.length > 0) {
                const maxScore = Math.max(...sortedEngines.map(e => Math.abs(e[1])), 1);
                engineBars = sortedEngines.map(([name, score]) => {
                    const width = Math.abs(score) / maxScore * 100;
                    const color = score > 0 ? '#00ff64' : '#ff3333';
                    return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
                        <span style="color:#888;font-size:0.65rem;width:60px;text-align:right;">${name}</span>
                        <div style="flex:1;height:6px;background:#222;border-radius:3px;">
                            <div style="width:${width}%;height:100%;background:${color};border-radius:3px;"></div>
                        </div>
                        <span style="color:${color};font-size:0.65rem;width:25px;">${score > 0 ? '+' : ''}${score}</span>
                    </div>`;
                }).join('');
            } else {
                engineBars = '<span style="color:#555;font-size:0.7rem;">Niciun feedback încă</span>';
            }

            // Confidence history sparkline
            const confHistory = status.confidenceHistory || [];
            const confDots = confHistory.map(c => {
                const color = c.score >= 80 ? '#00ff64' : c.score >= 60 ? '#ffc800' : '#ff3333';
                return `<span style="color:${color};font-size:0.7rem;">${c.score}%</span>`;
            }).join(' → ') || '<span style="color:#555;font-size:0.7rem;">—</span>';

            // Emotion history
            const emoHistory = (status.emotionHistory || []).map(e => e.emoji).join(' ') || '—';

            // Query stats
            const totalQ = patterns._totalQueries || 0;

            content.innerHTML = `
                <div style="margin-bottom:10px;">
                    <div style="color:#888;font-size:0.7rem;margin-bottom:4px;">⚡ STATUS</div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <span style="background:#0a2a0a;color:#00ff64;padding:2px 8px;border-radius:8px;font-size:0.7rem;">● Ready</span>
                        <span style="background:#1a1a2e;color:#00ccff;padding:2px 8px;border-radius:8px;font-size:0.7rem;">v${status.version}</span>
                        <span style="background:#1a1a2e;color:#ffc800;padding:2px 8px;border-radius:8px;font-size:0.7rem;">📝 ${totalQ} queries</span>
                        <span style="background:#1a1a2e;color:#e0e0e0;padding:2px 8px;border-radius:8px;font-size:0.7rem;">💬 ${status.contextSize} ctx</span>
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <div style="color:#888;font-size:0.7rem;margin-bottom:4px;">😔 EMOȚIE CURENTĂ</div>
                    <div style="font-size:1.2rem;">${lastEmo ? `${lastEmo.emoji} ${lastEmo.emotion}` : '😐 neutral'}</div>
                    <div style="color:#555;font-size:0.65rem;margin-top:2px;">Istoric: ${emoHistory}</div>
                </div>

                <div style="margin-bottom:10px;">
                    <div style="color:#888;font-size:0.7rem;margin-bottom:4px;">🎯 CONFIDENCE TREND</div>
                    <div>${confDots}</div>
                </div>

                <div style="margin-bottom:10px;">
                    <div style="color:#888;font-size:0.7rem;margin-bottom:4px;">🧬 ENGINE SCORES (Neuroplasticitate)</div>
                    ${engineBars}
                </div>

                ${status.bestEngine ? `<div style="margin-bottom:10px;">
                    <div style="color:#888;font-size:0.7rem;">🏆 Motor preferat: <span style="color:#00ffcc;">${status.bestEngine}</span></div>
                </div>` : ''}
            `;
        }
    };

    // Export to global
    global.BrainUI = BrainUI;

})(typeof window !== 'undefined' ? window : global);
