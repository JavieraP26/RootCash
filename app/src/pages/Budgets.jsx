import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../utils/formatters';
import { PieChart, Save } from 'lucide-react';
import './Budgets.css';

const Budgets = () => {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [budgets, setBudgets] = useState({});
    const [expenses, setExpenses] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthStr = currentMonth.split('-')[1];
    const yearStr = currentMonth.split('-')[0];

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        // 1. Obtener categorías
        const { data: catData } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name');

        // 2. Obtener presupuestos del mes actual
        const { data: budgetData } = await supabase
            .from('budgets')
            .select('*')
            .eq('user_id', user.id)
            .eq('month', monthStr)
            .eq('year', yearStr);

        // 3. Obtener gastos del mes actual por categoría
        const firstDay = new Date(yearStr, parseInt(monthStr) - 1, 1).toISOString();
        const lastDay = new Date(yearStr, parseInt(monthStr), 0).toISOString();
        const { data: transData } = await supabase
            .from('transactions')
            .select('category_id, amount')
            .eq('user_id', user.id)
            .eq('type', 'expense')
            .gte('date', firstDay.split('T')[0])
            .lte('date', lastDay.split('T')[0]);

        // Procesar datos
        if (catData) setCategories(catData);

        const budgetMap = {};
        if (budgetData) {
            budgetData.forEach(b => budgetMap[b.category_id] = { id: b.id, amount: b.amount_limit });
        }
        setBudgets(budgetMap);

        const expMap = {};
        if (transData) {
            transData.forEach(t => {
                if (t.category_id) {
                    expMap[t.category_id] = (expMap[t.category_id] || 0) + parseFloat(t.amount);
                }
            });
        }
        setExpenses(expMap);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleBudgetChange = (categoryId, amount) => {
        setBudgets(prev => ({
            ...prev,
            [categoryId]: { ...prev[categoryId], amount: amount }
        }));
    };

    const handleSaveBudgets = async () => {
        if (!user) return;
        setSaving(true);

        // Preparar array de upserts
        for (const cat of categories) {
            const b = budgets[cat.id];
            if (b && b.amount > 0) {
                if (b.id) {
                    await supabase.from('budgets').update({ amount_limit: b.amount }).eq('id', b.id);
                } else {
                    await supabase.from('budgets').insert({
                        user_id: user.id,
                        category_id: cat.id,
                        amount_limit: b.amount,
                        month: monthStr,
                        year: yearStr
                    });
                }
            } else if (b && b.id && (!b.amount || b.amount <= 0)) {
                // Si lo puso en 0, lo eliminamos
                await supabase.from('budgets').delete().eq('id', b.id);
            }
        }

        await fetchData(); // Recargar para obtener los nuevos IDs si se insertaron
        setSaving(false);
        alert('Presupuestos guardados exitosamente');
    };

    const getProgressPercentage = (spent, limit) => {
        if (!limit || limit <= 0) return 0;
        const p = (spent / limit) * 100;
        return p > 100 ? 100 : p;
    };

    const getProgressColor = (percentage) => {
        if (percentage < 50) return 'var(--accent)';
        if (percentage < 85) return '#f59e0b'; // warning
        return 'var(--danger)';
    };

    return (
        <div className="view-content fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 600 }}>Tus Presupuestos</h1>
                    <p className="subtitle">Asigna límites a tus categorías para este mes.</p>
                </div>
                <button
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
                    onClick={handleSaveBudgets}
                    disabled={saving}
                >
                    <Save size={20} />
                    <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
            </header>

            {loading ? (
                <p className="text-muted">Cargando datos...</p>
            ) : categories.length === 0 ? (
                <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                    <PieChart size={48} style={{ color: 'var(--border)', margin: '0 auto 1rem' }} />
                    <h3>No tienes categorías</h3>
                    <p className="text-muted">Crea primero algunas categorías en su respectiva sección.</p>
                </div>
            ) : (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div className="budget-table-header">
                        <div>Categoría</div>
                        <div>Límite Mensual ($)</div>
                        <div>Progreso (Gastado)</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
                        {categories.map((cat) => {
                            const limit = budgets[cat.id]?.amount || '';
                            const spent = expenses[cat.id] || 0;
                            const percentage = getProgressPercentage(spent, limit || 0);
                            const pColor = getProgressColor(percentage);

                            return (
                                <div key={cat.id} className="budget-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color_hex }}></div>
                                        <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                    </div>

                                    <div className="budget-limit-col">
                                        <input
                                            type="number"
                                            value={limit}
                                            onChange={(e) => handleBudgetChange(cat.id, e.target.value)}
                                            placeholder="Sin límite"
                                            style={{
                                                width: '100%', maxWidth: '180px', padding: '0.5rem 0.75rem',
                                                borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)',
                                                border: '1px solid var(--border)', color: 'white'
                                            }}
                                            min="0"
                                        />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                            <span style={{ color: pColor }}>{formatCLP(spent)} gastado</span>
                                            {limit > 0 && <span className="text-muted">{limit > spent ? `${formatCLP(limit - spent)} libres` : 'Sobregirado'}</span>}
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${percentage}%`, height: '100%',
                                                background: pColor, borderRadius: '4px',
                                                transition: 'width 0.3s ease, background 0.3s ease'
                                            }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Budgets;
