// ==============================================================================
// Cloudflare Pages Function: /api/filaments/:id
// PUT    - Aktualizuje dane istniejącego filamentu (pełna lub częściowa edycja wagi/statusu)
// DELETE - Usuwa filament o podanym id z bazy D1
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

export async function onRequestPut(context) {
    const { params, request, env } = context;
    const id = params.id;

    if (!env.DB) {
        return jsonResponse({ error: 'Brak powiązania bazy D1 (DB).' }, 500);
    }

    try {
        const body = await request.json();

        // Jeśli to szybka aktualizacja wagi i statusu (quickUpdateWeight)
        if (body.weight_current !== undefined && Object.keys(body).length <= 3) {
            await env.DB.prepare(`
                UPDATE filaments SET
                    weight_current = ?,
                    status = coalesce(?, status)
                WHERE id = ?
            `).bind(
                parseInt(body.weight_current),
                body.status || null,
                id
            ).run();

            return jsonResponse({ success: true, id });
        }

        // Pełna aktualizacja formularza
        await env.DB.prepare(`
            UPDATE filaments SET
                manufacturer = ?,
                material = ?,
                version = ?,
                color_name = ?,
                color_hex = ?,
                location = ?,
                weight_total = ?,
                weight_current = ?,
                weight_spool = ?,
                temp_nozzle = ?,
                temp_bed = ?,
                status = ?,
                notes = ?
            WHERE id = ?
        `).bind(
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
            body.notes ? String(body.notes).trim() : null,
            id
        ).run();

        return jsonResponse({ success: true, id });
    } catch (err) {
        return jsonResponse({ error: 'Błąd aktualizacji: ' + err.message }, 500);
    }
}

export async function onRequestDelete(context) {
    const { params, env } = context;
    const id = params.id;

    if (!env.DB) {
        return jsonResponse({ error: 'Brak powiązania bazy D1 (DB).' }, 500);
    }

    try {
        await env.DB.prepare('DELETE FROM filaments WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, id });
    } catch (err) {
        return jsonResponse({ error: 'Błąd usuwania: ' + err.message }, 500);
    }
}
