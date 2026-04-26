// Genera la URL de OAuth de Google para conectar una cuenta Gmail.
// En vez de pasar el JWT del usuario como state (queda en historial del navegador),
// generamos un token aleatorio de un solo uso y lo guardamos en Supabase.
// El callback lo intercambia por el user_id real y lo elimina inmediatamente.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const userToken = authHeader.replace('Bearer ', '');

    // 1. Verificar que la sesión sea válida y obtener el user_id
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${userToken}`,
        },
    });

    if (!userRes.ok) {
        return res.status(401).json({ error: 'Invalid session' });
    }

    const { id: userId } = await userRes.json();

    // 2. Generar un token aleatorio de un solo uso para el state de OAuth.
    // Esto evita que el JWT del usuario aparezca en URLs, historial o logs de Google.
    const stateToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // Expira en 10 minutos

    // 3. Guardar el token en Supabase asociado al user_id
    const saveRes = await fetch(`${supabaseUrl}/rest/v1/oauth_states`, {
        method: 'POST',
        headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            token: stateToken,
            user_id: userId,
            expires_at: expiresAt,
        }),
    });

    if (!saveRes.ok) {
        return res.status(500).json({ error: 'Could not generate state token' });
    }

    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: 'https://root-cash.vercel.app/api/gmail/callback',
        response_type: 'code',
        // gmail.readonly: solo lectura, nunca puede modificar ni eliminar correos
        scope: 'https://www.googleapis.com/auth/gmail.readonly email',
        access_type: 'offline', // Necesario para obtener refresh_token de larga duración
        prompt: 'select_account consent', // Fuerza selector de cuenta aunque ya esté logueado en Google
        state: stateToken, // Token aleatorio de un solo uso, no el JWT
    });

    return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}
