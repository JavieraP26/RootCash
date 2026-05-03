# Plan de Implementación — Tests Unitarios e Integración
# RootCash

---

## Stack recomendado

| Capa | Herramienta | Por qué |
|---|---|---|
| Unit + Component tests | **Vitest** | Ya usa Vite — configuración casi cero, API idéntica a Jest |
| Renderizado de componentes | **React Testing Library** | Estándar de la industria para React, testea comportamiento real |
| Eventos de usuario | **@testing-library/user-event** | Simula clics, tipeos, selects de forma realista |
| Matchers adicionales | **@testing-library/jest-dom** | `toBeInTheDocument()`, `toHaveValue()`, etc. |
| Tests Python | **pytest + pytest-mock** | Nativo, legible, fácil de mockear Supabase/SMTP |
| E2E (futuro, Fase 6) | **Playwright** | Multi-browser, compatible con PWA |

---

## Fase 1 — Configurar infraestructura

> Tiempo estimado: 20–30 min. Sin esto, nada corre.

### Frontend (`app/`)

**1. Instalar dependencias:**
```bash
cd app
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

**2. Crear `app/vitest.config.js`:**
```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
});
```

**3. Crear `app/src/test/setup.js`:**
```js
import '@testing-library/jest-dom';
```

**4. Agregar script en `app/package.json`:**
```json
"test": "vitest",
"test:ui": "vitest --ui",
"coverage": "vitest run --coverage"
```

**5. Crear mock global de Supabase en `app/src/test/mocks/supabase.js`:**
```js
// Mock reutilizable — cada test puede sobreescribir el retorno
export const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockResolvedValue({ data: [], error: null }),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
};
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }));
```

### Backend (`backend/`)

**1. Agregar a `requirements.txt`:**
```
pytest>=8.0.0
pytest-mock>=3.12.0
```

**2. Crear `backend/tests/__init__.py`** (vacío)

**3. Crear `backend/tests/conftest.py`** con fixtures compartidos (usuario de prueba, deudas de ejemplo).

---

## Fase 2 — Tests unitarios: lógica pura

> Sin red, sin DOM. Los más rápidos de escribir y ejecutar.

### `app/src/utils/formatters.js`

Archivo de tests: `app/src/utils/formatters.test.js`

| Test | Entrada | Esperado |
|---|---|---|
| Formato CLP básico | `1500000` | `"$1.500.000"` |
| Formato CLP cero | `0` | `"$0"` |
| Formato CLP negativo | `-5000` | manejo sin crash |
| Parse monto con puntos | `"1.500.000"` | `1500000` |
| Parse monto simple | `"44000"` | `44000` |
| Parse monto con coma decimal | `"1.500,50"` | `1500.50` |
| Parse string vacío | `""` | `NaN` o `0` |
| Formato de fecha | `"2025-03-15"` | `"15/03/2025"` |

### `backend/` — `gmail_sync.py`

Archivo de tests: `backend/tests/test_gmail_sync.py`

| Test | Qué verifica |
|---|---|
| `test_extract_amount_peso` | `"Cargo por $45.000"` → `45000` |
| `test_extract_amount_clp` | `"Monto: 45.000 CLP"` → `45000` |
| `test_extract_amount_sin_monto` | `"Hola, tu cuenta está activa"` → `None` |
| `test_is_income_keyword` | Email con "abono", "depósito", "transferencia recibida" → tipo `income` |
| `test_is_expense_keyword` | Email con "cargo", "compra", "débito" → tipo `expense` |
| `test_deduplication_same_thread` | Mismo `gmail_thread_id` → no inserta duplicado |
| `test_deduplication_different_thread` | Distinto thread → sí inserta |

### `backend/` — `main.py`

Archivo de tests: `backend/tests/test_main.py`

| Test | Qué verifica |
|---|---|
| `test_should_notify_3_days_before` | `due_day = 15`, hoy = día 12 → debe notificar |
| `test_should_notify_on_due_day` | `due_day = 15`, hoy = día 15 → debe notificar |
| `test_should_not_notify_already_sent` | `last_notified_month = mes_actual` → no notificar |
| `test_should_not_notify_far_away` | `due_day = 28`, hoy = día 1 → no notificar |
| `test_email_html_structure` | El HTML generado contiene nombre de la deuda y monto |

---

## Fase 3 — Tests de componentes

> Renderizan el componente en jsdom y verifican comportamiento visible.

### `TransactionModal.jsx`

Archivo: `app/src/components/TransactionModal.test.jsx`

```
✓ Renderiza los campos: Categoría, Descripción, Monto, Fecha
✓ Submit con datos válidos llama a supabase.insert con los valores correctos
✓ Submit con monto no numérico muestra alerta de error
✓ Submit sin fecha muestra alerta de error
✓ Modo con defaultDate pre-rellena la fecha en formato dd/mm/aaaa
✓ Seleccionar categoría con gasto fijo asociado auto-rellena descripción y monto
✓ Aparece indicador "✓ Autocompletado desde gasto fijo"
✓ Botón X llama a onClose
✓ Clic fuera del modal llama a onClose
✓ Botón "Gasto" / "Ingreso Extra" alterna el tipo correctamente
```

### `Sidebar.jsx`

Archivo: `app/src/components/Sidebar.test.jsx`

```
✓ Renderiza los links de navegación (Dashboard, Movimientos, Estadísticas, etc.)
✓ En mobile, el botón de menú abre/cierra el sidebar
✓ Muestra el nombre del usuario autenticado
✓ El link activo tiene la clase CSS correcta según la ruta actual
```

### `SavingsGoal.jsx`

Archivo: `app/src/components/SavingsGoal.test.jsx`

```
✓ No renderiza nada si no hay meta configurada
✓ Renderiza barra de progreso al 0%
✓ Renderiza barra de progreso al 50%
✓ Al llegar al 100% muestra estado completado
```

### `NotificationBell.jsx`

Archivo: `app/src/components/NotificationBell.test.jsx`

```
✓ Sin notificaciones → no muestra badge de contador
✓ Con 3 notificaciones → muestra badge con "3"
✓ Con más de 9 → muestra "9+" (o el máximo configurado)
```

---

## Fase 4 — Tests de integración

> Usan el mock de Supabase. Verifican flujos completos de página.

### `Dashboard.jsx`

Archivo: `app/src/pages/Dashboard.test.jsx`

```
✓ Carga y muestra transacciones del mes actual
✓ Los totales (gastos, ingresos, balance) se calculan correctamente
✓ Navegar al mes anterior muestra los datos de ese mes
✓ No se puede navegar a un mes futuro (botón → deshabilitado)
✓ Mes sin transacciones muestra estado vacío y botón "Agregar transacción"
✓ Editar el ingreso mensual guarda el nuevo valor en Supabase
✓ Abrir modal de nuevo movimiento pre-rellena la fecha correcta
✓ Al guardar un movimiento nuevo, la lista se actualiza
```

### `Transactions.jsx` (Movimientos)

Archivo: `app/src/pages/Transactions.test.jsx`

```
✓ Muestra la lista de transacciones del mes actual
✓ Navegar al mes anterior filtra correctamente
✓ Buscar por descripción reduce la lista
✓ Filtro "Solo Gastos" oculta los ingresos
✓ Filtro "Solo Ingresos" oculta los gastos
✓ Eliminar transacción muestra confirm y la quita de la lista
✓ Botón "Nuevo" abre el TransactionModal
✓ En mes sin movimientos, el botón "Agregar movimiento" del estado vacío abre el modal
✓ Modal se abre con la fecha pre-rellenada al mes navegado (primer día si es mes pasado)
✓ Exportar CSV genera un archivo con las columnas correctas
```

### `Categories.jsx`

Archivo: `app/src/pages/Categories.test.jsx`

```
✓ Muestra la lista de categorías del usuario
✓ Crear categoría llama a supabase.insert y actualiza la lista
✓ Eliminar categoría llama a supabase.delete
✓ Picker de emojis se abre al hacer clic en el botón de emoji
✓ Seleccionar emoji en el picker lo asigna al formulario
```

### `FixedDebts.jsx`

Archivo: `app/src/pages/FixedDebts.test.jsx`

```
✓ Muestra la lista de gastos fijos
✓ Crear deuda fija llama a supabase.insert
✓ Editar deuda actualiza el monto y descripción
✓ Eliminar deuda la quita de la lista
✓ Las deudas se ordenan por día de vencimiento
```

### `Stats.jsx`

Archivo: `app/src/pages/Stats.test.jsx`

```
✓ Datos vacíos no crashea los gráficos
✓ Cambiando selector de meses comparativos (2m/3m/4m/6m/12m) re-consulta Supabase
✓ El grid de comparativa cambia de columnas según los meses seleccionados
✓ El título refleja el número de meses seleccionado
✓ El gráfico de barras siempre muestra 6 meses independiente del selector
```

---

## Fase 5 — Tests de API Vercel

Archivo: `api/gmail/__tests__/` (usar Jest o Vitest con entorno Node)

### `connect.js`

```
✓ Sin sesión válida → responde 401
✓ Con sesión válida → retorna URL de OAuth con scopes gmail.readonly y email
✓ La URL incluye access_type=offline (para refresh_token)
✓ Genera un state token único por request (no reutiliza)
```

### `callback.js`

```
✓ Con code válido intercambia tokens y guarda en Supabase
✓ state inválido o expirado → responde 400
✓ Error al guardar en Supabase → responde 500 con mensaje útil
```

### `disconnect.js`

```
✓ Sin sesión → 401
✓ Con sesión → elimina tokens de Supabase y responde 200
```

---

## Orden de implementación recomendado

```
Semana 1:
  [x] Fase 1 — Setup infraestructura (30 min)
  [ ] Fase 2 — formatters.test.js (fácil, retorno rápido)
  [ ] Fase 3 — TransactionModal.test.jsx (el componente más crítico)

Semana 2:
  [ ] Fase 4 — Dashboard.test.jsx + Transactions.test.jsx
  [ ] Fase 3 — Sidebar, SavingsGoal, NotificationBell

Semana 3:
  [ ] Fase 4 — Categories, FixedDebts, Stats
  [ ] Fase 2 backend — test_gmail_sync.py + test_main.py

Semana 4 (si hay tiempo):
  [ ] Fase 5 — API Vercel
  [ ] Agregar CI (GitHub Actions: correr vitest en cada PR)
```

---

## CI sugerido (`.github/workflows/test.yml`)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd app && npm ci
      - run: cd app && npm test -- --run

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd backend && pip install -r requirements.txt
      - run: cd backend && pytest tests/ -v
```

---

## Notas importantes

- **Supabase nunca se llama en tests** — siempre mockeado. Los tests de integración verifican que se llamen las funciones correctas con los parámetros correctos, no que la DB responda bien.
- **No testear implementación, testear comportamiento** — si un test falla porque renombraste una variable interna, ese test estaba mal escrito.
- **Prioridad**: los tests más valiosos son los de `TransactionModal`, `Dashboard` y `Transactions` porque cubren los flujos que el usuario usa a diario.
