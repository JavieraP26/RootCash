import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import './Login.css';

const Login = () => {
    const { signInWithGoogle } = useAuth();

    return (
        <div className="login-container">
            <div className="glass-panel login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <span className="logo-icon">💵</span>
                    </div>
                    <h1 className="text-gradient logo-text">RootCash</h1>
                    <p className="subtitle">Tu asistente financiero personal e inteligente</p>
                </div>

                <div className="login-body">
                    <p className="login-prompt">Inicia sesión para tomar el control de tus finanzas</p>

                    <button onClick={signInWithGoogle} className="google-btn">
                        <img
                            src="https://www.google.com/favicon.ico"
                            alt="Google logo"
                            className="google-icon"
                        />
                        <span>Continuar con Google</span>
                    </button>
                </div>

                <div className="login-footer">
                    <p>Tus datos están sincronizados en la nube de forma segura.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
