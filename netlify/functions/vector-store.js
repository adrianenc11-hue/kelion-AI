// Vector Store — Pinecone + OpenAI integration
// Used for RAG, semantic search, and persistent AI memory
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { action, text, texts, query, namespace, top_k, model } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'embed':
                return await handleEmbed(text, model, headers);
            case 'upsert':
                return await handleUpsert(texts, namespace, headers);
            case 'query':
                return await handleQuery(query, namespace, top_k, headers);
            case 'delete':
                return await handleDelete(namespace, headers);
            case 'stats':
                return await handleStats(headers);
            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: embed, upsert, query, delete, stats' }) };
        }
    } catch (error) {
        console.error('Vector store error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ EMBEDDINGS — OpenAI ═══
async function getEmbedding(text, model) {
    const oaiKey = process.env.OPENAI_API_KEY;
    if (!oaiKey) throw new Error('OPENAI_API_KEY not configured for embeddings');
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${oaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'text-embedding-3-small', input: text })
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
    const data = await res.json();
    return { embedding: data.data?.[0]?.embedding, model: model || 'text-embedding-3-small', source: 'openai' };
}

async function handleEmbed(text, model, headers) {
    if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };
    const result = await getEmbedding(text, model);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result, dimensions: result.embedding?.length }) };
}

// ═══ PINECONE — Vector Database ═══
function getPineconeConfig() {
    const key = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST; // e.g., kelion-xxxxx.svc.xxx.pinecone.io
    if (!key || !host) return null;
    return { key, host };
}

async function handleUpsert(texts, namespace, headers) {
    if (!texts || !Array.isArray(texts)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'texts array required' }) };

    const pc = getPineconeConfig();
    if (!pc) return { statusCode: 503, headers, body: JSON.stringify({ error: 'PINECONE_API_KEY and PINECONE_HOST not configured' }) };

    // Generate embeddings for all texts
    const vectors = [];
    for (let i = 0; i < texts.length; i++) {
        const embed = await getEmbedding(texts[i].text || texts[i]);
        vectors.push({
            id: texts[i].id || `vec_${Date.now()}_${i}`,
            values: embed.embedding,
            metadata: {
                text: (texts[i].text || texts[i]).substring(0, 1000),
                ...(texts[i].metadata || {})
            }
        });
    }

    const res = await fetch(`https://${pc.host}/vectors/upsert`, {
        method: 'POST',
        headers: { 'Api-Key': pc.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors, namespace: namespace || 'default' })
    });
    if (!res.ok) throw new Error(`Pinecone upsert ${res.status}`);
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, upserted: data.upsertedCount || vectors.length }) };
}

async function handleQuery(query, namespace, top_k, headers) {
    if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query text required' }) };

    const pc = getPineconeConfig();
    if (!pc) return { statusCode: 503, headers, body: JSON.stringify({ error: 'PINECONE_API_KEY and PINECONE_HOST not configured' }) };

    const embed = await getEmbedding(query);

    const res = await fetch(`https://${pc.host}/query`, {
        method: 'POST',
        headers: { 'Api-Key': pc.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vector: embed.embedding,
            topK: top_k || 5,
            includeMetadata: true,
            namespace: namespace || 'default'
        })
    });
    if (!res.ok) throw new Error(`Pinecone query ${res.status}`);
    const data = await res.json();

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            success: true,
            matches: (data.matches || []).map(m => ({
                id: m.id,
                score: m.score,
                text: m.metadata?.text || '',
                metadata: m.metadata
            }))
        })
    };
}

async function handleDelete(namespace, headers) {
    const pc = getPineconeConfig();
    if (!pc) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Pinecone not configured' }) };

    const res = await fetch(`https://${pc.host}/vectors/delete`, {
        method: 'POST',
        headers: { 'Api-Key': pc.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true, namespace: namespace || 'default' })
    });
    if (!res.ok) throw new Error(`Pinecone delete ${res.status}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Namespace '${namespace || 'default'}' cleared` }) };
}

async function handleStats(headers) {
    const pc = getPineconeConfig();
    if (!pc) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Pinecone not configured' }) };

    const res = await fetch(`https://${pc.host}/describe_index_stats`, {
        method: 'POST',
        headers: { 'Api-Key': pc.key, 'Content-Type': 'application/json' },
        body: '{}'
    });
    if (!res.ok) throw new Error(`Pinecone stats ${res.status}`);
    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: data }) };
}
