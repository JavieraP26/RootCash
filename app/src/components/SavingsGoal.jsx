import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../utils/formatters';
import { parseAmount } from '../utils/formatters';
import { Target, Edit2, Check, X } from 'lucide-react';

const PERIOD_LABELS = {
    monthly: 'este mes',
    quarterly: 'este trimestre',
    yearly: 'este año'
};

const PERIOD_OPTIONS = [
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' }
];

const SavingsGoal = ({ monthlyIncome, monthlyExpenses, profile, onProfileUpdate }) => {
    const { user } = useAuth();
    const [editing, setEditing] = useState(false);
    const [goalAmount, setGoalAmount] = useState('');
    const [goalPeriod, setGoalPeriod] = useState('monthly');
    const [goalTitle, setGoalTitle] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            setGoalAmount(profile.savings_goal_amount || '');
            setGoalPeriod(profile.savings_goal_period || 'monthly');
            setGoalTitle(profile.savings_goal_title || '');
        }
    }, [profile]);

    const goalAmountNum = parseFloat(profile?.savings_goal_amount || 0);
    const savedAmountNum = parseFloat(profile?.savings_current_amount || 0);
    const progress = goalAmountNum > 0 ? Math.min((savedAmountNum / goalAmountNum) * 100, 100) : 0;
    const progressColor = progress >= 100 ? 'var(--accent)' : progress >= 60 ? '#f59e0b' : 'var(--primary)';

    const [depositAmount, setDepositAmount] = useState('');
    const [depositing, setDepositing] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);

    const handleDeposit = async () => {
        if (!user) return;
        const amountToAdd = parseAmount(depositAmount);
        if (isNaN(amountToAdd) || amountToAdd <= 0) return;

        setDepositing(true);
        const newTotal = savedAmountNum + amountToAdd;

        const { error } = await supabase.from('profiles').update({
            savings_current_amount: newTotal
        }).eq('id', user.id);

        if (!error && onProfileUpdate) {
            onProfileUpdate({ savings_current_amount: newTotal });
            setDepositAmount('');
            setShowDeposit(false);
        }
        setDepositing(false);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        const amount = parseAmount(goalAmount);
        const { error } = await supabase.from('profiles').update({
            savings_goal_amount: amount,
            savings_goal_title: goalTitle
        }).eq('id', user.id);
        if (!error && onProfileUpdate) onProfileUpdate({
            savings_goal_amount: amount,
            savings_goal_title: goalTitle
        });
        setSaving(false);
        setEditing(false);
    };

    const handleCancel = () => {
        setGoalAmount(profile?.savings_goal_amount || '');
        setGoalTitle(profile?.savings_goal_title || '');
        setEditing(false);
    };

    if (!profile?.savings_goal_amount && !editing) {
        return (
            <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Target size={20} style={{ color: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-muted)' }}>Sin meta de ahorro definida</span>
                </div>
                <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setEditing(true)}>
                    + Definir meta
                </button>
            </div>
        );
    }

    return (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Target size={18} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontWeight: 600 }}>{profile?.savings_goal_title || 'Alcancía'}</span>
                </div>
                {!editing && (
                    <button onClick={() => setEditing(true)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}>
                        <Edit2 size={15} />
                    </button>
                )}
            </div>

            {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Título de tu meta (Ej: Para el pie de la casa)</label>
                        <input
                            type="text"
                            value={goalTitle}
                            onChange={e => setGoalTitle(e.target.value)}
                            placeholder="Ej: Ahorro para independizarme"
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Monto objetivo</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={goalAmount}
                                onChange={e => setGoalAmount(e.target.value)}
                                placeholder="Ej: 500.000"
                                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#171a20', color: 'var(--text-main)', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Check size={15} />{saving ? '...' : 'Guardar'}
                        </button>
                        <button onClick={handleCancel} style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>
                            <X size={15} />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                        <span style={{ color: progressColor, fontWeight: 600 }}>
                            {formatCLP(Math.max(savedAmountNum, 0))} ahorrado
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                            Meta: {formatCLP(goalAmountNum)}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(progress, 0)}%`, height: '100%', background: progressColor, borderRadius: '5px', transition: 'width 0.6s ease, background 0.3s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.4rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {progress >= 100
                                ? '🎉 ¡Meta alcanzada!'
                                : goalAmountNum > 0 && savedAmountNum < goalAmountNum
                                    ? `Faltan ${formatCLP(goalAmountNum - Math.max(savedAmountNum, 0))}`
                                    : ''}
                        </div>
                        {!showDeposit ? (
                            <button
                                onClick={() => setShowDeposit(true)}
                                style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}
                            >
                                + Abonar
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={depositAmount}
                                    onChange={e => setDepositAmount(e.target.value)}
                                    placeholder="Monto"
                                    style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: '#171a20', color: 'white', fontSize: '0.8rem' }}
                                    autoFocus
                                />
                                <button onClick={handleDeposit} disabled={depositing} style={{ color: 'var(--accent)', padding: '0.3rem' }}>
                                    <Check size={14} />
                                </button>
                                <button onClick={() => setShowDeposit(false)} style={{ color: 'var(--danger)', padding: '0.3rem' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SavingsGoal;
