import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP, formatDate } from '../utils/formatters';
import { ArrowUpRight, ArrowDownRight, Search, FileText, Trash2, Calendar } from 'lucide-react';
import './Transactions.css';

const MovimientosView = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        // Cargar categorías en un diccionario para acceso rápido O(1)
        const { data: catData } = await supabase.from('categories').select('*').eq('user_id', user.id);
        const catMap = {};
        if (catData) {
            catData.forEach(c => catMap[c.id] = c);
        }
        setCategories(catMap);

        // Cargar todos los movimientos
        const { data: transData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (transData) setTransactions(transData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este movimiento? Afectará tu saldo.')) {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (!error) fetchData();
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Historial de Movimientos</h1>
                <p className="subtitle">Revisa todos tus ingresos y gastos en detalle.</p>
            </header>

            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="input-with-icon" style={{ flex: '1', minWidth: '250px' }}>
                        <span className="input-icon"><Search size={18} /></span>
                        <input
                            type="text"
                            placeholder="Buscar por descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="input-with-icon" style={{ width: '200px' }}>
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="all">Todos los tipos</option>
                            <option value="expense">Solo Gastos</option>
                            <option value="income">Solo Ingresos</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
                {loading ? (
                    <div className="p-6 text-center text-muted">Cargando movimientos...</div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="p-6 text-center" style={{ padding: '3rem' }}>
                        <FileText size={48} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
                        <h3>No hay movimientos</h3>
                        <p className="text-muted">No encontramos transacciones que coincidan con tu búsqueda.</p>
                    </div>
                ) : (
                    <>
                        {/* DESKTOP: tabla */}
                        <div className="txn-table-wrap">
                            <table className="txn-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Descripción</th>
                                        <th>Categoría</th>
                                        <th style={{ textAlign: 'right' }}>Monto</th>
                                        <th style={{ textAlign: 'center' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.map(t => {
                                        const isIncome = t.type === 'income';
                                        const category = categories[t.category_id];
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ color: 'var(--text-muted)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Calendar size={14} />{formatDate(t.date)}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 500 }}>{t.description}</td>
                                                <td>
                                                    {category ? (
                                                        <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem', background: `${category.color_hex}20`, color: category.color_hex, border: `1px solid ${category.color_hex}40` }}>
                                                            {category.name}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, color: isIncome ? 'var(--accent)' : 'var(--danger)' }}>
                                                    {isIncome ? '+' : '-'}{formatCLP(t.amount)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => handleDelete(t.id)} style={{ padding: '0.5rem', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }} title="Eliminar">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* MÓVIL: tarjetas */}
                        <div className="txn-cards">
                            {filteredTransactions.map(t => {
                                const isIncome = t.type === 'income';
                                const category = categories[t.category_id];
                                return (
                                    <div key={t.id} className="txn-card">
                                        <div className="txn-card-left">
                                            <span className="txn-card-desc">{t.description}</span>
                                            <div className="txn-card-meta">
                                                <Calendar size={12} />
                                                <span>{formatDate(t.date)}</span>
                                                {category && (
                                                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', background: `${category.color_hex}20`, color: category.color_hex, border: `1px solid ${category.color_hex}40` }}>
                                                        {category.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="txn-card-right">
                                            <span className="txn-card-amount" style={{ color: isIncome ? 'var(--accent)' : 'var(--danger)' }}>
                                                {isIncome ? '+' : '-'}{formatCLP(t.amount)}
                                            </span>
                                            <button onClick={() => handleDelete(t.id)} style={{ padding: '0.4rem', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }} title="Eliminar">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MovimientosView;
