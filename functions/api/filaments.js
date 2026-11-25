// ==============================================================================
// Cloudflare Pages Function: /api/filaments
// GET  - Pobiera listę wszystkich filamentów z bazy Cloudflare D1
// POST - Dodaje nowy filament do bazy
// ==============================================================================

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

export async function onRequestGet(context) {
    const { env } = context;

    if (!env.DB) {
        return jsonResponse({
            error: 'Brak powiązania bazy D1 o zmiennej DB w ustawieniach Cloudflare Pages (Settings -> Functions -> D1 database bindings).'
        }, 500);
    }

    try {
        const { results } = await env.DB.prepare(
            'SELECT * FROM filaments ORDER BY created_at DESC'
        ).all();

        return jsonResponse(results || []);
    } catch (err) {
        return jsonResponse({ error: 'Błąd bazy D1: ' + err.message }, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.DB) {
        return jsonResponse({
            error: 'Brak powiązania bazy D1 o zmiennej DB w ustawieniach Cloudflare Pages.'
        }, 500);
    }

    try {
        const body = await request.json();

        if (!body.manufacturer || !body.material || !body.color_name) {
            return jsonResponse({ error: 'Pola producent, materiał i kolor są wymagane.' }, 400);
        }

        const id = body.id || crypto.randomUUID();
        const createdAt = body.created_at || new Date().toISOString();

        await env.DB.prepare(`
            INSERT INTO filaments (
                id, created_at, manufacturer, material, version, color_name, color_hex,
                location, weight_total, weight_current, weight_spool, temp_nozzle,
                temp_bed, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            createdAt,
            String(body.manufacturer).trim(),
            String(body.material).trim(),
            body.version ? String(body.version).trim() : null,
            String(body.color_name).trim(),
            body.color_hex || '#3b82f6',
            String(body.location || 'Domyślna').trim(),
            parseInt(body.weight_total) || 1000,
            body.weight_current !== undefined ? parseInt(body.weight_current) : 1000,
            parseInt(body.weight_spool) || 220,
            body.temp_nozzle ? String(body.temp_nozzle).trim() : null,
            body.temp_bed ? String(body.temp_bed).trim() : null,
            body.status || 'W użyciu',
            body.notes ? String(body.notes).trim() : null
        ).run();

        const createdItem = {
            id,
            created_at: createdAt,
            manufacturer: body.manufacturer,
            material: body.material,
            version: body.version || null,
            color_name: body.color_name,
            color_hex: body.color_hex || '#3b82f6',
            location: body.location || 'Domyślna',
            weight_total: parseInt(body.weight_total) || 1000,
            weight_current: body.weight_current !== undefined ? parseInt(body.weight_current) : 1000,
            weight_spool: parseInt(body.weight_spool) || 220,
            temp_nozzle: body.temp_nozzle || null,
            temp_bed: body.temp_bed || null,
            status: body.status || 'W użyciu',
            notes: body.notes || null
        };

        return jsonResponse(createdItem, 201);
    } catch (err) {
        return jsonResponse({ error: 'Błąd zapisu szpuli: ' + err.message }, 500);
    }
}
