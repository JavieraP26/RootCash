import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';
import './TransactionModal.css';

const toDisplayDate = (iso) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

const toISODate = (display) => {
    const parts = display.replace(/\s/g, '').split('/');
    if (parts.length !== 3) return '';
    const [d, m, y] = parts;
    if (d.length !== 2 || m.length !== 2 || y.length !== 4) return '';
    if (isNaN(Date.parse(`${y}-${m}-${d}`))) return '';
    return `${y}-${m}-${d}`;
};

const TransactionModal = ({ isOpen, onClose, onSuccess, defaultDate }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [fixedDebts, setFixedDebts] = useState([]);
    const [dateDisplay, setDateDisplay] = useState('');

    const [formData, setFormData] = useState({
        type: 'expense',
        amount: '',
        date: '',
        description: '',
        category_id: ''
    });

    useEffect(() => {
        if (isOpen && user) {
            const fetchData = async () => {
                const [{ data: catsData }, { data: debtsData }] = await Promise.all([
                    supabase.from('categories').select('id, name').eq('user_id', user.id),
                    supabase.from('fixed_debts').select('id, description, amount, category_id').eq('user_id', user.id),
                ]);
                if (catsData) setCategories(catsData);
                if (debtsData) setFixedDebts(debtsData);
            };
            fetchData();

            const initialDate = defaultDate || new Date().toISOString().split('T')[0];
            setDateDisplay(toDisplayDate(initialDate));
            setFormData({
                type: 'expense',
                amount: '',
                date: initialDate,
                description: '',
                category_id: '',
            });
        }
    }, [isOpen, user, defaultDate]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (e) => {
        const categoryId = e.target.value;
        const matchingDebt = fixedDebts.find(d => d.category_id === categoryId);
        if (matchingDebt) {
            const formatted = new Intl.NumberFormat('es-CL').format(matchingDebt.amount);
            setFormData(prev => ({
                ...prev,
                category_id: categoryId,
                description: matchingDebt.description,
                amount: formatted,
            }));
        } else {
            setFormData(prev => ({ ...prev, category_id: categoryId }));
        }
    };

    const handleDateInput = (e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        let v = raw;
        if (raw.length > 2) v = raw.slice(0, 2) + '/' + raw.slice(2);
        if (raw.length > 4) v = raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4, 8);
        setDateDisplay(v);
        const iso = toISODate(v);
        if (iso) setFormData(prev => ({ ...prev, date: iso }));
    };

    const parseAmount = (value) => {
        const cleaned = String(value).replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        if (!formData.date) {
            alert('Ingresa una fecha válida en formato dd/mm/aaaa.');
            return;
        }

        const amount = parseAmount(formData.amount);
        if (isNaN(amount) || amount <= 0) {
            alert('Ingresa un monto válido.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.from('transactions').insert({
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

    const autoFilledFromDebt = formData.category_id
        ? fixedDebts.find(d => d.category_id === formData.category_id)
        : null;

    const inputStyle = {
        width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)', background: '#171a20',
        color: 'var(--text-main)', boxSizing: 'border-box'
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
                        <label>Categoría</label>
                        <select
                            name="category_id"
                            value={formData.category_id}
                            onChange={handleCategoryChange}
                            style={inputStyle}
                        >
                            <option value="" style={{ background: '#171a20' }}>Sin Categoría</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id} style={{ background: '#171a20' }}>{cat.name}</option>
                            ))}
                        </select>
                        {autoFilledFromDebt && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.3rem' }}>
                                ✓ Autocompletado desde gasto fijo
                            </p>
                        )}
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
                            style={inputStyle}
                        />
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
                            style={inputStyle}
                        />
                    </div>

                    <div className="form-group">
                        <label>Fecha</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="dd/mm/aaaa"
                            value={dateDisplay}
                            onChange={handleDateInput}
                            maxLength={10}
                            required
                            style={inputStyle}
                        />
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
