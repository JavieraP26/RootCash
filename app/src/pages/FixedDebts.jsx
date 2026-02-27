import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../utils/formatters';
import { Plus, Trash2, CalendarClock, Tag } from 'lucide-react';
import './FixedDebts.css';

const FixedDebts = () => {
    const { user } = useAuth();
    const [debts, setDebts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        due_day: 1,
        category_id: ''
    });

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        const { data: catData } = await supabase.from('categories').select('*').eq('user_id', user.id);
        if (catData) setCategories(catData);

        const { data: debtsData } = await supabase.from('fixed_debts').select('*').eq('user_id', user.id).order('due_day', { ascending: true });
        if (debtsData) setDebts(debtsData);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        const { error } = await supabase.from('fixed_debts').insert({
            user_id: user.id,
            description: formData.description,
            amount: parseFloat(formData.amount),
            due_day: parseInt(formData.due_day),
            category_id: formData.category_id || null
        });

        if (!error) {
            setIsFormOpen(false);
            setFormData({ description: '', amount: '', due_day: 1, category_id: '' });
            fetchData();
        } else {
            alert('Error guardando la deuda fija.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro quieres eliminar este gasto fijo mensual?')) {
            const { error } = await supabase.from('fixed_debts').delete().eq('id', id);
            if (!error) fetchData();
        }
    };

    // Función para descontar directamente del saldo como un gasto del mes
    const handlePayNow = async (debt) => {
        if (!window.confirm(`¿Quieres registrar el pago de ${debt.description} por ${formatCLP(debt.amount)} ahora?`)) return;

        const currentMonth = new Date().toISOString().split('T')[0];

        const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            amount: debt.amount,
            type: 'expense',
            date: currentMonth,
            description: `Pago: ${debt.description}`,
            category_id: debt.category_id
        });

        if (!error) {
            alert('Pago registrado como un movimiento (gasto) en el mes.');
        }
    };

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Gastos Fijos</h1>
                    <p className="subtitle">Lleva el control de lo que pagas cada mes.</p>
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }} onClick={() => setIsFormOpen(true)}>
                    <Plus size={20} />
                    <span>Nuevo Fijo</span>
                </button>
            </header>

            {isFormOpen && (
                <div className="glass-panel p-6" style={{ marginBottom: '2rem', padding: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Agregar Deuda o Gasto Fijo</h3>
                    <form onSubmit={handleSubmit} className="fixed-form">
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                                <label>Descripción</label>
                                <input
                                    type="text"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Ej. Arriendo, Internet..."
                                    required
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                                />
                            </div>
                            <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
                                <label>Monto</label>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    required
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ flex: '1', minWidth: '150px' }}>
                                <label>Día de Pago (1 - 31)</label>
                                <input
                                    type="number"
                                    name="due_day"
                                    value={formData.due_day}
                                    onChange={handleChange}
                                    min="1" max="31"
                                    required
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                                />
                            </div>
                            <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                                <label>Categoría</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                                >
                                    <option value="">Sin categoría</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setIsFormOpen(false)} style={{ color: 'var(--text-muted)' }}>Cancelar</button>
                            <button type="submit" className="btn-primary">Guardar Fijo</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p className="text-muted">Cargando...</p>
            ) : debts.length === 0 && !isFormOpen ? (
                <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                    <CalendarClock size={48} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
                    <h3>No tienes deudas fijas guardadas</h3>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Añade tus gastos recurrentes para no olvidarlos.</p>
                </div>
            ) : (
                <div className="debts-grid">
                    {debts.map(debt => {
                        const isClose = debt.due_day - new Date().getDate() >= 0 && debt.due_day - new Date().getDate() <= 3;
                        const cat = categories.find(c => c.id === debt.category_id);

                        return (
                            <div key={debt.id} className={`glass-panel debt-card ${isClose ? 'urgent' : ''}`}>
                                <div className="debt-header">
                                    <h3 style={{ fontSize: '1.2rem' }}>{debt.description}</h3>
                                    <h4 style={{ color: 'var(--danger)' }}>{formatCLP(debt.amount)}</h4>
                                </div>
                                <div className="debt-body">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isClose ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        <CalendarClock size={16} />
                                        <span style={{ fontWeight: isClose ? 600 : 400 }}>Se paga el día {debt.due_day}</span>
                                    </div>
                                    {cat && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: cat.color_hex, marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                            <Tag size={14} />
                                            <span>{cat.name}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="debt-actions mt-4" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button className="btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }} onClick={() => handlePayNow(debt)}>Pagar / Descontar</button>
                                    <button className="icon-btn delete" onClick={() => handleDelete(debt.id)}><Trash2 size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FixedDebts;
