// ═══ IMAGE EDITOR — Procesare imagini ═══

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            case 'resize':
                return respond(200, resize(body));
            case 'crop':
                return respond(200, crop(body));
            case 'filter':
                return respond(200, applyFilter(body));
            case 'compress':
                return respond(200, compress(body));
            case 'convert':
                return respond(200, convertFormat(body));
            case 'watermark':
                return respond(200, addWatermark(body));
            case 'thumbnail':
                return respond(200, generateThumbnail(body));
            case 'info':
                return respond(200, getInfo(body));
            default:
                return respond(400, { error: 'Actions: resize, crop, filter, compress, convert, watermark, thumbnail, info' });
        }
    } catch (err) {
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

function resize({ width, height, original_width, original_height, maintain_aspect = true }) {
    if (!width && !height) return { error: 'Need width and/or height' };

    let newW = width, newH = height;
    const ow = original_width || 1920;
    const oh = original_height || 1080;

    if (maintain_aspect) {
        if (width && !height) newH = Math.round(width * oh / ow);
        else if (height && !width) newW = Math.round(height * ow / oh);
        else {
            const ratio = Math.min(width / ow, height / oh);
            newW = Math.round(ow * ratio);
            newH = Math.round(oh * ratio);
        }
    }

    return {
        operation: 'resize',
        original: { width: ow, height: oh },
        result: { width: newW, height: newH },
        scale: `${Math.round(newW / ow * 100)}%`,
        aspect_ratio: simplifyRatio(newW, newH),
        css_code: `width: ${newW}px; height: ${newH}px;`,
        html_code: `<img src="image.jpg" width="${newW}" height="${newH}" alt="">`
    };
}

function crop({ x = 0, y = 0, width, height, original_width = 1920, original_height = 1080, preset }) {
    const presets = {
        square: { x: 0, y: 0, w: Math.min(original_width, original_height), h: Math.min(original_width, original_height) },
        '16:9': { x: 0, y: 0, w: original_width, h: Math.round(original_width * 9 / 16) },
        '4:3': { x: 0, y: 0, w: original_width, h: Math.round(original_width * 3 / 4) },
        '1:1': { x: 0, y: 0, w: Math.min(original_width, original_height), h: Math.min(original_width, original_height) },
        instagram_post: { x: 0, y: 0, w: 1080, h: 1080 },
        instagram_story: { x: 0, y: 0, w: 1080, h: 1920 },
        facebook_cover: { x: 0, y: 0, w: 820, h: 312 },
        youtube_thumb: { x: 0, y: 0, w: 1280, h: 720 },
        twitter_header: { x: 0, y: 0, w: 1500, h: 500 },
        linkedin_cover: { x: 0, y: 0, w: 1584, h: 396 }
    };

    if (preset && presets[preset]) {
        const p = presets[preset];
        return { operation: 'crop', preset, original: { width: original_width, height: original_height }, crop_area: p, result: { width: p.w, height: p.h } };
    }

    return {
        operation: 'crop',
        original: { width: original_width, height: original_height },
        crop_area: { x, y, width: width || original_width, height: height || original_height },
        result: { width: width || original_width, height: height || original_height },
        available_presets: Object.keys(presets)
    };
}

function applyFilter({ filter, intensity = 100 }) {
    const filters = {
        grayscale: { css: `filter: grayscale(${intensity}%)`, description: 'Alb-negru' },
        sepia: { css: `filter: sepia(${intensity}%)`, description: 'Sepia (ton cald retro)' },
        blur: { css: `filter: blur(${Math.round(intensity / 20)}px)`, description: 'Blur (estompare)' },
        brightness: { css: `filter: brightness(${intensity}%)`, description: 'Luminozitate' },
        contrast: { css: `filter: contrast(${intensity}%)`, description: 'Contrast' },
        saturate: { css: `filter: saturate(${intensity}%)`, description: 'Saturație culori' },
        hue_rotate: { css: `filter: hue-rotate(${Math.round(intensity * 3.6)}deg)`, description: 'Rotire nuanță' },
        invert: { css: `filter: invert(${intensity}%)`, description: 'Inversare culori' },
        vintage: { css: 'filter: sepia(40%) contrast(110%) brightness(90%) saturate(80%)', description: 'Efect vintage' },
        dramatic: { css: 'filter: contrast(150%) brightness(80%) saturate(120%)', description: 'Efect dramatic' },
        warm: { css: 'filter: sepia(20%) saturate(140%) brightness(105%)', description: 'Tonuri calde' },
        cool: { css: 'filter: hue-rotate(180deg) saturate(60%) brightness(105%)', description: 'Tonuri reci' },
        noir: { css: 'filter: grayscale(100%) contrast(150%) brightness(80%)', description: 'Film noir' }
    };

    if (!filter) return { available_filters: Object.entries(filters).map(([k, v]) => ({ name: k, description: v.description })) };

    const f = filters[filter];
    if (!f) return { error: `Filtru necunoscut. Disponibile: ${Object.keys(filters).join(', ')}` };

    return {
        operation: 'filter',
        filter, intensity,
        description: f.description,
        css_code: f.css,
        html_example: `<img src="image.jpg" style="${f.css}" alt="">`,
        tip: 'Aplică CSS-ul pe elementul <img> pentru efect instant'
    };
}

function compress({ original_size_kb, quality = 80, format = 'webp' }) {
    const compressionRates = { webp: 0.35, jpg: 0.55, png: 0.85, avif: 0.25 };
    const rate = compressionRates[format] || 0.5;
    const estimated = Math.round((original_size_kb || 500) * rate * (quality / 100));

    return {
        operation: 'compress',
        original_size: `${original_size_kb || 500} KB`,
        estimated_size: `${estimated} KB`,
        savings: `${Math.round((1 - estimated / (original_size_kb || 500)) * 100)}%`,
        format, quality,
        recommendation: format === 'webp' ? '✅ WebP e cel mai eficient pentru web' : format === 'avif' ? '✅ AVIF e cel mai nou, suport 90%+ browsere' : '⚠️ Consideră WebP pentru compresie mai bună',
        html_code: `<picture>\n  <source srcset="image.avif" type="image/avif">\n  <source srcset="image.webp" type="image/webp">\n  <img src="image.${format}" alt="" loading="lazy">\n</picture>`
    };
}

function convertFormat({ from, to, _size_kb }) {
    const formats = {
        jpg: { mime: 'image/jpeg', transparency: false, animation: false, quality: 'lossy' },
        png: { mime: 'image/png', transparency: true, animation: false, quality: 'lossless' },
        webp: { mime: 'image/webp', transparency: true, animation: true, quality: 'both' },
        avif: { mime: 'image/avif', transparency: true, animation: true, quality: 'both' },
        gif: { mime: 'image/gif', transparency: true, animation: true, quality: 'lossless' },
        svg: { mime: 'image/svg+xml', transparency: true, animation: true, quality: 'vector' },
        bmp: { mime: 'image/bmp', transparency: false, animation: false, quality: 'lossless' }
    };

    return {
        operation: 'convert',
        from: { format: from, ...formats[from] },
        to: { format: to, ...formats[to] },
        notes: to === 'webp' ? '✅ Recomandat pentru web — suport 97%+ browsere' : to === 'svg' ? '⚠️ Doar pentru grafice vectoriale, nu foto' : ''
    };
}

function addWatermark({ text = 'Kelion AI', position = 'bottom-right', opacity = 50 }) {
    const positions = {
        'top-left': 'top: 10px; left: 10px;',
        'top-right': 'top: 10px; right: 10px;',
        'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
        'bottom-left': 'bottom: 10px; left: 10px;',
        'bottom-right': 'bottom: 10px; right: 10px;'
    };

    return {
        operation: 'watermark',
        text, position, opacity: `${opacity}%`,
        css_code: `position: relative;\n/* Watermark pseudo-element */\n.watermarked::after {\n  content: '${text}';\n  position: absolute;\n  ${positions[position] || positions['bottom-right']}\n  opacity: ${opacity / 100};\n  font-size: 14px;\n  color: white;\n  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);\n}`
    };
}

function generateThumbnail({ original_width = 1920, original_height = 1080, _sizes = 'standard' }) {
    const standard = [
        { name: 'xs', width: 150, height: Math.round(150 * original_height / original_width) },
        { name: 'sm', width: 300, height: Math.round(300 * original_height / original_width) },
        { name: 'md', width: 600, height: Math.round(600 * original_height / original_width) },
        { name: 'lg', width: 1200, height: Math.round(1200 * original_height / original_width) }
    ];

    return {
        operation: 'thumbnail',
        original: { width: original_width, height: original_height },
        thumbnails: standard,
        srcset: standard.map(s => `image-${s.width}.webp ${s.width}w`).join(', '),
        html_responsive: `<img srcset="${standard.map(s => `image-${s.width}.webp ${s.width}w`).join(', ')}" sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px" src="image-600.webp" alt="" loading="lazy">`
    };
}

function getInfo({ width, height, format, size_kb }) {
    const megapixels = width && height ? Math.round(width * height / 1000000 * 10) / 10 : 'N/A';
    return {
        dimensions: width && height ? `${width} × ${height}` : 'N/A',
        megapixels,
        aspect_ratio: width && height ? simplifyRatio(width, height) : 'N/A',
        format: format || 'N/A',
        size: size_kb ? `${size_kb} KB (${Math.round(size_kb / 1024 * 100) / 100} MB)` : 'N/A',
        orientation: width > height ? '🖼️ Landscape' : width < height ? '📱 Portrait' : '⬜ Square',
        print_sizes: width && height ? {
            '300dpi': `${Math.round(width / 300 * 2.54)} × ${Math.round(height / 300 * 2.54)} cm`,
            '150dpi': `${Math.round(width / 150 * 2.54)} × ${Math.round(height / 150 * 2.54)} cm`,
            '72dpi': `${Math.round(width / 72 * 2.54)} × ${Math.round(height / 72 * 2.54)} cm`
        } : 'N/A'
    };
}

function simplifyRatio(w, h) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const d = gcd(w, h);
    return `${w / d}:${h / d}`;
}
