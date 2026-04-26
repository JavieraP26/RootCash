// Callback OAuth de Google. Recibe el código temporal, lo intercambia por tokens,
// verifica el state token de un solo uso, y guarda el refresh_token en Supabase.
export default async function handler(req, res) {
    const appUrl = 'https://root-cash.vercel.app';
    const { code, state, error } = req.query;

    // Si el usuario canceló o hubo error en el lado de Google
    if (error || !code || !state) {
        return res.redirect(`${appUrl}/configuracion?error=access_denied`);
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    try {
        // 1. Verificar y consumir el state token de un solo uso
        // Buscar el token en oauth_states y verificar que no haya expirado
        const stateRes = await fetch(
            `${supabaseUrl}/rest/v1/oauth_states?token=eq.${encodeURIComponent(state)}&select=user_id,expires_at`,
            {
                headers: {
                    apikey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                },
            }
        );

        const stateData = await stateRes.json();

        if (!stateData.length) {
            return res.redirect(`${appUrl}/configuracion?error=auth_failed`);
        }

        const { user_id: userId, expires_at: expiresAt } = stateData[0];

        // Verificar que el token no haya expirado (ventana de 10 minutos)
        if (new Date(expiresAt) < new Date()) {
            return res.redirect(`${appUrl}/configuracion?error=auth_failed`);
        }

        // Eliminar el token inmediatamente (es de un solo uso)
        await fetch(
            `${supabaseUrl}/rest/v1/oauth_states?token=eq.${encodeURIComponent(state)}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                },
            }
        );

        // 2. Intercambiar el código temporal por access_token y refresh_token
        // El código solo es válido una vez y expira en minutos
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: googleClientId,
                client_secret: googleClientSecret,
                redirect_uri: `${appUrl}/api/gmail/callback`,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenRes.json();

        // Sin refresh_token no podemos leer correos en el futuro.
        // prompt=consent en connect.js fuerza que Google siempre entregue uno nuevo.
        if (!tokens.refresh_token) {
            return res.redirect(`${appUrl}/configuracion?error=no_refresh_token`);
        }

        // 3. Obtener el email de la cuenta Gmail que el usuario autorizó
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await profileRes.json();

        // 4. Guardar tokens en Supabase (upsert: actualiza si ya existía esa cuenta)
        const expiresIn = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/connected_accounts`, {
            method: 'POST',
            headers: {
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates', // Upsert por (user_id, email)
            },
            body: JSON.stringify({
                user_id: userId,
                email: profile.email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                token_expires_at: expiresIn,
            }),
        });

        if (!insertRes.ok) {
            console.error('Supabase insert error:', await insertRes.text());
            return res.redirect(`${appUrl}/configuracion?error=server_error`);
        }

        return res.redirect(`${appUrl}/configuracion?connected=true`);
    } catch (err) {
        console.error('Gmail callback error:', err.message);
        return res.redirect(`${appUrl}/configuracion?error=server_error`);
    }
}
