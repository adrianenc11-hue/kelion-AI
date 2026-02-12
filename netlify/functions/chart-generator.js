// ═══ CHART GENERATOR — SVG Charts (bar, pie, line, scatter, radar) ═══
// Generates charts server-side as SVG — zero dependencies

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const DEFAULT_COLORS = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
    '#00f2fe', '#43e97b', '#fa709a', '#fee140', '#30cfd0',
    '#a18cd1', '#fbc2eb', '#ff9a9e', '#fad0c4', '#ffecd2'
];

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    }

    try {
        const { type, data, title, colors, width, height } = JSON.parse(event.body || '{}');

        if (!type || !data || !Array.isArray(data) || data.length === 0) {
            return {
                statusCode: 400, headers,
                body: JSON.stringify({ error: 'Required: type (bar|pie|line|scatter|radar), data [{label, value}]' })
            };
        }

        const w = width || 800;
        const h = height || 500;
        const chartColors = colors || DEFAULT_COLORS;
        let svg;

        switch (type.toLowerCase()) {
            case 'bar':
                svg = generateBarChart(data, title, chartColors, w, h);
                break;
            case 'pie':
            case 'donut':
                svg = generatePieChart(data, title, chartColors, w, h, type === 'donut');
                break;
            case 'line':
                svg = generateLineChart(data, title, chartColors, w, h);
                break;
            case 'scatter':
                svg = generateScatterChart(data, title, chartColors, w, h);
                break;
            case 'radar':
                svg = generateRadarChart(data, title, chartColors, w, h);
                break;
            case 'horizontal_bar':
                svg = generateHorizontalBarChart(data, title, chartColors, w, h);
                break;
            default:
                return {
                    statusCode: 400, headers,
                    body: JSON.stringify({ error: `Unknown chart type: ${type}. Supported: bar, pie, donut, line, scatter, radar, horizontal_bar` })
                };
        }

        const base64 = Buffer.from(svg).toString('base64');
        const dataUrl = `data:image/svg+xml;base64,${base64}`;

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                svg: svg,
                image_url: dataUrl,
                chart_type: type,
                data_points: data.length,
                title: title || 'Chart'
            })
        };

    } catch (err) {
        console.error('Chart error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};

// ═══ BAR CHART ═══
function generateBarChart(data, title, colors, w, h) {
    const margin = { top: 60, right: 30, bottom: 80, left: 70 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const maxVal = Math.max(...data.map(d => d.value));
    const barWidth = Math.min(60, (chartW / data.length) * 0.7);
    const gap = (chartW - barWidth * data.length) / (data.length + 1);

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    // Title
    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    // Y-axis grid lines
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + chartH - (chartH * i / 5);
        const val = Math.round(maxVal * i / 5);
        svg += `<line x1="${margin.left}" y1="${y}" x2="${w - margin.right}" y2="${y}" stroke="#2d3748" stroke-width="1"/>`;
        svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#a0aec0" font-family="Arial">${val}</text>`;
    }

    // Bars
    data.forEach((d, i) => {
        const x = margin.left + gap + i * (barWidth + gap);
        const barH = (d.value / maxVal) * chartH;
        const y = margin.top + chartH - barH;
        const color = colors[i % colors.length];

        // Bar with rounded top
        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" opacity="0.9">`;
        svg += `<animate attributeName="height" from="0" to="${barH}" dur="0.5s" fill="freeze"/>`;
        svg += `<animate attributeName="y" from="${margin.top + chartH}" to="${y}" dur="0.5s" fill="freeze"/>`;
        svg += `</rect>`;

        // Value label
        svg += `<text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="13" font-weight="bold" fill="${color}" font-family="Arial">${d.value}</text>`;

        // X-axis label
        svg += `<text x="${x + barWidth / 2}" y="${margin.top + chartH + 20}" text-anchor="middle" font-size="11" fill="#a0aec0" font-family="Arial" transform="rotate(-30, ${x + barWidth / 2}, ${margin.top + chartH + 20})">${esc(String(d.label).substring(0, 15))}</text>`;
    });

    // Axes
    svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartH}" stroke="#4a5568" stroke-width="2"/>`;
    svg += `<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${w - margin.right}" y2="${margin.top + chartH}" stroke="#4a5568" stroke-width="2"/>`;

    svg += '</svg>';
    return svg;
}

// ═══ PIE CHART ═══
function generatePieChart(data, title, colors, w, h, isDonut = false) {
    const cx = w / 2;
    const cy = h / 2 + (title ? 15 : 0);
    const r = Math.min(w, h) / 2 - 80;
    const innerR = isDonut ? r * 0.55 : 0;
    const total = data.reduce((s, d) => s + d.value, 0);

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    let startAngle = -Math.PI / 2;
    data.forEach((d, i) => {
        const sliceAngle = (d.value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;
        const color = colors[i % colors.length];

        // Arc path
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        let path;
        if (isDonut) {
            const ix1 = cx + innerR * Math.cos(startAngle);
            const iy1 = cy + innerR * Math.sin(startAngle);
            const ix2 = cx + innerR * Math.cos(endAngle);
            const iy2 = cy + innerR * Math.sin(endAngle);
            path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
        } else {
            path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }

        svg += `<path d="${path}" fill="${color}" stroke="#1a1a2e" stroke-width="2" opacity="0.9"/>`;

        // Label
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = r + 25;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        const pct = Math.round((d.value / total) * 100);

        svg += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="#e2e8f0" font-family="Arial">${esc(String(d.label).substring(0, 12))} (${pct}%)</text>`;

        startAngle = endAngle;
    });

    // Donut center text
    if (isDonut) {
        svg += `<text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="24" font-weight="bold" fill="#e2e8f0" font-family="Arial">${total}</text>`;
        svg += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#a0aec0" font-family="Arial">Total</text>`;
    }

    svg += '</svg>';
    return svg;
}

// ═══ LINE CHART ═══
function generateLineChart(data, title, colors, w, h) {
    const margin = { top: 60, right: 30, bottom: 80, left: 70 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const maxVal = Math.max(...data.map(d => d.value));
    const minVal = Math.min(...data.map(d => d.value));
    const range = maxVal - minVal || 1;

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    // Grid
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + chartH - (chartH * i / 5);
        const val = Math.round(minVal + range * i / 5);
        svg += `<line x1="${margin.left}" y1="${y}" x2="${w - margin.right}" y2="${y}" stroke="#2d3748" stroke-width="1"/>`;
        svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#a0aec0" font-family="Arial">${val}</text>`;
    }

    // Line path + area fill
    const points = data.map((d, i) => {
        const x = margin.left + (i / (data.length - 1 || 1)) * chartW;
        const y = margin.top + chartH - ((d.value - minVal) / range) * chartH;
        return { x, y };
    });

    // Area gradient
    const gradId = 'lineGrad';
    svg += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`;
    svg += `<stop offset="0%" stop-color="${colors[0]}" stop-opacity="0.3"/>`;
    svg += `<stop offset="100%" stop-color="${colors[0]}" stop-opacity="0.02"/>`;
    svg += `</linearGradient></defs>`;

    // Area
    let areaPath = `M ${points[0].x} ${margin.top + chartH}`;
    points.forEach(p => areaPath += ` L ${p.x} ${p.y}`);
    areaPath += ` L ${points[points.length - 1].x} ${margin.top + chartH} Z`;
    svg += `<path d="${areaPath}" fill="url(#${gradId})"/>`;

    // Line
    let linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    svg += `<path d="${linePath}" fill="none" stroke="${colors[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Dots + labels
    points.forEach((p, i) => {
        svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${colors[0]}" stroke="#1a1a2e" stroke-width="2"/>`;
        svg += `<text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="11" fill="#e2e8f0" font-family="Arial">${data[i].value}</text>`;
        svg += `<text x="${p.x}" y="${margin.top + chartH + 20}" text-anchor="middle" font-size="10" fill="#a0aec0" font-family="Arial" transform="rotate(-30, ${p.x}, ${margin.top + chartH + 20})">${esc(String(data[i].label).substring(0, 12))}</text>`;
    });

    // Axes
    svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartH}" stroke="#4a5568" stroke-width="2"/>`;
    svg += `<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${w - margin.right}" y2="${margin.top + chartH}" stroke="#4a5568" stroke-width="2"/>`;

    svg += '</svg>';
    return svg;
}

// ═══ SCATTER CHART ═══
function generateScatterChart(data, title, colors, w, h) {
    const margin = { top: 60, right: 30, bottom: 60, left: 70 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const maxVal = Math.max(...data.map(d => d.value));

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    // Grid
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + chartH - (chartH * i / 5);
        svg += `<line x1="${margin.left}" y1="${y}" x2="${w - margin.right}" y2="${y}" stroke="#2d3748" stroke-width="1"/>`;
    }

    // Points
    data.forEach((d, i) => {
        const x = margin.left + (i / (data.length - 1 || 1)) * chartW;
        const y = margin.top + chartH - (d.value / maxVal) * chartH;
        const color = colors[i % colors.length];
        svg += `<circle cx="${x}" cy="${y}" r="8" fill="${color}" opacity="0.8" stroke="#1a1a2e" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="10" fill="#e2e8f0" font-family="Arial">${esc(String(d.label).substring(0, 10))}</text>`;
    });

    svg += '</svg>';
    return svg;
}

// ═══ RADAR CHART ═══
function generateRadarChart(data, title, colors, w, h) {
    const cx = w / 2;
    const cy = h / 2 + (title ? 15 : 0);
    const r = Math.min(w, h) / 2 - 80;
    const maxVal = Math.max(...data.map(d => d.value));
    const n = data.length;

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    // Grid rings
    for (let ring = 1; ring <= 5; ring++) {
        const rr = r * ring / 5;
        let points = [];
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i / n) - Math.PI / 2;
            points.push(`${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`);
        }
        svg += `<polygon points="${points.join(' ')}" fill="none" stroke="#2d3748" stroke-width="1"/>`;
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i / n) - Math.PI / 2;
        const ax = cx + r * Math.cos(angle);
        const ay = cy + r * Math.sin(angle);
        svg += `<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="#2d3748" stroke-width="1"/>`;

        // Labels
        const lx = cx + (r + 20) * Math.cos(angle);
        const ly = cy + (r + 20) * Math.sin(angle);
        svg += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="11" fill="#a0aec0" font-family="Arial">${esc(String(data[i].label).substring(0, 12))}</text>`;
    }

    // Data polygon
    let dataPoints = [];
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i / n) - Math.PI / 2;
        const val = (data[i].value / maxVal) * r;
        dataPoints.push(`${cx + val * Math.cos(angle)},${cy + val * Math.sin(angle)}`);
    }
    svg += `<polygon points="${dataPoints.join(' ')}" fill="${colors[0]}" fill-opacity="0.3" stroke="${colors[0]}" stroke-width="2"/>`;

    // Data dots
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i / n) - Math.PI / 2;
        const val = (data[i].value / maxVal) * r;
        svg += `<circle cx="${cx + val * Math.cos(angle)}" cy="${cy + val * Math.sin(angle)}" r="5" fill="${colors[0]}" stroke="#1a1a2e" stroke-width="2"/>`;
    }

    svg += '</svg>';
    return svg;
}

// ═══ HORIZONTAL BAR CHART ═══
function generateHorizontalBarChart(data, title, colors, w, h) {
    const margin = { top: 60, right: 60, bottom: 30, left: 120 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const maxVal = Math.max(...data.map(d => d.value));
    const barHeight = Math.min(35, (chartH / data.length) * 0.7);
    const gap = (chartH - barHeight * data.length) / (data.length + 1);

    let svg = svgHeader(w, h);
    svg += svgBackground(w, h);

    if (title) {
        svg += `<text x="${w / 2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="#e2e8f0" font-family="Arial">${esc(title)}</text>`;
    }

    data.forEach((d, i) => {
        const y = margin.top + gap + i * (barHeight + gap);
        const barW = (d.value / maxVal) * chartW;
        const color = colors[i % colors.length];

        svg += `<rect x="${margin.left}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="${color}" opacity="0.9"/>`;
        svg += `<text x="${margin.left - 8}" y="${y + barHeight / 2 + 4}" text-anchor="end" font-size="12" fill="#a0aec0" font-family="Arial">${esc(String(d.label).substring(0, 15))}</text>`;
        svg += `<text x="${margin.left + barW + 8}" y="${y + barHeight / 2 + 4}" font-size="13" font-weight="bold" fill="${color}" font-family="Arial">${d.value}</text>`;
    });

    svg += '</svg>';
    return svg;
}

// ═══ SVG Utilities ═══
function svgHeader(w, h) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
}

function svgBackground(w, h) {
    return `<rect width="${w}" height="${h}" rx="12" fill="#1a1a2e"/>`;
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
