import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Briefcase } from 'lucide-react';
import './Profile.css';

const AVATARS = [
    '🐱', '🐶', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁',
    '🐸', '🐺', '🦋', '🐙', '🦄', '🐧', '🦉', '🐬',
    '🐻‍❄️', '🦝', '🦔', '🐲',
];

const GENDER_OPTIONS = [
    { value: 'mujer', label: 'Mujer' },
    { value: 'hombre', label: 'Hombre' },
    { value: 'prefiero_no_decirlo', label: 'Prefiero no decirlo' },
    { value: 'otro', label: 'Otro' },
];

const formatJobDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
};

const Profile = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [form, setForm] = useState({
        display_name: '',
        avatar: '🐱',
        age: '',
        gender: '',
        job_title: '',
        job_start_date: '',
        job_end_date: '',
        job_is_current: true,
    });

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) {
                setForm({
                    display_name: data.display_name || '',
                    avatar: data.avatar || '🐱',
                    age: data.age || '',
                    gender: data.gender || '',
                    job_title: data.job_title || '',
                    job_start_date: data.job_start_date || '',
                    job_end_date: data.job_end_date || '',
                    job_is_current: !data.job_end_date,
                });
            }
            setLoading(false);
        };
        fetchProfile();
    }, [user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('profiles').update({
            display_name: form.display_name || null,
            avatar: form.avatar,
            age: form.age ? parseInt(form.age) : null,
            gender: form.gender || null,
            job_title: form.job_title || null,
            job_start_date: form.job_start_date || null,
            job_end_date: form.job_is_current ? null : (form.job_end_date || null),
        }).eq('id', user.id);

        setSaving(false);
        if (!error) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } else {
            alert('Error guardando perfil.');
        }
    };

    if (loading) return <div className="view-content fade-in"><p className="text-muted">Cargando perfil...</p></div>;

    const displayName = form.display_name || user?.email?.split('@')[0];

    return (
        <div className="view-content fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Mi Perfil</h1>
                <p className="subtitle">Personaliza cómo te ves en RootCash.</p>
            </header>

            <div className="profile-layout">

                {/* Columna izquierda: preview de perfil */}
                <div className="profile-card glass-panel">
                    <div className="avatar-display">{form.avatar}</div>
                    <h2 className="profile-name">{displayName}</h2>
                    <p className="profile-email">{user?.email}</p>

                    {form.gender && (
                        <span className="profile-badge">
                            {GENDER_OPTIONS.find(g => g.value === form.gender)?.label}
                        </span>
                    )}
                    {form.age && (
                        <span className="profile-badge">{form.age} años</span>
                    )}

                    {form.job_title && (
                        <div className="profile-job">
                            <Briefcase size={14} />
                            <span>{form.job_title}</span>
                        </div>
                    )}
                    {form.job_start_date && (
                        <p className="profile-dates">
                            {formatJobDate(form.job_start_date)} — {form.job_is_current ? 'Actualidad' : formatJobDate(form.job_end_date)}
                        </p>
                    )}
                </div>

                {/* Columna derecha: formulario */}
                <div className="profile-form-col">

                    {/* Avatar picker */}
                    <div className="glass-panel form-section">
                        <h3 className="section-title">Elige tu Avatar</h3>
                        <div className="avatar-grid">
                            {AVATARS.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className={`avatar-btn ${form.avatar === emoji ? 'selected' : ''}`}
                                    onClick={() => setForm(prev => ({ ...prev, avatar: emoji }))}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Datos personales */}
                    <div className="glass-panel form-section">
                        <h3 className="section-title">Datos Personales</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Nombre para mostrar</label>
                                <input
                                    type="text"
                                    name="display_name"
                                    value={form.display_name}
                                    onChange={handleChange}
                                    placeholder={user?.email?.split('@')[0]}
                                />
                            </div>
                            <div className="form-group">
                                <label>Edad</label>
                                <input
                                    type="number"
                                    name="age"
                                    value={form.age}
                                    onChange={handleChange}
                                    placeholder="Ej: 27"
                                    min="1" max="120"
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label>Género</label>
                            <div className="gender-options">
                                {GENDER_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`gender-btn ${form.gender === opt.value ? 'selected' : ''}`}
                                        onClick={() => setForm(prev => ({ ...prev, gender: prev.gender === opt.value ? '' : opt.value }))}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Trabajo */}
                    <div className="glass-panel form-section">
                        <h3 className="section-title">Trabajo</h3>
                        <div className="form-group">
                            <label>Cargo / Empresa</label>
                            <input
                                type="text"
                                name="job_title"
                                value={form.job_title}
                                onChange={handleChange}
                                placeholder="Ej: Desarrollador en Empresa X"
                            />
                        </div>

                        <div className="form-grid" style={{ marginTop: '1rem' }}>
                            <div className="form-group">
                                <label>Fecha de inicio</label>
                                <input type="date" name="job_start_date" value={form.job_start_date} onChange={handleChange} />
                            </div>

                            {!form.job_is_current && (
                                <div className="form-group">
                                    <label>Fecha de término</label>
                                    <input type="date" name="job_end_date" value={form.job_end_date} onChange={handleChange} />
                                </div>
                            )}
                        </div>

                        <label className="checkbox-label" style={{ marginTop: '1rem' }}>
                            <input
                                type="checkbox"
                                name="job_is_current"
                                checked={form.job_is_current}
                                onChange={handleChange}
                            />
                            <span>Trabajo aquí actualmente</span>
                        </label>
                    </div>

                    <button
                        className="btn-primary"
                        style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <Save size={18} />
                        {saving ? 'Guardando...' : saved ? '¡Guardado! ✅' : 'Guardar Perfil'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
