import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Calendar, DollarSign, FileText, Tag } from 'lucide-react';
import './TransactionModal.css';

const TransactionModal = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        type: 'expense',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        category_id: ''
    });

    React.useEffect(() => {
        if (isOpen && user) {
            const fetchCategories = async () => {
                const { data } = await supabase.from('categories').select('id, name').eq('user_id', user.id);
                if (data) setCategories(data);
            };
            fetchCategories();
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Normaliza montos en formato chileno: "44.000" → 44000, "44000" → 44000
    const parseAmount = (value) => {
        const cleaned = String(value).replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;
        const amount = parseAmount(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            alert('Ingresa un monto válido.');
            setLoading(false);
            return;
        }

        const { error } = await supabase
            .from('transactions')
            .insert({
                user_id: user.id,
                amount: amount,
                type: formData.type,
                date: formData.date,
                description: formData.description,
                category_id: formData.category_id || null
            });

        setLoading(false);

        if (error) {
            if (import.meta.env.DEV) console.error("Error guardando transacción:", error);
            alert("Error al guardar movimiento");
        } else {
            onSuccess();
            onClose();
        }
    };

    const modalContent = (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content glass-panel fade-in">
                <div className="modal-header">
                    <h2>Nuevo Movimiento</h2>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="transaction-form">
                    <div className="form-group type-selector">
                        <button
                            type="button"
                            className={`type-btn expense ${formData.type === 'expense' ? 'active' : ''}`}
                            onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
                        >
                            Gasto
                        </button>
                        <button
                            type="button"
                            className={`type-btn income ${formData.type === 'income' ? 'active' : ''}`}
                            onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
                        >
                            Ingreso Extra
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Monto</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            placeholder="Ej: 44.000"
                            required
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Descripción</label>
                        <input
                            type="text"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Ej. Compra supermercado"
                            required
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Fecha</label>
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Categoría</label>
                        <select
                            name="category_id"
                            value={formData.category_id}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                        >
                            <option value="" style={{ background: '#171a20' }}>Sin Categoría</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} style={{ background: '#171a20' }}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Movimiento'}
                    </button>
                </form>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default TransactionModal;
