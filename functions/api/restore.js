// ==============================================================================
// Cloudflare Pages Function: /api/restore
// POST - Awaryjne przywracanie bazy danych z kopii zapasowej JSON
// Obsługuje tryb 'replace' (zastąpienie) oraz 'merge' (scalenie)
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

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.DB) {
        return jsonResponse({ error: 'Brak powiązania bazy D1 (DB).' }, 500);
    }

    try {
        const body = await request.json();
        const mode = body.mode || 'replace';
        const items = body.filaments || [];

        if (!Array.isArray(items) || items.length === 0) {
            return jsonResponse({ error: 'Brak szpul do przywrócenia w przesłanych danych.' }, 400);
        }

        const statements = [];

        // Jeśli tryb to zastąpienie, najpierw czyścimy tabelę
        if (mode === 'replace') {
            statements.push(env.DB.prepare('DELETE FROM filaments'));
        }

        for (const item of items) {
            const id = item.id || crypto.randomUUID();
            const createdAt = item.created_at || new Date().toISOString();

            statements.push(
                env.DB.prepare(`
                    INSERT INTO filaments (
                        id, created_at, manufacturer, material, version, color_name, color_hex,
                        location, weight_total, weight_current, weight_spool, temp_nozzle,
                        temp_bed, status, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    id,
                    createdAt,
                    String(item.manufacturer || 'Nieznany').trim(),
                    String(item.material || 'PLA').trim(),
                    item.version ? String(item.version).trim() : null,
                    String(item.color_name || 'Brak nazwy').trim(),
                    item.color_hex || '#3b82f6',
                    String(item.location || 'Domyślna').trim(),
                    parseInt(item.weight_total) || 1000,
                    item.weight_current !== undefined ? parseInt(item.weight_current) : 1000,
                    parseInt(item.weight_spool) || 220,
                    item.temp_nozzle ? String(item.temp_nozzle).trim() : null,
                    item.temp_bed ? String(item.temp_bed).trim() : null,
                    item.status || 'W użyciu',
                    item.notes ? String(item.notes).trim() : null
                )
            );
        }

        // Wykonaj partiami po max 100 instrukcji (optymalizacja dla Cloudflare D1 batch)
        const batchSize = 100;
        for (let i = 0; i < statements.length; i += batchSize) {
            const chunk = statements.slice(i, i + batchSize);
            await env.DB.batch(chunk);
        }

        return jsonResponse({
            success: true,
            count: items.length,
            mode
        });
    } catch (err) {
        return jsonResponse({ error: 'Błąd przywracania w bazie D1: ' + err.message }, 500);
    }
}
