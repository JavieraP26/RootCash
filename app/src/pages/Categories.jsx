import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Tag, Trash2, Edit2, X } from 'lucide-react';
import './Categories.css';

const EMOJI_OPTIONS = [
    { label: 'Comida', emojis: ['🍔', '🍕', '🍣', '🥗', '☕', '🍷', '🥩', '🍜', '🥐', '🍱', '🍰', '🧃'] },
    { label: 'Transporte', emojis: ['🚗', '🚌', '🚇', '🛵', '⛽', '✈️', '🚕', '🚲'] },
    { label: 'Compras', emojis: ['🛒', '🛍️', '👗', '👟', '💄', '👜', '🧴', '👒'] },
    { label: 'Salud', emojis: ['🏥', '💊', '🏃', '🧘', '🦷', '👓', '🩺'] },
    { label: 'Entret.', emojis: ['🎮', '🎬', '🎵', '🎭', '🎨', '📺', '⚽', '🎲'] },
    { label: 'Hogar', emojis: ['🏠', '💡', '🔧', '🛋️', '🧹', '💧', '🌿', '🔑'] },
    { label: 'Tecnología', emojis: ['📱', '💻', '🖥️', '🎧', '📷', '🖨️'] },
    { label: 'Educación', emojis: ['📚', '🎓', '🖊️', '🔬', '📐'] },
    { label: 'Mascotas', emojis: ['🐶', '🐱', '🐠', '🐇', '🐾'] },
    { label: 'Varios', emojis: ['💰', '💸', '🏦', '💳', '🌸', '🎁', '⭐', '🔖'] },
];

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
    '#d946ef', '#ec4899', '#f43f5e', '#64748b'
];

const Categories = () => {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // States para el formulario
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, name: '', color_hex: PRESET_COLORS[0], icon: '' });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCategories = async () => {
        if (!user) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (!error && data) {
            setCategories(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        if (formData.id) {
            // Editar
            const { error } = await supabase
                .from('categories')
                .update({ name: formData.name, color_hex: formData.color_hex, icon: formData.icon || null })
                .eq('id', formData.id);

            if (!error) {
                setIsFormOpen(false);
                fetchCategories();
            }
        } else {
            // Crear nueva
            const { error } = await supabase
                .from('categories')
                .insert({
                    user_id: user.id,
                    name: formData.name,
                    color_hex: formData.color_hex,
                    icon: formData.icon || null
                });

            if (!error) {
                setIsFormOpen(false);
                fetchCategories();
            }
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta categoría? Los movimientos asociados quedarán sin categoría.')) {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (!error) fetchCategories();
        }
    };

    const openNewForm = () => {
        setFormData({ id: null, name: '', color_hex: PRESET_COLORS[0], icon: '' });
        setIsFormOpen(true);
    };

    const openEditForm = (category) => {
        setFormData({ id: category.id, name: category.name, color_hex: category.color_hex, icon: category.icon || '' });
        setIsFormOpen(true);
    };

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Tus Categorías</h1>
                    <p className="subtitle">Personaliza cómo agrupas tus gastos e ingresos.</p>
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openNewForm}>
                    <Plus size={20} />
                    <span>Nueva Categoría</span>
                </button>
            </header>

            {isFormOpen && (
                <div className="glass-panel p-6" style={{ marginBottom: '2rem', padding: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                    <h3 style={{ marginBottom: '1rem' }}>{formData.id ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                    <form onSubmit={handleSubmit} className="category-form">
                        <div className="form-row" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ width: '80px', position: 'relative' }} ref={emojiPickerRef}>
                                <label>Emoji</label>
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(v => !v)}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)',
                                        background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                                        color: 'white', textAlign: 'center', fontSize: '1.4rem', cursor: 'pointer',
                                        minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    {formData.icon || <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ emoji</span>}
                                </button>

                                {showEmojiPicker && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                                        zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
                                        borderRadius: 'var(--radius-md)', padding: '0.75rem', width: '280px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: '320px', overflowY: 'auto'
                                    }}>
                                        {formData.icon && (
                                            <button
                                                type="button"
                                                onClick={() => { setFormData(f => ({ ...f, icon: '' })); setShowEmojiPicker(false); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', marginBottom: '0.5rem', cursor: 'pointer' }}
                                            >
                                                <X size={12} /> Quitar emoji
                                            </button>
                                        )}
                                        {EMOJI_OPTIONS.map(group => (
                                            <div key={group.label} style={{ marginBottom: '0.5rem' }}>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {group.label}
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                    {group.emojis.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            onClick={() => { setFormData(f => ({ ...f, icon: emoji })); setShowEmojiPicker(false); }}
                                                            style={{
                                                                fontSize: '1.3rem', padding: '4px 6px', borderRadius: '6px',
                                                                background: formData.icon === emoji ? 'rgba(255,255,255,0.15)' : 'none',
                                                                cursor: 'pointer', border: 'none',
                                                                transition: 'background 0.15s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = formData.icon === emoji ? 'rgba(255,255,255,0.15)' : 'none'}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                                <label>Nombre de la Categoría</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Supermercado, Transporte..."
                                    required
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Color</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`color-btn ${formData.color_hex === color ? 'selected' : ''}`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setFormData({ ...formData, color_hex: color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setIsFormOpen(false)} style={{ color: 'var(--text-muted)', background: 'none' }}>Cancelar</button>
                            <button type="submit" className="btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p className="text-muted">Cargando categorías...</p>
            ) : categories.length === 0 && !isFormOpen ? (
                <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                    <Tag size={48} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
                    <h3>No tienes categorías</h3>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Crea tu primera categoría para empezar a organizar.</p>
                    <button className="btn-primary" onClick={openNewForm}>Crear Categoría</button>
                </div>
            ) : (
                <div className="categories-grid">
                    {categories.map((cat) => (
                        <div key={cat.id} className="glass-panel category-card">
                            <div className="cat-color-badge" style={{ backgroundColor: cat.color_hex }}>
                                {cat.icon && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.2rem' }}>{cat.icon}</span>}
                            </div>
                            <div className="cat-info">
                                <h3>{cat.name}</h3>
                            </div>
                            <div className="cat-actions">
                                <button className="icon-btn edit" onClick={() => openEditForm(cat)}><Edit2 size={18} /></button>
                                <button className="icon-btn delete" onClick={() => handleDelete(cat.id)}><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Categories;
