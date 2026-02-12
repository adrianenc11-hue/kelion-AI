// ═══ INVENTORY TRACKER — Gestiune stocuri cu Supabase ═══
// Produse, cantități, alerte, mișcări stoc — persistate în DB

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = JSON.parse(event.body || '{}');
        const supabase = getSupabase();

        switch (body.action) {
            case 'add_product':
                return respond(200, await addProduct(supabase, body));
            case 'update_stock':
                return respond(200, await updateStock(supabase, body));
            case 'check_stock':
                return respond(200, await checkStock(supabase, body));
            case 'low_stock_alert':
                return respond(200, await lowStockAlert(supabase, body));
            case 'stock_report':
                return respond(200, await stockReport(supabase, body));
            case 'movement_log':
                return respond(200, await movementLog(supabase, body));
            case 'valuation':
                return respond(200, await stockValuation(supabase, body));
            default:
                return respond(400, { error: 'Actions: add_product, update_stock, check_stock, low_stock_alert, stock_report, movement_log, valuation' });
        }
    } catch (err) {
        console.error('Inventory error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

async function addProduct(supabase, { name, sku, category, quantity = 0, unit = 'buc', price, min_stock = 5, location, supplier }) {
    const id = `PRD-${Date.now().toString(36).toUpperCase()}`;
    const product = {
        id, sku: sku || id,
        name: name || '[Produs]',
        category: category || 'General',
        quantity, unit,
        price: price || 0,
        min_stock,
        location: location || 'Depozit principal',
        supplier: supplier || '',
        status: quantity > min_stock ? '✅ În stoc' : quantity > 0 ? '⚠️ Stoc scăzut' : '❌ Lipsă',
        created_at: new Date().toISOString()
    };

    if (supabase) {
        const { error } = await supabase.from('inventory').insert(product);
        if (error) {
            console.error('Product insert error:', error.message);
            product.storage = error.code === '42P01' ? '⚠️ Table "inventory" not found — run migration' : `⚠️ ${error.message}`;
        } else {
            product.storage = '🟢 Saved to Supabase';
        }
    } else {
        product.storage = '⚠️ Supabase not configured';
    }

    return { product, message: `✅ Produs adăugat: ${product.name} (${quantity} ${unit})` };
}

async function updateStock(supabase, { product_id, product_name, quantity_change, reason, type = 'intrare' }) {
    const movement = {
        id: `MOV-${Date.now().toString(36).toUpperCase()}`,
        product_id: product_id || 'unknown',
        product_name: product_name || '[Produs]',
        type,
        quantity_change: quantity_change || 0,
        reason: reason || (type === 'intrare' ? 'Aprovizionare' : 'Vânzare'),
        created_at: new Date().toISOString(),
        message: `${type === 'intrare' ? '📦 +' : '📤 -'}${Math.abs(quantity_change)} ${product_name || product_id}`
    };

    if (supabase) {
        // Log the movement
        await supabase.from('inventory_movements').insert(movement).then(({ error }) => {
            if (error) console.error('Movement log error:', error.message);
        });

        // Update the product quantity
        if (product_id && product_id !== 'unknown') {
            const adjust = type === 'intrare' ? quantity_change : -Math.abs(quantity_change);
            const { data: prod } = await supabase.from('inventory').select('quantity').eq('id', product_id).single();
            if (prod) {
                await supabase.from('inventory').update({ quantity: prod.quantity + adjust }).eq('id', product_id);
            }
        }
    }

    return movement;
}

async function checkStock(supabase) {
    if (!supabase) return { note: '⚠️ Supabase not configured — send products array manually' };

    const { data: products, error } = await supabase.from('inventory').select('*').order('name');
    if (error) return { error: error.message };
    if (!products || !products.length) return { total_products: 0, note: 'No products in inventory' };

    return {
        total_products: products.length,
        in_stock: products.filter(p => p.quantity > (p.min_stock || 5)).length,
        low_stock: products.filter(p => p.quantity > 0 && p.quantity <= (p.min_stock || 5)).length,
        out_of_stock: products.filter(p => p.quantity <= 0).length,
        products: products.map(p => ({
            id: p.id, name: p.name, quantity: p.quantity,
            min_stock: p.min_stock || 5,
            status: p.quantity > (p.min_stock || 5) ? '✅ OK' : p.quantity > 0 ? '⚠️ Scăzut' : '❌ Lipsă',
            needs_order: Math.max(0, (p.min_stock || 5) * 2 - p.quantity)
        })),
        source: '🟢 Supabase (live)'
    };
}

async function lowStockAlert(supabase, { threshold_multiplier = 1 }) {
    if (!supabase) return { alerts: [], note: '⚠️ Supabase not configured' };

    const { data: products } = await supabase.from('inventory').select('*');
    if (!products) return { alerts: [] };

    const alerts = products
        .filter(p => p.quantity <= (p.min_stock || 5) * threshold_multiplier)
        .map(p => ({
            name: p.name, current: p.quantity, minimum: p.min_stock || 5,
            deficit: Math.max(0, (p.min_stock || 5) - p.quantity),
            urgency: p.quantity <= 0 ? '🔴 URGENT' : p.quantity <= (p.min_stock || 5) / 2 ? '🟡 ATENȚIE' : '🟢 Monitorizare',
            recommended_order: (p.min_stock || 5) * 2 - p.quantity
        }));

    return {
        total_alerts: alerts.length, alerts,
        summary: alerts.length ? `⚠️ ${alerts.length} produse sub stocul minim!` : '✅ Toate produsele au stoc suficient.'
    };
}

async function stockReport(supabase, { period = 'current' }) {
    if (!supabase) return { note: '⚠️ Supabase not configured' };

    const { data: products } = await supabase.from('inventory').select('*');
    if (!products) return { total_products: 0 };

    const totalValue = products.reduce((sum, p) => sum + (p.quantity || 0) * (p.price || 0), 0);
    const categories = {};
    products.forEach(p => {
        const cat = p.category || 'General';
        if (!categories[cat]) categories[cat] = { count: 0, value: 0, items: 0 };
        categories[cat].count += p.quantity || 0;
        categories[cat].value += (p.quantity || 0) * (p.price || 0);
        categories[cat].items++;
    });

    return {
        title: `📊 Raport Stoc — ${period}`,
        total_products: products.length,
        total_items: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
        total_value: Math.round(totalValue * 100) / 100,
        currency: 'RON',
        categories,
        health: {
            in_stock: products.filter(p => p.quantity > (p.min_stock || 5)).length,
            low_stock: products.filter(p => p.quantity > 0 && p.quantity <= (p.min_stock || 5)).length,
            out_of_stock: products.filter(p => p.quantity <= 0).length
        },
        source: '🟢 Supabase (live)'
    };
}

async function movementLog(supabase, { limit = 50 }) {
    if (!supabase) return { movements: [], note: '⚠️ Supabase not configured' };

    const { data: movements } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    const rows = movements || [];
    return {
        total_movements: rows.length,
        intrari: rows.filter(m => m.type === 'intrare').length,
        iesiri: rows.filter(m => m.type === 'iesire').length,
        ajustari: rows.filter(m => m.type === 'ajustare').length,
        movements: rows,
        source: '🟢 Supabase (live)'
    };
}

async function stockValuation(supabase, { method = 'fifo' }) {
    if (!supabase) return { note: '⚠️ Supabase not configured' };

    const { data: products } = await supabase.from('inventory').select('name, quantity, price');
    if (!products) return { total_products: 0, total_value: 0 };

    const totalValue = products.reduce((sum, p) => sum + (p.quantity || 0) * (p.price || 0), 0);
    return {
        method: method.toUpperCase(),
        total_products: products.length,
        total_value: Math.round(totalValue * 100) / 100,
        currency: 'RON',
        products: products.map(p => ({
            name: p.name,
            quantity: p.quantity || 0,
            unit_price: p.price || 0,
            total_value: Math.round((p.quantity || 0) * (p.price || 0) * 100) / 100
        })).sort((a, b) => b.total_value - a.total_value),
        source: '🟢 Supabase (live)'
    };
}
