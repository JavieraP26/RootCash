import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP, parseAmount, formatDate } from '../utils/formatters';
import { TrendingUp, TrendingDown, Wallet, Plus, ArrowUpRight, ArrowDownRight, Pencil, Check, X } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import './Dashboard.css';

const Dashboard = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [transactions, setTransactions] = useState([]);
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
                .gte('date', firstDay.split('T')[0])
                .lte('date', lastDay.split('T')[0])
                .order('date', { ascending: false });

            if (transData) setTransactions(transData);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
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
                    <h1 className="greeting">Hola, {profile?.display_name || user?.email?.split('@')[0]} 👋</h1>
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
