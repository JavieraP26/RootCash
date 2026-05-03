import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../utils/formatters';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import './Stats.css';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FULL_MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const COMPARE_OPTIONS = [2, 3, 4, 6, 12];

const getGridCols = (n) => {
    if (n <= 4) return n;
    if (n === 6) return 3;
    return 4;
};

const Stats = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [pieData, setPieData] = useState([]);
    const [barData, setBarData] = useState([]);
    const [compareData, setCompareData] = useState([]);
    const [compareMonths, setCompareMonths] = useState(4);
    const [selectedCompareMonth, setSelectedCompareMonth] = useState(null);
    const [topCategory, setTopCategory] = useState(null);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalIncome, setTotalIncome] = useState(0);

    useEffect(() => {
        if (user) fetchStats(compareMonths);
    }, [user, compareMonths]);

    const fetchStats = async (numMonths = 4) => {
        setLoading(true);

        const { data: cats } = await supabase.from('categories').select('*').eq('user_id', user.id);
        const catMap = {};
        if (cats) cats.forEach(c => catMap[c.id] = c);

        const now = new Date();
        const totalMonthsToFetch = Math.max(6, numMonths);
        const startDate = new Date(now.getFullYear(), now.getMonth() - (totalMonthsToFetch - 1), 1);

        const { data: txns } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (!txns) { setLoading(false); return; }

        // --- PIE: gastos del mes actual por categoría ---
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlyExpenses = txns.filter(t => {
            const d = new Date(t.date + 'T00:00:00');
            return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const expByCat = {};
        monthlyExpenses.forEach(t => {
            const key = t.category_id || '__sin_categoria__';
            expByCat[key] = (expByCat[key] || 0) + parseFloat(t.amount);
        });

        const pie = Object.entries(expByCat).map(([id, value]) => {
            const cat = catMap[id];
            const name = id === '__sin_categoria__' ? 'Sin categoría' : (cat?.icon ? `${cat.icon} ${cat.name}` : cat?.name || 'Otra');
            return {
                name,
                value,
                color: id === '__sin_categoria__' ? '#64748b' : (cat?.color_hex || '#6366f1'),
                originalName: cat?.name || name
            };
        }).sort((a, b) => b.value - a.value);

        setPieData(pie);
        setTopCategory(pie[0] || null);
        setTotalExpenses(monthlyExpenses.reduce((s, t) => s + parseFloat(t.amount), 0));

        const monthlyIncome = txns.filter(t => {
            const d = new Date(t.date + 'T00:00:00');
            return t.type === 'income' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        setTotalIncome(monthlyIncome.reduce((s, t) => s + parseFloat(t.amount), 0));

        // --- Construir todos los buckets necesarios ---
        const allBuckets = {};
        for (let i = totalMonthsToFetch - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            allBuckets[key] = {
                name: MONTH_NAMES[d.getMonth()],
                fullName: FULL_MONTH_NAMES[d.getMonth()],
                year: d.getFullYear(),
                month: d.getMonth(),
                ingresos: 0,
                gastos: 0
            };
        }

        txns.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!allBuckets[key]) return;
            if (t.type === 'income') allBuckets[key].ingresos += parseFloat(t.amount);
            else allBuckets[key].gastos += parseFloat(t.amount);
        });

        const allKeys = Object.keys(allBuckets);

        // BAR: siempre últimos 6 meses
        setBarData(allKeys.slice(-6).map(k => allBuckets[k]));

        // COMPARE: últimos numMonths
        const compareKeys = allKeys.slice(-numMonths);
        const compare = compareKeys.map((key, i) => {
            const bucket = allBuckets[key];
            const monthTxns = txns.filter(t => {
                const d = new Date(t.date + 'T00:00:00');
                return t.type === 'expense' && d.getMonth() === bucket.month && d.getFullYear() === bucket.year;
            });

            const catTotals = {};
            monthTxns.forEach(t => {
                const catId = t.category_id || '__sin_categoria__';
                catTotals[catId] = (catTotals[catId] || 0) + parseFloat(t.amount);
            });

            const total = bucket.gastos;
            const categories = Object.entries(catTotals)
                .map(([id, amount]) => {
                    const cat = catMap[id];
                    return {
                        name: id === '__sin_categoria__' ? 'Sin categoría' : (cat?.name || 'Otra'),
                        icon: cat?.icon || '',
                        color: id === '__sin_categoria__' ? '#64748b' : (cat?.color_hex || '#6366f1'),
                        amount,
                        pct: total > 0 ? Math.round((amount / total) * 100) : 0
                    };
                })
                .sort((a, b) => b.amount - a.amount);

            return { key, ...bucket, total, categories };
        });

        setCompareData(compare);
        setSelectedCompareMonth(compare.length - 1);
        setLoading(false);
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: '#1c1f26', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                    {payload.map((p, i) => (
                        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
                            {p.name}: {formatCLP(p.value)}
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const PieTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const p = payload[0];
            return (
                <div style={{ background: '#1c1f26', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                    <div style={{ color: p.payload.color, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: '#f8fafc' }}>{formatCLP(p.value)}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {totalExpenses > 0 ? ((p.value / totalExpenses) * 100).toFixed(1) : 0}% del total
                    </div>
                </div>
            );
        }
        return null;
    };

    const maxMonthTotal = compareData.length > 0 ? Math.max(...compareData.map(m => m.total)) : 1;

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Estadísticas</h1>
                <p className="subtitle">Visualiza tus finanzas de un vistazo.</p>
            </header>

            {loading ? (
                <p className="text-muted">Cargando datos...</p>
            ) : (
                <>
                    {/* Resumen rápido */}
                    <div className="stats-summary-grid">
                        <div className="glass-panel stats-card">
                            <span className="stats-card-label">Gastos del mes</span>
                            <span className="stats-card-value danger">{formatCLP(totalExpenses)}</span>
                        </div>
                        <div className="glass-panel stats-card">
                            <span className="stats-card-label">Ingresos extra del mes</span>
                            <span className="stats-card-value accent">{formatCLP(totalIncome)}</span>
                        </div>
                        {topCategory && (
                            <div className="glass-panel stats-card">
                                <span className="stats-card-label">Mayor gasto</span>
                                <span className="stats-card-value" style={{ color: topCategory.color }}>{topCategory.originalName}</span>
                                <span className="stats-card-sub">{formatCLP(topCategory.value)}</span>
                            </div>
                        )}
                    </div>

                    {/* ── Comparativa mensual estilo iPhone Screen Time ── */}
                    {compareData.length > 0 && (
                        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <div className="compare-header">
                                <h3 className="chart-title" style={{ marginBottom: 0 }}>
                                    Comparativa — últimos {compareMonths} meses
                                </h3>
                                <div className="compare-month-selector">
                                    {COMPARE_OPTIONS.map(n => (
                                        <button
                                            key={n}
                                            className={`compare-selector-btn ${compareMonths === n ? 'active' : ''}`}
                                            onClick={() => setCompareMonths(n)}
                                        >
                                            {n}m
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div
                                className="compare-months-grid"
                                style={{ gridTemplateColumns: `repeat(${getGridCols(compareMonths)}, 1fr)` }}
                            >
                                {compareData.map((m, i) => {
                                    const prev = i > 0 ? compareData[i - 1] : null;
                                    const delta = prev && prev.total > 0
                                        ? Math.round(((m.total - prev.total) / prev.total) * 100)
                                        : null;
                                    const barPct = maxMonthTotal > 0 ? Math.round((m.total / maxMonthTotal) * 100) : 0;
                                    const isSelected = selectedCompareMonth === i;
                                    const isCurrent = i === compareData.length - 1;

                                    return (
                                        <button
                                            key={m.key}
                                            className={`compare-month-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setSelectedCompareMonth(isSelected ? null : i)}
                                        >
                                            <p className="compare-month-name">
                                                {m.fullName}
                                                {isCurrent && <span className="compare-current-badge"> actual</span>}
                                            </p>
                                            <p className="compare-month-amount">{m.total > 0 ? formatCLP(m.total) : '—'}</p>
                                            <div className="compare-bar-track">
                                                <div
                                                    className="compare-bar-fill"
                                                    style={{
                                                        width: `${barPct}%`,
                                                        background: isSelected ? 'var(--primary)' : 'var(--danger)',
                                                    }}
                                                />
                                            </div>
                                            {delta !== null && m.total > 0 && (
                                                <p className="compare-delta" style={{ color: delta > 0 ? 'var(--danger)' : 'var(--accent)' }}>
                                                    {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}% vs anterior
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Desglose expandido del mes seleccionado */}
                            {selectedCompareMonth !== null && compareData[selectedCompareMonth] && (
                                <div className="compare-breakdown">
                                    <p className="compare-breakdown-title">
                                        Desglose — {compareData[selectedCompareMonth].fullName} {compareData[selectedCompareMonth].year}
                                    </p>
                                    {compareData[selectedCompareMonth].categories.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin gastos registrados este mes.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                            {compareData[selectedCompareMonth].categories.map((cat, i) => (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', fontSize: '0.85rem' }}>
                                                        <span style={{ color: 'var(--text-main)' }}>
                                                            {cat.icon && <span style={{ marginRight: '0.3rem' }}>{cat.icon}</span>}
                                                            {cat.name}
                                                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>{cat.pct}%</span>
                                                        </span>
                                                        <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCLP(cat.amount)}</span>
                                                    </div>
                                                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                                                        <div style={{
                                                            height: '100%', width: `${cat.pct}%`,
                                                            background: cat.color, borderRadius: '2px',
                                                            transition: 'width 0.35s ease'
                                                        }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Gráficos existentes */}
                    <div className="stats-charts-grid">
                        <div className="glass-panel stats-chart-panel">
                            <h3 className="chart-title">Gastos por categoría — {MONTH_NAMES[new Date().getMonth()]}</h3>
                            {pieData.length === 0 ? (
                                <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>Sin gastos este mes aún.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<PieTooltip />} />
                                        <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{v}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        <div className="glass-panel stats-chart-panel">
                            <h3 className="chart-title">Ingresos vs Gastos — últimos 6 meses</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'capitalize' }}>{v}</span>} />
                                    <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Stats;
