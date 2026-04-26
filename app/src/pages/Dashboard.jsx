import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP, parseAmount, formatDate } from '../utils/formatters';
import { TrendingUp, TrendingDown, Wallet, Plus, ArrowUpRight, ArrowDownRight, Pencil, Check, X, Download, Lightbulb } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import SavingsGoal from '../components/SavingsGoal';
import './Dashboard.css';

const FinancialAdvice = ({ baseIncome, totalIncome, totalExpenses, transactions, profile }) => {
    if (totalIncome === 0 && totalExpenses === 0) return null;

    let advice = { type: 'neutral', text: 'Registra más movimientos para recibir consejos personalizados.', title: '¡Hola!' };
    const balance = totalIncome - totalExpenses;
    const progressToGoal = profile?.savings_goal_amount ? balance / profile.savings_goal_amount : 0;

    // Análisis de categorías
    const expensesByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.category_id || 'other';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + parseFloat(t.amount);
    });

    let topWarningCategory = null;
    if (totalExpenses > 0) {
        for (const [cat, amount] of Object.entries(expensesByCategory)) {
            if (amount > totalExpenses * 0.45) topWarningCategory = amount; // Más del 45% en una sola cosa
        }
    }

    if (balance < 0) {
        advice = {
            type: 'danger',
            title: 'Alerta de sobregiro',
            text: 'Estás gastando más de lo que ingresa. Toma un respiro y revisa si puedes pausar alguna compra no esencial este mes. ¡Puedes recuperar el control!'
        };
    } else if (totalExpenses > totalIncome * 0.85) {
        advice = {
            type: 'warning',
            title: 'Cuidado con el límite',
            text: 'Estás muy cerca de gastar todo tu saldo. Intenta cuidar los gastos hormiga los próximos días para cerrar el mes tranquilo/a.'
        };
    } else if (topWarningCategory) {
        advice = {
            type: 'warning',
            title: 'Gasto concentrado',
            text: 'Notamos que casi la mitad de tus gastos se van en una sola categoría. Revisa tus presupuestos para asegurar que esté dentro de lo planeado.'
        };
    } else if (profile?.savings_goal_amount && progressToGoal >= 1) {
        advice = {
            type: 'success',
            title: '¡Meta lograda!',
            text: '¡Increíble! Ya superaste tu meta de ahorro para este periodo. Considerando el saldo a favor, es un excelente momento para mover ese dinero a una cuenta de ahorro o inversión.'
        };
    } else if (balance > totalIncome * 0.4) {
        advice = {
            type: 'success',
            title: 'Excelente margen',
            text: 'Llevas un control fantástico este mes. Tienes un buen margen a favor, ideal para destinar una parte a tu fondo de emergencia.'
        };
    } else {
        advice = {
            type: 'neutral',
            title: 'Vas por buen camino',
            text: 'Tus finanzas se ven estables este mes. Sigue registrando todo para mantener la claridad.'
        };
    }

    const getColors = (type) => {
        switch (type) {
            case 'danger': return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', icon: 'var(--danger)' };
            case 'warning': return { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', icon: '#f59e0b' };
            case 'success': return { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', icon: 'var(--accent)' };
            default: return { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.3)', icon: 'var(--primary)' };
        }
    };
    const colors = getColors(advice.type);

    return (
        <div style={{
            marginTop: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-md)',
            background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', gap: '1rem', alignItems: 'flex-start'
        }}>
            <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '50%', color: colors.icon }}>
                <Lightbulb size={20} />
            </div>
            <div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>{advice.title}</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {advice.text}
                </p>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [streak, setStreak] = useState(0); // Racha de meses en positivo
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estado para editar el sueldo
    const [editingIncome, setEditingIncome] = useState(false);
    const [incomeInput, setIncomeInput] = useState('');
    const [savingIncome, setSavingIncome] = useState(false);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileData) setProfile(profileData);

            const date = new Date();
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();

            const { data: transData } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (transData) {
                // Separar transacciones del mes actual para el dashboard
                const currentMonthTrans = transData.filter(t => t.date >= firstDay.split('T')[0] && t.date <= lastDay.split('T')[0]);
                setTransactions(currentMonthTrans);

                // Calcular Racha (Streak) de meses en positivo hacia atrás
                let currentStreak = 0;
                let checkDate = new Date(date.getFullYear(), date.getMonth() - 1, 1); // Empezar evaluando el mes anterior

                // Mapear transacciones por mes para evaluación rápida
                const monthlyStats = {};
                transData.forEach(t => {
                    const d = new Date(t.date + 'T00:00:00');
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    if (!monthlyStats[key]) monthlyStats[key] = { in: 0, out: 0, hasData: false };
                    monthlyStats[key].hasData = true;
                    if (t.type === 'income') monthlyStats[key].in += parseFloat(t.amount);
                    else monthlyStats[key].out += parseFloat(t.amount);
                });

                // Contar hacia atrás mientras el mes tenga datos y saldo positivo (Ingresos + Sueldo > Gastos)
                const baseInc = profileData?.monthly_income || 0;
                while (true) {
                    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
                    if (!monthlyStats[key] || !monthlyStats[key].hasData) break; // Si no hay datos ese mes, se corta la racha

                    const totalIn = baseInc + monthlyStats[key].in;
                    if (totalIn >= monthlyStats[key].out) {
                        currentStreak++;
                        checkDate.setMonth(checkDate.getMonth() - 1);
                    } else {
                        break; // Mes negativo, se corta la racha
                    }
                }
                setStreak(currentStreak);
            }
        } catch (error) {
            if (import.meta.env.DEV) console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleEditIncome = () => {
        setIncomeInput(profile?.monthly_income || '');
        setEditingIncome(true);
    };

    const handleSaveIncome = async () => {
        const amount = parseAmount(incomeInput);
        if (isNaN(amount) || amount < 0) {
            alert('Ingresa un sueldo válido.');
            return;
        }
        setSavingIncome(true);
        const { error } = await supabase
            .from('profiles')
            .update({ monthly_income: amount })
            .eq('id', user.id);

        if (!error) {
            setProfile(prev => ({ ...prev, monthly_income: amount }));
            setEditingIncome(false);
        } else {
            alert('Error guardando el sueldo.');
        }
        setSavingIncome(false);
    };

    const baseIncome = profile?.monthly_income || 0;
    const extraIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalIncome = baseIncome + extraIncome;
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const currentBalance = totalIncome - totalExpenses;

    if (loading && !profile) return (
        <div className="dashboard-container fade-in">
            <p className="text-muted p-4">Cargando tu resumen...</p>
        </div>
    );

    return (
        <div className="dashboard-container fade-in">
            <header className="dashboard-header">
                <div>
                    <h1 className="greeting" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        Hola, {profile?.display_name || user?.email?.split('@')[0]} 👋
                        {streak > 0 && (
                            <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                                <span style={{ fontSize: '1.2rem' }}>🔥</span> {streak} {streak === 1 ? 'mes invicto' : 'meses invictos'}
                            </span>
                        )}
                    </h1>
                    <p className="subtitle">Aquí está tu resumen de este mes.</p>
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    <span>Nuevo</span>
                </button>
            </header>

            <div className="stats-grid">
                {/* Tarjeta Sueldo / Ingresos — con editor inline */}
                <div className="stat-card glass-panel">
                    <div className="stat-icon income"><TrendingUp size={24} /></div>
                    <div className="stat-details" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p className="stat-label">Sueldo Base</p>
                            {!editingIncome && (
                                <button
                                    onClick={handleEditIncome}
                                    title="Editar sueldo"
                                    style={{ background: 'none', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '4px', display: 'flex' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'white'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                        </div>

                        {editingIncome ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={incomeInput}
                                    onChange={e => setIncomeInput(e.target.value)}
                                    placeholder="Ej: 1.200.000"
                                    autoFocus
                                    style={{
                                        flex: 1, padding: '0.4rem 0.6rem',
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid var(--primary)',
                                        borderRadius: '6px', color: 'white', fontSize: '1rem'
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveIncome(); if (e.key === 'Escape') setEditingIncome(false); }}
                                />
                                <button onClick={handleSaveIncome} disabled={savingIncome} style={{ color: 'var(--accent)', background: 'none', display: 'flex' }}>
                                    <Check size={18} />
                                </button>
                                <button onClick={() => setEditingIncome(false)} style={{ color: 'var(--danger)', background: 'none', display: 'flex' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <h3 className="stat-value">
                                {baseIncome > 0 ? formatCLP(baseIncome) : <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin sueldo — edita ✏️</span>}
                            </h3>
                        )}

                        {extraIncome > 0 && !editingIncome && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>+{formatCLP(extraIncome)} ingreso extra</span>
                        )}
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-icon expense"><TrendingDown size={24} /></div>
                    <div className="stat-details">
                        <p className="stat-label">Gastos del Mes</p>
                        <h3 className="stat-value">{formatCLP(totalExpenses)}</h3>
                    </div>
                </div>

                <div className="stat-card glass-panel highlight">
                    <div className="stat-icon balance"><Wallet size={24} /></div>
                    <div className="stat-details">
                        <p className="stat-label">Saldo Disponible</p>
                        <h3 className="stat-value" style={{ color: currentBalance >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {formatCLP(currentBalance)}
                        </h3>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                <SavingsGoal
                    monthlyIncome={totalIncome}
                    monthlyExpenses={totalExpenses}
                    profile={profile}
                    onProfileUpdate={(updates) => setProfile(prev => ({ ...prev, ...updates }))}
                />

                <FinancialAdvice
                    baseIncome={baseIncome}
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    transactions={transactions}
                    profile={profile}
                />
            </div>

            <div className="recent-activity-section">
                <div className="glass-panel p-6" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem' }}>Movimientos Recientes</h2>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p className="text-muted">Aún no has registrado transacciones este mes.</p>
                        </div>
                    ) : (
                        <div className="transactions-list">
                            {transactions.slice(0, 5).map((t) => (
                                <div key={t.id} className="transaction-item" style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '1rem', borderBottom: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            padding: '0.5rem', borderRadius: '0.5rem',
                                            background: t.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: t.type === 'income' ? 'var(--accent)' : 'var(--danger)'
                                        }}>
                                            {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 500 }}>{t.description}</p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDate(t.date)}</p>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 600, color: t.type === 'income' ? 'var(--accent)' : 'var(--danger)' }}>
                                        {t.type === 'income' ? '+' : '-'}{formatCLP(t.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default Dashboard;
