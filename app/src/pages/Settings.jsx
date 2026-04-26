import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mail, Plus, Trash2, CheckCircle, AlertCircle, Loader, Building2, X } from 'lucide-react';
import './Settings.css';

// Mensajes de error del callback OAuth
const ERROR_MESSAGES = {
    access_denied: 'Cancelaste la conexión.',
    no_refresh_token: 'No se obtuvo acceso permanente. Vuelve a intentarlo y asegúrate de aceptar todos los permisos.',
    auth_failed: 'Error de autenticación. Vuelve a intentarlo.',
    server_error: 'Error del servidor. Intenta más tarde.',
};

const Settings = () => {
    const { user } = useAuth();

    // --- Estado: cuentas Gmail conectadas ---
    const [accounts, setAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [connecting, setConnecting] = useState(false);

    // --- Estado: remitentes configurados ---
    const [sources, setSources] = useState([]);
    const [loadingSources, setLoadingSources] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSource, setNewSource] = useState({ display_name: '', sender_email: '' });
    const [savingSource, setSavingSource] = useState(false);

    // --- Mensaje global de feedback ---
    const [message, setMessage] = useState(null); // { type: 'success'|'error', text: '' }

    // Leer resultado del callback OAuth desde la URL al volver de Google
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('connected') === 'true') {
            setMessage({ type: 'success', text: 'Cuenta conectada correctamente.' });
            window.history.replaceState({}, '', '/configuracion');
            fetchAccounts();
        } else if (params.get('error')) {
            setMessage({
                type: 'error',
                text: ERROR_MESSAGES[params.get('error')] || 'Error desconocido.',
            });
            window.history.replaceState({}, '', '/configuracion');
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        fetchAccounts();
        fetchSources();
    }, [user]);

    // --- Cuentas Gmail conectadas ---

    const fetchAccounts = async () => {
        if (!user) return;
        setLoadingAccounts(true);
        const { data } = await supabase
            .from('connected_accounts')
            .select('id, email, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
        setAccounts(data || []);
        setLoadingAccounts(false);
    };

    const connectGmail = async () => {
        setConnecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/gmail/connect', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const { url, error } = await res.json();
            if (error || !url) throw new Error(error);
            window.location.href = url;
        } catch {
            setMessage({ type: 'error', text: 'No se pudo iniciar la conexión. Intenta de nuevo.' });
            setConnecting(false);
        }
    };

    const disconnect = async (accountId, email) => {
        if (!window.confirm(`¿Desconectar ${email}? RootCash dejará de leer correos de esta cuenta.`)) return;
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/gmail/disconnect?id=${accountId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
            setAccounts(prev => prev.filter(a => a.id !== accountId));
            setMessage({ type: 'success', text: `${email} desconectado.` });
        } else {
            setMessage({ type: 'error', text: 'No se pudo desconectar. Intenta de nuevo.' });
        }
    };

    // --- Remitentes monitoreados ---

    const fetchSources = async () => {
        if (!user) return;
        setLoadingSources(true);
        const { data } = await supabase
            .from('email_sources')
            .select('id, display_name, sender_email, is_active, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
        setSources(data || []);
        setLoadingSources(false);
    };

    const addSource = async () => {
        const name = newSource.display_name.trim();
        const email = newSource.sender_email.trim().toLowerCase();

        // Validación básica de formato email
        if (!name || !email || !email.includes('@') || !email.includes('.')) {
            setMessage({ type: 'error', text: 'Ingresa un nombre y un email válido.' });
            return;
        }

        setSavingSource(true);
        const { error } = await supabase.from('email_sources').insert({
            user_id: user.id,
            display_name: name,
            sender_email: email,
        });
        setSavingSource(false);

        if (error) {
            // El error más común es UNIQUE constraint: remitente ya existe
            setMessage({ type: 'error', text: 'Ese remitente ya existe o hubo un error al guardar.' });
            return;
        }

        setNewSource({ display_name: '', sender_email: '' });
        setShowAddForm(false);
        setMessage({ type: 'success', text: `Remitente "${name}" agregado.` });
        fetchSources();
    };

    const toggleSource = async (id, currentActive) => {
        // Activar o desactivar un remitente sin eliminarlo
        const { error } = await supabase
            .from('email_sources')
            .update({ is_active: !currentActive })
            .eq('id', id)
            .eq('user_id', user.id);

        if (!error) {
            setSources(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s));
        }
    };

    const deleteSource = async (id, displayName) => {
        if (!window.confirm(`¿Eliminar "${displayName}"? Dejará de monitorearse ese remitente.`)) return;
        const { error } = await supabase
            .from('email_sources')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (!error) {
            setSources(prev => prev.filter(s => s.id !== id));
            setMessage({ type: 'success', text: `"${displayName}" eliminado.` });
        } else {
            setMessage({ type: 'error', text: 'No se pudo eliminar. Intenta de nuevo.' });
        }
    };

    return (
        <div className="view-content fade-in">
            <div className="settings-header">
                <h1>Configuración</h1>
                <p className="settings-subtitle">Administra tus conexiones y preferencias</p>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.type === 'success'
                        ? <CheckCircle size={18} />
                        : <AlertCircle size={18} />
                    }
                    <span>{message.text}</span>
                    <button className="message-close" onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            {/* ── Sección 1: Cuentas Gmail conectadas ── */}
            <div className="glass-panel settings-section">
                <div className="settings-section-header">
                    <div className="settings-section-icon">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h2>Correos conectados</h2>
                        <p>Cuentas de Gmail que RootCash tiene permiso de leer. Puedes conectar varias cuentas.</p>
                    </div>
                </div>

                {loadingAccounts ? (
                    <div className="settings-loading"><Loader size={20} className="spin" /></div>
                ) : (
                    <div className="accounts-list">
                        {accounts.length === 0 && (
                            <p className="settings-empty">No hay cuentas conectadas. Agrega una para empezar.</p>
                        )}
                        {accounts.map(account => (
                            <div key={account.id} className="account-item">
                                <div className="account-icon"><Mail size={16} /></div>
                                <div className="account-info">
                                    <span className="account-email">{account.email}</span>
                                    <span className="account-date">
                                        Conectada el {new Date(account.created_at).toLocaleDateString('es-CL', {
                                            day: 'numeric', month: 'long', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <button
                                    className="account-disconnect"
                                    onClick={() => disconnect(account.id, account.email)}
                                    title="Desconectar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button className="btn-connect-gmail" onClick={connectGmail} disabled={connecting}>
                            {connecting ? <Loader size={18} className="spin" /> : <Plus size={18} />}
                            Conectar cuenta de Gmail
                        </button>
                    </div>
                )}
            </div>

            {/* ── Sección 2: Remitentes monitoreados ── */}
            <div className="glass-panel settings-section">
                <div className="settings-section-header">
                    <div className="settings-section-icon">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h2>Remitentes monitoreados</h2>
                        <p>Agrega el email exacto desde el que tu banco o servicio envía comprobantes. RootCash solo leerá correos de estos remitentes.</p>
                    </div>
                </div>

                {loadingSources ? (
                    <div className="settings-loading"><Loader size={20} className="spin" /></div>
                ) : (
                    <div className="accounts-list">
                        {sources.length === 0 && !showAddForm && (
                            <p className="settings-empty">No hay remitentes configurados. Agrega el correo de tu banco o servicio de pago.</p>
                        )}

                        {sources.map(source => (
                            <div key={source.id} className={`source-item ${!source.is_active ? 'inactive' : ''}`}>
                                <div className="source-info">
                                    <span className="source-name">{source.display_name}</span>
                                    <span className="source-email">{source.sender_email}</span>
                                </div>
                                <div className="source-actions">
                                    {/* Toggle activo/inactivo */}
                                    <button
                                        className={`source-toggle ${source.is_active ? 'active' : ''}`}
                                        onClick={() => toggleSource(source.id, source.is_active)}
                                        title={source.is_active ? 'Desactivar' : 'Activar'}
                                    >
                                        <span className="toggle-knob" />
                                    </button>
                                    <button
                                        className="account-disconnect"
                                        onClick={() => deleteSource(source.id, source.display_name)}
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Formulario inline para agregar un remitente */}
                        {showAddForm && (
                            <div className="source-add-form">
                                <input
                                    type="text"
                                    className="source-input"
                                    placeholder="Nombre (ej: Banco Estado)"
                                    value={newSource.display_name}
                                    onChange={e => setNewSource(prev => ({ ...prev, display_name: e.target.value }))}
                                    maxLength={60}
                                />
                                <input
                                    type="email"
                                    className="source-input"
                                    placeholder="Email (ej: noreply@correo.bancoestado.cl)"
                                    value={newSource.sender_email}
                                    onChange={e => setNewSource(prev => ({ ...prev, sender_email: e.target.value }))}
                                    maxLength={120}
                                />
                                <div className="source-form-actions">
                                    <button className="btn-save-source" onClick={addSource} disabled={savingSource}>
                                        {savingSource ? <Loader size={15} className="spin" /> : <CheckCircle size={15} />}
                                        Guardar
                                    </button>
                                    <button className="btn-cancel-source" onClick={() => {
                                        setShowAddForm(false);
                                        setNewSource({ display_name: '', sender_email: '' });
                                    }}>
                                        <X size={15} />
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {!showAddForm && (
                            <button className="btn-connect-gmail" onClick={() => setShowAddForm(true)}>
                                <Plus size={18} />
                                Añadir remitente
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
