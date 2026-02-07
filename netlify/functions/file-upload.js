// File Upload & PDF Reader - Analyze uploaded documents (PDF, CSV, TXT, images)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { file_base64, file_url, file_type, question } = JSON.parse(event.body || '{}');
        if (!file_base64 && !file_url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'file_base64 or file_url required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const type = file_type || 'auto';
        const userQuestion = question || 'Analizează acest document. Extrage informațiile cheie, rezumatul, și punctele importante.';

        let content = [];

        // For images and PDFs — use vision
        if (type === 'image' || type === 'pdf' || type === 'auto') {
            const imageData = file_url
                ? { type: 'image_url', image_url: { url: file_url } }
                : { type: 'image_url', image_url: { url: `data:image/${type === 'pdf' ? 'png' : 'jpeg'};base64,${file_base64}` } };

            content = [
                { type: 'text', text: `${userQuestion}\n\nAnalyze this document thoroughly. Extract:\n1. Summary\n2. Key points\n3. Important data/numbers\n4. Action items (if any)\nRespond in the user's language.` },
                imageData
            ];
        }

        // For text/CSV — direct text analysis
        if (type === 'text' || type === 'csv') {
            const textContent = file_base64 ? Buffer.from(file_base64, 'base64').toString('utf-8') : '';
            content = [
                { type: 'text', text: `${userQuestion}\n\nDocument content:\n\`\`\`\n${textContent.substring(0, 15000)}\n\`\`\`\n\nAnalyze this document thoroughly. Respond in the user's language.` }
            ];
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'Ești Kelion AI (K), expert în analiza documentelor. Extragi informații precise, faci rezumate clare, și identifici acțiuni necesare.'
                }, {
                    role: 'user',
                    content
                }],
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('File analysis error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'File analysis API error' }) };
        }

        const data = await response.json();
        const analysis = data.choices?.[0]?.message?.content || '';
        const u = data.usage || {};

        // Generate follow-up suggestions
        const followUps = generateFollowUps(analysis, type);

        // Log cost
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'gpt-4o-mini-file', input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0, endpoint: 'file-upload' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                analysis,
                word_count: analysis.split(/\s+/).filter(Boolean).length,
                file_type: type,
                follow_up_suggestions: followUps,
                model: 'gpt-4o-mini'
            })
        };
    } catch (error) {
        console.error('File upload error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

function generateFollowUps(analysis, type) {
    const suggestions = [];
    if (analysis.includes('tabel') || analysis.includes('date') || type === 'csv') {
        suggestions.push('📊 Creează un grafic cu aceste date');
        suggestions.push('📈 Care sunt tendințele principale?');
    }
    if (analysis.includes('contract') || analysis.includes('acord')) {
        suggestions.push('⚖️ Care sunt riscurile juridice?');
        suggestions.push('📋 Listează obligațiile părților');
    }
    suggestions.push('🔍 Explică mai detaliat punctul principal');
    suggestions.push('📝 Generează un rezumat executiv');
    suggestions.push('🌐 Traduce documentul în engleză');
    return suggestions.slice(0, 4);
}
