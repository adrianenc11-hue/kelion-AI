// Agent Tasks - Manage background AI tasks
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        if (event.httpMethod === 'GET') {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, tasks: [], active: 0, completed: 0 }) };
        }
        if (event.httpMethod === 'POST') {
            const { task, priority } = JSON.parse(event.body || '{}');
            if (!task) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Task description required' }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, task_id: `task_${Date.now()}`, status: 'queued', priority: priority || 'normal' }) };
        }
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (error) {
        console.error('Agent tasks error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
