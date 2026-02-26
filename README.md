# 🌱 RootCash — Control de Finanzas Personales

> Tu dinero, bajo control. Una app web moderna para gestionar tus ingresos, gastos, presupuestos y deudas fijas en Pesos Chilenos (CLP).

![RootCash Banner](./app/public/logo.svg)

---

## ✨ Características

| Módulo | Descripción |
|---|---|
| 📊 **Dashboard** | Resumen del mes con sueldo base, gastos totales y saldo disponible en tiempo real |
| 💸 **Movimientos** | Registro de gastos e ingresos extra con búsqueda y filtros por tipo |
| 🏷️ **Categorías** | Crea y personaliza tus propias categorías con colores únicos |
| 📈 **Presupuestos** | Define límites mensuales por categoría y visualiza tu avance con barras de progreso |
| 📌 **Gastos Fijos** | Gestiona pagos mensuales recurrentes y márcalos como pagados |
| 🔔 **Notificaciones** | Campanita en la app con alertas en tiempo real via Supabase Realtime |
| 👤 **Perfil** | Nombre personalizado, avatar de animal, edad, género y datos laborales |

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** + **Vite** — UI reactiva y builds ultrarrápidos
- **React Router** — Navegación SPA con rutas protegidas
- **Vanilla CSS** — Sistema de diseño propio en dark mode, glassmorphism y micro-animaciones
- **Lucide React** — Íconos modernos y consistentes

### Backend / Infraestructura
- **Supabase** — Base de datos PostgreSQL, autenticación y Realtime
- **Google OAuth** — Login seguro con cuenta Google
- **Python** — Script de notificaciones por email/Slack para recordatorios de gastos fijos

---

## 🗄️ Esquema de la Base de Datos

```
profiles          → Perfil del usuario (sueldo, nombre, avatar, trabajo)
categories        → Categorías personalizadas con color
transactions      → Movimientos (gastos e ingresos)
budgets           → Límites mensuales por categoría
fixed_debts       → Gastos fijos mensuales recurrentes
notifications     → Alertas para la campanita de la app
```

---

## 🚀 Instalación Local

### Requisitos
- Node.js 18+
- Una cuenta en [Supabase](https://supabase.com)
- Una app de OAuth configurada en [Google Cloud Console](https://console.cloud.google.com)

### 1. Clona el repositorio
```bash
git clone https://github.com/TU_USUARIO/rootcash.git
cd rootcash
```

### 2. Instala dependencias
```bash
cd app
npm install
```

### 3. Configura las variables de entorno
Crea el archivo `app/.env`:
```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

### 4. Crea las tablas en Supabase
Ejecuta los siguientes archivos SQL en el **SQL Editor** de tu proyecto Supabase, en orden:

1. `schema_notifications.sql` → Tabla de notificaciones con RLS
2. `schema_profile_update.sql` → Columnas extra del perfil (avatar, género, trabajo)

> Las tablas principales (`profiles`, `categories`, `transactions`, `budgets`, `fixed_debts`) deben crearse según el esquema descrito en la sección anterior.

### 5. Configura Google OAuth en Supabase
1. Ve a **Authentication → Providers → Google**
2. Ingresa tu **Client ID** y **Client Secret** de Google Cloud Console
3. Agrega el redirect URI: `https://TU_PROYECTO.supabase.co/auth/v1/callback`

### 6. Inicia el servidor de desarrollo
```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`

---

## 🔔 Script de Notificaciones (Python)

El script revisa las **Gastos Fijos** con vencimiento en los próximos 2 días y envía alertas por email y/o Slack, además de guardarlas en la app.

### Instalación
```bash
cd backend
pip install supabase python-dotenv requests
```

### Configuración
Crea el archivo `backend/.env`:
```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY

# Opcional: Email (Gmail App Password)
EMAIL_SENDER=tu@gmail.com
EMAIL_PASSWORD=tu_app_password

# Opcional: Slack Webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Ejecución
```bash
python backend/notifier.py
```

Para automatizarlo, configura un **cron job** (Linux/Mac) o una **Tarea Programada** (Windows) para ejecutarlo diariamente.

---

## ☁️ Deploy en Vercel (recomendado)

1. Sube el código a GitHub
2. Ve a [vercel.com](https://vercel.com) → **Add New Project**
3. Selecciona el repositorio y configura:
   - **Framework:** Vite
   - **Root Directory:** `app`
4. Agrega las variables de entorno en **Settings → Environment Variables**
5. Haz click en **Deploy**

Recuerda actualizar en Supabase:
- **Authentication → URL Configuration → Site URL** → tu URL de Vercel

Y en Google Cloud Console:
- **Authorized redirect URIs** → `https://TU_APP.vercel.app`

---

## 📁 Estructura del Proyecto

```
RootCash/
├── app/                          # Aplicación React/Vite
│   ├── public/
│   │   └── logo.svg              # Logo SVG de RootCash
│   └── src/
│       ├── components/           # Componentes reutilizables
│       │   ├── Sidebar.jsx       # Navegación lateral
│       │   ├── NotificationBell.jsx
│       │   └── TransactionModal.jsx
│       ├── contexts/
│       │   └── AuthContext.jsx   # Contexto de autenticación
│       ├── lib/
│       │   └── supabase.js       # Cliente de Supabase
│       ├── pages/                # Vistas principales
│       │   ├── Dashboard.jsx
│       │   ├── Transactions.jsx
│       │   ├── Categories.jsx
│       │   ├── Budgets.jsx
│       │   ├── FixedDebts.jsx
│       │   └── Profile.jsx
│       └── utils/
│           └── formatters.js     # formatCLP, formatDate, parseAmount
├── backend/
│   └── notifier.py               # Script Python de notificaciones
├── schema_notifications.sql      # SQL: tabla notifications
├── schema_profile_update.sql     # SQL: columnas extra de profiles
└── README.md
```

---

## 🎨 Diseño

- **Dark mode** nativo con paleta sobria y profesional
- **Glassmorphism** en paneles y cards
- **Responsive** — funciona en desktop y móvil
- Fuente: [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts)
- Animaciones CSS suaves en transiciones y hover states

---

## 📝 Licencia

Proyecto personal. Sin licencia de distribución pública.

---

*Hecho con 🌱 y mucho ☕ — RootCash, porque tus raíces financieras importan.*
