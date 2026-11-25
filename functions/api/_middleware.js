// ==============================================================================
// CLOUDFLARE PAGES MIDDLEWARE: Zabezpieczenie strony (HTTP Basic Auth)
// Działa dla całej strony (index.html, pliki statyczne oraz API /api/...)
// Nie wymaga podawania karty kredytowej ani żadnych zewnętrznych usług.
// ==============================================================================

export async function onRequest(context) {
    const { request, env, next } = context;

    // Domyślny login i hasło:
    // Możesz je zmienić poniżej LUB ustawić w panelu Cloudflare Pages (Settings -> Variables and secrets)
    const expectedUser = env.AUTH_USER || 'Marcin';
    const expectedPass = env.AUTH_PASS || 'Amiga13Filament!!';

    const authHeader = request.headers.get('Authorization');

    // Jeśli brak nagłówka autoryzacji - wyświetl w przeglądarce okienko logowania
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return new Response('Dostęp zablokowany. Wymagane zalogowanie do Filament Trackera.', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Filament Tracker", charset="UTF-8"',
                'Content-Type': 'text/plain; charset=utf-8'
            }
        });
    }

    try {
        const base64Credentials = authHeader.split(' ')[1];
        const decoded = atob(base64Credentials);
        const separatorIndex = decoded.indexOf(':');

        if (separatorIndex === -1) {
            throw new Error('Błędny format danych');
        }

        const user = decoded.substring(0, separatorIndex);
        const pass = decoded.substring(separatorIndex + 1);

        // Sprawdzenie poprawności loginu i hasła
        if (user === expectedUser && pass === expectedPass) {
            // Logowanie poprawne -> przepuść użytkownika do aplikacji
            return next();
        }
    } catch (e) {
        // Błąd dekodowania
    }

    // Jeśli login lub hasło są błędne - wyświetl okienko ponownie
    return new Response('Błędny login lub hasło.', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Filament Tracker", charset="UTF-8"',
            'Content-Type': 'text/plain; charset=utf-8'
        }
    });
}
