import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell } from 'lucide-react';

const NotificationBell = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const bellRef = useRef(null);

    const fetchNotifications = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    useEffect(() => {
        fetchNotifications();

        if (user) {
            const channel = supabase
                .channel('notifications-db-changes')
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                }, (payload) => {
                    setNotifications(prev => [payload.new, ...prev].slice(0, 10));
                    setUnreadCount(prev => prev + 1);
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [user]);

    // Cerrar al hacer click fuera
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleToggle = () => {
        if (!isOpen && bellRef.current) {
            const rect = bellRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                left: rect.left - 300 + rect.width, // alinea derecha del dropdown con derecha del botón
            });
        }
        setIsOpen(prev => !prev);
    };

    const markAsRead = async (id) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        }
    };

    const dropdown = isOpen ? ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: Math.max(8, dropdownPos.left), // nunca fuera del viewport izquierdo
            width: '320px',
            background: 'var(--bg-card)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            zIndex: 9998,
            animation: 'fadeIn 0.2s ease',
            overflow: 'hidden',
        }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-main)' }}>Notificaciones</h3>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                        Marcar todo leído
                    </button>
                )}
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>No tienes notificaciones nuevas.</p>
                    </div>
                ) : (
                    notifications.map(note => (
                        <div
                            key={note.id}
                            onClick={() => !note.is_read && markAsRead(note.id)}
                            style={{
                                padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                background: note.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                cursor: note.is_read ? 'default' : 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                            }}
                        >
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%', marginTop: '0.4rem', flexShrink: 0,
                                background: note.is_read ? 'transparent' : 'var(--primary)'
                            }}></div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', margin: '0 0 0.25rem 0', lineHeight: 1.4 }}>
                                    {note.message}
                                </p>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {new Date(note.created_at).toLocaleDateString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div ref={bellRef} style={{ position: 'relative' }}>
            <button
                onClick={handleToggle}
                style={{
                    background: isOpen ? 'rgba(255,255,255,0.08)' : 'none',
                    border: 'none', color: isOpen ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: 'pointer', position: 'relative', padding: '0.5rem',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => {
                    if (!isOpen) {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'none';
                    }
                }}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'var(--danger)', color: 'white',
                        fontSize: '0.65rem', fontWeight: 'bold',
                        width: '16px', height: '16px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {dropdown}
        </div>
    );
};

export default NotificationBell;
