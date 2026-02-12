// ═══ AUDIO EDITOR — Procesare audio ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'analyze': return respond(200, analyzeAudio(body));
            case 'convert': return respond(200, convertAudio(body));
            case 'normalize': return respond(200, normalizeAudio(body));
            case 'mix_settings': return respond(200, mixSettings(body));
            case 'podcast_setup': return respond(200, podcastSetup(body));
            default: return respond(400, { error: 'Actions: analyze, convert, normalize, mix_settings, podcast_setup' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function analyzeAudio({ duration_sec = 180, sample_rate = 44100, bit_depth = 16, channels = 2 }) {
    const bitrate = sample_rate * bit_depth * channels;
    const sizes = { wav: bitrate / 8 * duration_sec, mp3_128: 128000 / 8 * duration_sec, mp3_320: 320000 / 8 * duration_sec, flac: bitrate / 8 * duration_sec * 0.6, aac_256: 256000 / 8 * duration_sec };
    const fmt = b => b < 1048576 ? `${Math.round(b / 1024)} KB` : `${Math.round(b / 1048576 * 10) / 10} MB`;
    return { duration: `${Math.floor(duration_sec / 60)}:${String(Math.round(duration_sec % 60)).padStart(2, '0')}`, sample_rate: `${sample_rate} Hz`, bit_depth: `${bit_depth}-bit`, channels: channels === 1 ? 'Mono' : 'Stereo', bitrate: `${Math.round(bitrate / 1000)} kbps`, sizes: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, fmt(v)])), quality: sample_rate >= 48000 && bit_depth >= 24 ? '✅ Studio' : '✅ CD' };
}

function convertAudio({ from = 'wav', to = 'mp3' }) {
    const fmts = { wav: { type: 'Lossless', use: 'Editare' }, mp3: { type: 'Lossy', use: 'Streaming' }, flac: { type: 'Lossless', use: 'Audiofil' }, aac: { type: 'Lossy', use: 'Apple/YouTube' }, ogg: { type: 'Lossy', use: 'Web/Gaming' }, opus: { type: 'Lossy', use: 'VoIP/Web' } };
    return { from: { format: from, ...(fmts[from] || {}) }, to: { format: to, ...(fmts[to] || {}) }, ffmpeg: `ffmpeg -i input.${from} ${to === 'mp3' ? '-codec:a libmp3lame -b:a 320k' : to === 'flac' ? '-codec:a flac' : '-codec:a aac -b:a 256k'} output.${to}` };
}

function normalizeAudio({ current_db = -20, target_db = -3 }) {
    return { gain: `${target_db - current_db > 0 ? '+' : ''}${target_db - current_db} dB`, standards: { music: '-14 LUFS (Spotify)', podcast: '-16 LUFS (Apple)', broadcast: '-24 LUFS (EBU R128)' }, ffmpeg: 'ffmpeg -i input.mp3 -af "loudnorm=I=-14:TP=-1:LRA=11" output.mp3' };
}

function mixSettings({ genre = 'pop' }) {
    const t = { pop: { vocals: '0dB C, HPF 80Hz, comp 3:1', drums: '-3dB C, +4dB 60Hz', bass: '-4dB C, comp 4:1', guitars: '-6dB L30/R30' }, podcast: { host: '0dB C, HPF 80Hz, gate -40dB', guest: '-1dB, HPF 80Hz', music_bed: '-20dB, sidechain' } };
    return { genre, template: t[genre] || t.pop, master: ['EQ', 'Compressor', 'Limiter -1dB'], loudness: genre === 'podcast' ? '-16 LUFS' : '-14 LUFS' };
}

function podcastSetup({ budget = 'medium' }) {
    const s = { low: { mic: 'Blue Yeti USB ~100€', total: '~200€' }, medium: { mic: 'Rode NT1-A + Scarlett 2i2 ~350€', total: '~500€' }, high: { mic: 'Shure SM7B + RME ~1500€', total: '~2500€' } };
    return { budget, equipment: s[budget] || s.medium, tips: ['🎙️ 15-20cm distanță', '🔇 Elimină zgomot', '📊 Nivel -12dB peak', '💧 Hidratare'] };
}
