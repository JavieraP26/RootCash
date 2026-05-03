import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP, parseAmount, formatDate } from '../utils/formatters';
import { TrendingUp, TrendingDown, Wallet, Plus, ArrowUpRight, ArrowDownRight, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import SavingsGoal from '../components/SavingsGoal';
import './Dashboard.css';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const Dashboard = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [allTransactions, setAllTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const [editingIncome, setEditingIncome] = useState(false);
    const [incomeInput, setIncomeInput] = useState('');
    const [savingIncome, setSavingIncome] = useState(false);

    // Transacciones del mes seleccionado (derivado, no estado)
    const transactions = allTransactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

    const defaultDate = isCurrentMonth
        ? now.toISOString().split('T')[0]
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;

    const goToPrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(y => y - 1);
        } else {
            setSelectedMonth(m => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (isCurrentMonth) return;
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear(y => y + 1);
        } else {
            setSelectedMonth(m => m + 1);
        }
    };

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [{ data: profileData }, { data: transData }, { data: catsData }] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
                supabase.from('categories').select('id, name, color_hex, icon').eq('user_id', user.id),
            ]);

            if (profileData) setProfile(profileData);
            if (catsData) setCategories(catsData);

            if (transData) {
                setAllTransactions(transData);

                // Calcular racha de meses en positivo hacia atrás
                let currentStreak = 0;
                let checkDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

                const monthlyStats = {};
                transData.forEach(t => {
                    const d = new Date(t.date + 'T00:00:00');
                    const key = `${d.getFullYear()}-${d.getMonth()}`;
                    if (!monthlyStats[key]) monthlyStats[key] = { in: 0, out: 0, hasData: false };
                    monthlyStats[key].hasData = true;
                    if (t.type === 'income') monthlyStats[key].in += parseFloat(t.amount);
                    else monthlyStats[key].out += parseFloat(t.amount);
                });

                const baseInc = profileData?.monthly_income || 0;
                while (true) {
                    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
                    if (!monthlyStats[key] || !monthlyStats[key].hasData) break;
                    const totalIn = baseInc + monthlyStats[key].in;
                    if (totalIn >= monthlyStats[key].out) {
                        currentStreak++;
                        checkDate.setMonth(checkDate.getMonth() - 1);
                    } else {
                        break;
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

    // Resumen de gastos por categoría del mes seleccionado
    const expensesByCategory = categories.map(cat => {
        const total = transactions
            .filter(t => t.type === 'expense' && t.category_id === cat.id)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return { ...cat, total };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    const uncategorizedExpenses = transactions
        .filter(t => t.type === 'expense' && !t.category_id)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    if (loading && !profile) return (
        <div className="dashboard-container fade-in">
            <p className="text-muted p-4">Cargando tu resumen...</p>
        </div>
    );

    return (
        <div className="dashboard-container fade-in">
            <header className="dashboard-header">
                <div>
                    <h1 className="greeting">
                        Hola, {profile?.display_name || user?.email?.split('@')[0]} 👋
                    </h1>

                    {/* Navegación de meses */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={goToPrevMonth}
                            style={{ background: 'none', color: 'var(--text-muted)', padding: '0.2rem', borderRadius: '4px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'white'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <p className="subtitle" style={{ margin: 0, minWidth: '170px', textAlign: 'center' }}>
                            {isCurrentMonth ? 'Resumen de este mes' : `Resumen de ${MESES[selectedMonth]} ${selectedYear}`}
                        </p>
                        <button
                            onClick={goToNextMonth}
                            style={{
                                background: 'none',
                                color: isCurrentMonth ? 'var(--border)' : 'var(--text-muted)',
                                padding: '0.2rem', borderRadius: '4px', display: 'flex', alignItems: 'center',
                                cursor: isCurrentMonth ? 'default' : 'pointer',
                            }}
                            onMouseEnter={e => { if (!isCurrentMonth) e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { if (!isCurrentMonth) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    <span>Nuevo</span>
                </button>
            </header>

            <div className="stats-grid">
                {/* Tarjeta Sueldo / Ingresos */}
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
                        <p className="stat-label">
                            {isCurrentMonth ? 'Gastos del Mes' : `Gastos de ${MESES[selectedMonth]}`}
                        </p>
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

            {/* Resumen por categoría */}
            {expensesByCategory.length > 0 && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                        Gastos por categoría — {isCurrentMonth ? 'este mes' : `${MESES[selectedMonth]} ${selectedYear}`}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {expensesByCategory.map(cat => {
                            const pct = totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0;
                            return (
                                <div key={cat.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                            {cat.icon && <span>{cat.icon}</span>}
                                            <span style={{ color: 'var(--text-main)' }}>{cat.name}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{pct}%</span>
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.9rem' }}>
                                            {formatCLP(cat.total)}
                                        </span>
                                    </div>
                                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                                        <div style={{
                                            height: '100%', borderRadius: '2px',
                                            width: `${pct}%`,
                                            background: cat.color_hex || 'var(--accent)',
                                            transition: 'width 0.4s ease'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                        {uncategorizedExpenses > 0 && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin categoría</span>
                                    <span style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.9rem' }}>
                                        {formatCLP(uncategorizedExpenses)}
                                    </span>
                                </div>
                                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                                    <div style={{
                                        height: '100%', borderRadius: '2px',
                                        width: `${totalExpenses > 0 ? Math.round((uncategorizedExpenses / totalExpenses) * 100) : 0}%`,
                                        background: 'var(--text-muted)',
                                        transition: 'width 0.4s ease'
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="recent-activity-section">
                <div className="glass-panel p-6" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem' }}>
                            {isCurrentMonth ? 'Movimientos Recientes' : `Movimientos — ${MESES[selectedMonth]} ${selectedYear}`}
                        </h2>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p className="text-muted">
                                {isCurrentMonth
                                    ? 'Aún no has registrado transacciones este mes.'
                                    : `No hay transacciones registradas para ${MESES[selectedMonth]} ${selectedYear}.`}
                            </p>
                            {!isCurrentMonth && (
                                <button
                                    className="btn-primary"
                                    style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                                    onClick={() => setIsModalOpen(true)}
                                >
                                    <Plus size={16} /> Agregar transacción
                                </button>
                            )}
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

            <SavingsGoal
                monthlyIncome={totalIncome}
                monthlyExpenses={totalExpenses}
                profile={profile}
                onProfileUpdate={(updates) => setProfile(prev => ({ ...prev, ...updates }))}
            />

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchData}
                defaultDate={defaultDate}
            />
        </div>
    );
};

export default Dashboard;
