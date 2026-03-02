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

const Stats = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [pieData, setPieData] = useState([]);
    const [barData, setBarData] = useState([]);
    const [topCategory, setTopCategory] = useState(null);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [totalIncome, setTotalIncome] = useState(0);

    useEffect(() => {
        if (user) fetchStats();
    }, [user]);

    const fetchStats = async () => {
        setLoading(true);

        // Categorías para etiquetas
        const { data: cats } = await supabase.from('categories').select('*').eq('user_id', user.id);
        const catMap = {};
        if (cats) cats.forEach(c => catMap[c.id] = c);

        // Transacciones de los últimos 6 meses
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const { data: txns } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', sixMonthsAgo.toISOString().split('T')[0])
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

        // --- BAR: ingresos vs gastos por mes (últimos 6) ---
        const monthBuckets = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthBuckets[key] = { name: MONTH_NAMES[d.getMonth()], ingresos: 0, gastos: 0 };
        }

        txns.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthBuckets[key]) return;
            if (t.type === 'income') monthBuckets[key].ingresos += parseFloat(t.amount);
            else monthBuckets[key].gastos += parseFloat(t.amount);
        });

        setBarData(Object.values(monthBuckets));
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

                    {/* Gráficos */}
                    <div className="stats-charts-grid">
                        {/* PIE */}
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

                        {/* BAR */}
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
