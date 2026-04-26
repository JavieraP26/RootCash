// Desconecta una cuenta Gmail eliminando su registro de connected_accounts.
// Verifica que el ID pertenezca al usuario antes de borrar (doble seguridad además de RLS).
export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;
    const authHeader = req.headers.authorization;

    if (!id || !authHeader) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const userToken = authHeader.replace('Bearer ', '');

    try {
        // Verificar identidad del usuario
        const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${userToken}`,
            },
        });

        if (!userRes.ok) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id: userId } = await userRes.json();

        // Eliminar filtrando por id Y user_id: aunque alguien conozca el UUID del registro,
        // no puede borrar cuentas que no le pertenecen
        const deleteRes = await fetch(
            `${supabaseUrl}/rest/v1/connected_accounts?id=eq.${id}&user_id=eq.${userId}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                },
            }
        );

        if (!deleteRes.ok) {
            return res.status(500).json({ error: 'Failed to disconnect' });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Disconnect error:', err.message);
        return res.status(500).json({ error: 'Server error' });
    }
}
