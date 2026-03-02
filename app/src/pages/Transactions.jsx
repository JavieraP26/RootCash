import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP, formatDate } from '../utils/formatters';
import { ArrowUpRight, ArrowDownRight, Search, FileText, Trash2, Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import './Transactions.css';

const MovimientosView = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

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

    const exportToCSV = () => {
        if (filteredTransactions.length === 0) return;

        const headers = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto'];
        const csvRows = [headers.join(',')];

        filteredTransactions.forEach(t => {
            const cat = categories[t.category_id]?.name || 'Sin categoría';
            const typeLabel = t.type === 'income' ? 'Ingreso' : 'Gasto';
            // Escapar descripciones que tengan comas
            const desc = `"${t.description.replace(/"/g, '""')}"`;
            csvRows.push(`${t.date},${desc},${cat},${typeLabel},${t.amount}`);
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `RootCash_${MONTH_NAMES[currentMonth]}_${currentYear}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTransactions = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        const matchesMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesMonth && matchesSearch && matchesType;
    });

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Historial de Movimientos</h1>
                    <p className="subtitle">Revisa todos tus ingresos y gastos en detalle.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: 'var(--radius-md)' }}>
                        <button onClick={prevMonth} style={{ padding: '0.4rem', borderRadius: '4px', background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                        <span style={{ fontWeight: 600, minWidth: '130px', textAlign: 'center' }}>{MONTH_NAMES[currentMonth]} {currentYear}</span>
                        <button onClick={nextMonth} style={{ padding: '0.4rem', borderRadius: '4px', background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                    </div>
                    <button
                        onClick={exportToCSV}
                        title="Exportar mes a Excel (CSV)"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <Download size={20} />
                    </button>
                </div>
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
                                                            {category.icon ? `${category.icon} ${category.name}` : category.name}
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
                                                        {category.icon ? `${category.icon} ${category.name}` : category.name}
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
