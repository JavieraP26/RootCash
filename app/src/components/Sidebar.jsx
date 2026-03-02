import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    LayoutDashboard,
    Wallet,
    Tags,
    CalendarClock,
    PieChart,
    BarChart2,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import './Sidebar.css';

const Sidebar = () => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        if (!user) return;
        const fetchProfile = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('display_name, avatar')
                .eq('id', user.id)
                .single();
            if (data) setProfile(data);
        };
        fetchProfile();
    }, [user]);

    const toggleSidebar = () => setIsOpen(!isOpen);

    const navItems = [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { name: 'Movimientos', path: '/movimientos', icon: <Wallet size={20} /> },
        { name: 'Presupuestos', path: '/presupuestos', icon: <PieChart size={20} /> },
        { name: 'Estadísticas', path: '/estadisticas', icon: <BarChart2 size={20} /> },
        { name: 'Categorías', path: '/categorias', icon: <Tags size={20} /> },
        { name: 'Gastos Fijos', path: '/deudas', icon: <CalendarClock size={20} /> },
    ];

    const displayName = profile?.display_name || user?.email?.split('@')[0];
    const avatar = profile?.avatar || '🐱';

    return (
        <>
            <button className="mobile-toggle" onClick={toggleSidebar}>
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className={`sidebar glass-panel ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
                        <img src="/logo.svg" alt="RootCash" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
                        <h2 className="brand-title">RootCash</h2>
                    </NavLink>
                    {user && <NotificationBell />}
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            onClick={() => setIsOpen(false)}
                        >
                            {item.icon}
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {/* Tarjeta de perfil clickeable */}
                    <button
                        className="profile-mini-card"
                        onClick={() => { navigate('/perfil'); setIsOpen(false); }}
                        title="Ver mi perfil"
                    >
                        <span className="profile-mini-avatar">{avatar}</span>
                        <div className="profile-mini-info">
                            <span className="profile-mini-name">{displayName}</span>
                            <span className="profile-mini-label">Ver perfil</span>
                        </div>
                    </button>

                    <button className="logout-btn" onClick={signOut}>
                        <LogOut size={20} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </div>

            {/* Overlay para móviles */}
            {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
        </>
    );
};

export default Sidebar;
