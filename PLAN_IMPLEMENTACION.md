# RootCash — Plan completo de implementación

Plan de implementación por fases de los aspectos definidos en **MEJORAS.md**: testeo, seguridad, privacidad, estabilidad, escalabilidad y mantenibilidad. Cada fase tiene tareas concretas, orden de ejecución, dependencias y criterios de aceptación.

---

## Visión general

| Fase | Nombre | Objetivo principal | Duración estimada |
|------|--------|--------------------|-------------------|
| 0 | Preparación | Entorno de tests y convenciones | 0,5–1 día |
| 1 | Tests base | Unit tests críticos y CI | 2–3 días |
| 2 | Validación y seguridad frontend | Esquemas, límites, headers | 1,5–2 días |
| 3 | Seguridad backend y DB | Constraints, notifier, audit | 1 día |
| 4 | Tests integración y E2E | MSW, Playwright, cobertura | 2–3 días |
| 5 | Privacidad y estabilidad | Política, exportar/eliminar, errores | 1,5–2 días |
| 6 | Escalabilidad y mantenibilidad | Paginación, TypeScript, docs | 2–4 días (opcional repartido) |

Las fases 0–3 son la base; 4–6 se pueden hacer en paralelo o después según prioridad.

---

## Fase 0: Preparación del entorno

**Objetivo:** Tener Vitest, React Testing Library, Playwright y convenciones listas sin romper el build actual.

### 0.1 Instalar dependencias de test (app)

**Orden:** Primero.

**Tareas:**
1. En `app/`: instalar Vitest, jsdom, React Testing Library, jest-dom.
   ```bash
   cd app && npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
   ```
2. Instalar MSW para integración (Fase 4, pero conviene tenerlo):
   ```bash
   npm i -D msw
   ```
3. Instalar Playwright (E2E):
   ```bash
   npm i -D @playwright/test
   npx playwright install
   ```

**Entregable:** `app/package.json` con las devDependencies. Build y `npm run dev` siguen funcionando.

---

### 0.2 Configurar Vitest

**Orden:** Después de 0.1.

**Tareas:**
1. Crear `app/vitest.config.js` (o `vitest.config.ts` si más adelante se usa TS):
   - `environment: 'jsdom'`
   - `include`: por ejemplo `['src/**/*.{test,spec}.{js,jsx,ts,tsx}']`
   - `globals: true` si se usan expect global, o importar desde `vitest` explícitamente
   - `setupFiles`: apuntar a `src/test/setup.js` (o similar)
2. Crear `app/src/test/setup.js`:
   - `import '@testing-library/jest-dom'`
   - Cualquier mock global (ej. `import.meta.env.VITE_*`) si hace falta
3. En `app/package.json` añadir scripts:
   - `"test": "vitest"`
   - `"test:run": "vitest run"`
   - `"test:ui": "vitest --ui"`
   - `"test:coverage": "vitest run --coverage"`

**Entregable:** `npm run test:run` ejecuta Vitest (aún sin tests, debe terminar en 0 tests).

---

### 0.3 Configurar Playwright

**Orden:** Después de 0.1.

**Tareas:**
1. Inicializar Playwright si no existe config:
   ```bash
   npx playwright install
   ```
2. Crear `app/playwright.config.js` (o en raíz `e2e/playwright.config.js` si prefieres e2e en raíz):
   - `baseURL`: por ejemplo `http://localhost:5173`
   - `webServer`: comando `npm run dev` y URL del dev server
   - `testDir`: por ejemplo `e2e` o `tests/e2e`
3. Añadir script en `app/package.json`: `"test:e2e": "playwright test"` (y opcional `"test:e2e:ui": "playwright test --ui"`).

**Entregable:** Carpeta `app/e2e/` (o la que elijas) con un test placeholder que visite `/login` y compruebe que existe el botón de Google. `npm run test:e2e` corre (puede fallar si no hay stub de auth; se afina en Fase 4).

---

### 0.4 Estructura de carpetas de tests

**Orden:** Con 0.2.

**Tareas:**
1. Crear carpetas (según convención elegida):
   - `app/src/utils/__tests__/`
   - `app/src/contexts/__tests__/`
   - `app/src/components/__tests__/`
   - `app/src/pages/__tests__/`
   - `app/src/test/` (setup, mocks, helpers)
2. Opcional: `app/src/test/mocks/` para datos fake (transacciones, perfil, categorías) reutilizables en unit e integración.

**Entregable:** Estructura lista para añadir archivos `*.test.jsx` o `*.spec.jsx`.

---

### 0.5 (Opcional) Prettier y Husky

**Orden:** Cualquier momento; recomendado antes de Fase 4.

**Tareas:**
1. Instalar Prettier y Husky + lint-staged en `app/`:
   ```bash
   npm i -D prettier husky lint-staged
   npx husky init
   ```
2. Añadir `.prettierrc` y `.prettierignore` (ignorar `dist`, `node_modules`).
3. En `package.json`: `"lint-staged": { "*.{js,jsx,ts,tsx,css,md}": ["prettier --write", "eslint"] }`.
4. En `.husky/pre-commit`: ejecutar `lint-staged` y opcionalmente `npm run test:run`.

**Entregable:** Al hacer commit, se formatea y se pasa lint (y opcionalmente tests).

---

## Fase 1: Tests unitarios base

**Objetivo:** Cobertura >80% en utilidades y auth; CI ejecutando tests en cada push.

### 1.1 Tests de `utils/formatters.js`

**Orden:** Primero dentro de Fase 1.

**Tareas:**
1. Crear `app/src/utils/__tests__/formatters.test.js`.
2. Tests para `formatCLP`:
   - 0 → "$0"
   - número negativo (si está permitido) o no
   - decimales (1.5, 1000.99)
   - número grande (ej. 1_200_000)
   - valor no numérico / NaN (comportamiento esperado)
3. Tests para `formatDate`:
   - string ISO (ej. "2025-02-26") → formato esperado es-CL
   - fecha inválida → manejo definido (ej. "-" o no romper)
4. Tests para `parseAmount`:
   - "1.200.000" → 1200000
   - "44000" o "44.000" → 44000
   - "" o valor inválido → NaN o 0 según implementación actual
   - con comas como decimal (si aplica)

**Criterio de aceptación:** Todos los tests pasan; cobertura de `formatters.js` >90%.

---

### 1.2 Tests de AuthContext y ProtectedRoute

**Orden:** Después de 1.1.

**Tareas:**
1. Crear `app/src/contexts/__tests__/AuthContext.test.jsx`:
   - Mock de `supabase.auth.getSession` y `onAuthStateChange`.
   - Renderizar `AuthProvider` y un componente que use `useAuth()`.
   - Casos: inicial loading true → luego false; sin sesión → user null; con sesión mock → user poblado.
   - `signInWithGoogle`: verificar que se llama `signInWithOAuth` con `provider: 'google'` y `redirectTo: window.location.origin`.
   - `signOut`: verificar que se llama `supabase.auth.signOut()` y que el estado pasa a user null (según implementación).
2. Crear test para ProtectedRoute (puede estar en `App.test.jsx` o `routes.test.jsx`):
   - Mock de `useAuth`: user null → verificar que se renderiza `<Navigate to="/login" />`.
   - user presente → verificar que se renderizan los children.

**Criterio de aceptación:** Tests pasan; cambios en AuthContext o rutas se detectan.

---

### 1.3 Tests de TransactionModal (validación y submit)

**Orden:** Después de 1.2.

**Tareas:**
1. Crear `app/src/components/__tests__/TransactionModal.test.jsx`.
2. Mock de `useAuth` (user con id), `supabase.from('transactions').insert` (retorna success).
3. Tests:
   - Monto vacío o inválido → no se llama insert (o se muestra alerta).
   - Monto válido en formato chileno → submit llama a insert con user_id, amount parseado, type, date, description, category_id.
   - Submit exitoso → se llama `onSuccess` y `onClose` (verificar con mock/spy).
4. Opcional: comprobar que "Gasto" / "Ingreso Extra" cambian `formData.type`.

**Criterio de aceptación:** Tests pasan; regresiones en validación o en payload de insert se detectan.

---

### 1.4 Tests de SavingsGoal (cálculo y guardado)

**Orden:** Después de 1.2.

**Tareas:**
1. Crear `app/src/components/__tests__/SavingsGoal.test.jsx`.
2. Props mock: `monthlyIncome`, `monthlyExpenses`, `profile` (con/sin `savings_goal_amount`, `savings_goal_period`, `savings_goal_title`).
3. Tests:
   - Cálculo de progreso: dado income, expenses y goal_amount, el porcentaje mostrado (o la barra) es el esperado (monthly vs quarterly vs yearly).
   - Al guardar: se llama `supabase.from('profiles').update` con `savings_goal_amount`, `savings_goal_period`, `savings_goal_title` y `.eq('id', user.id)`.
   - Opcional: validación de monto inválido (no guardar o mostrar error).

**Criterio de aceptación:** Tests pasan; lógica de metas y persistencia cubierta.

---

### 1.5 Tests de cálculos del Dashboard

**Orden:** Después de 1.2.

**Tareas:**
1. Crear `app/src/pages/__tests__/Dashboard.test.jsx`.
2. Mock de `useAuth`, `supabase.from('profiles').select().single()` y `supabase.from('transactions').select()` con datos controlados.
3. Tests:
   - Con transacciones solo income: totalIncome = base + extras, totalExpenses = 0, currentBalance correcto.
   - Con income y expense: totalExpenses y currentBalance correctos.
   - Racha (streak): dado un conjunto de transacciones por mes, verificar que el número de "meses invictos" es el esperado (según la lógica actual del componente).
4. Opcional: FinancialAdvice recibe las props correctas según balance.

**Criterio de aceptación:** Tests pasan; cambios en fórmulas de resumen o racha se detectan.

---

### 1.6 CI (GitHub Actions o similar)

**Orden:** Cuando 1.1–1.5 estén verdes.

**Tareas:**
1. Crear `.github/workflows/test.yml` (o en GitLab/CircleCI el equivalente):
   - Trigger: push a main/develop, PRs.
   - Job: checkout, `node` (versión alineada con proyecto), `cd app && npm ci && npm run test:run`.
   - Opcional: subir cobertura (e.g. Codecov) o solo fallar si tests fallan.
2. Asegurar que en el repo no falten variables para build (Vite puede necesitar env dummy en CI para `VITE_SUPABASE_*` si se referencian en tiempo de build; si solo en runtime, a veces no hace falta).

**Criterio de aceptación:** Cada push/PR ejecuta tests; el job falla si algún test falla.

---

## Fase 2: Validación y seguridad en frontend

**Objetivo:** Esquemas de validación, límites de longitud y headers de seguridad en Vercel.

### 2.1 Constantes de validación

**Orden:** Primero en Fase 2.

**Tareas:**
1. Crear `app/src/constants/validation.js` (o dentro de `app/src/lib/`):
   - `MAX_LENGTH_DESCRIPTION = 500`
   - `MAX_LENGTH_CATEGORY_NAME = 100`
   - `MAX_LENGTH_DISPLAY_NAME = 100`
   - `MAX_LENGTH_JOB_TITLE = 200`
   - `MAX_LENGTH_SAVINGS_GOAL_TITLE = 100`
   - `MAX_AMOUNT = 999_999_999_999` (o el tope que definan)
2. Documentar en comentario o README que estos límites deben coincidir con Supabase (Fase 3).

**Entregable:** Un único lugar con constantes reutilizables.

---

### 2.2 Esquemas Zod (o Yup)

**Orden:** Después de 2.1.

**Tareas:**
1. Instalar Zod en `app/`: `npm i zod`.
2. Crear `app/src/lib/schemas.js` (o por feature: `schemas/transaction.js`, `schemas/profile.js`, etc.):
   - Esquema de transacción: amount positivo, type enum, date, description (max length), category_id opcional.
   - Esquema de perfil: display_name, avatar, age (rango), gender (enum), job_title, fechas, etc.
   - Esquema de categoría: name (max length), color_hex (regex o enum), icon opcional.
   - Esquema de meta de ahorro: amount, period, title (max length).
3. Integrar en formularios:
   - TransactionModal: antes de `supabase.insert`, validar con el esquema; si falla, mostrar mensajes por campo (no solo alert).
   - Profile: igual en handleSave.
   - Categories: en handleSubmit (crear/editar).
   - SavingsGoal: en handleSave.
4. Reutilizar constantes de 2.1 en los esquemas (max lengths).

**Criterio de aceptación:** Formularios rechazan datos inválidos o demasiado largos con mensajes claros; no se envían requests con payload inválido.

---

### 2.3 Mensajes de error unificados

**Orden:** Puede hacerse junto con 2.2.

**Tareas:**
1. Crear un pequeño módulo de feedback: por ejemplo `app/src/components/Toast.jsx` o usar un estado global de "notificaciones" (Context o hook).
2. Sustituir `alert()` en flujos críticos (login, guardar transacción, guardar perfil, guardar categoría) por toast o mensaje inline.
3. En catch de Supabase: mostrar mensaje genérico amigable ("No se pudo guardar. Intenta de nuevo.") y seguir logueando el error en consola para debug.

**Criterio de aceptación:** Usuario ve feedback claro sin popups nativos en los flujos principales.

---

### 2.4 Headers de seguridad (Vercel)

**Orden:** Independiente; puede hacerse en cualquier momento.

**Tareas:**
1. Editar `app/vercel.json`:
   - Añadir sección `headers` con:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY` (o SAMEORIGIN si necesitan embed)
     - `Referrer-Policy: strict-origin-when-cross-origin`
   - Opcional: Content-Security-Policy (CSP) básica: `default-src 'self'; connect-src 'self' https://*.supabase.co https://*.supabase.in; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; frame-src https://*.supabase.co`. Ajustar según recursos reales (OAuth, analytics, etc.).
2. Desplegar y comprobar que login con Google y Realtime siguen funcionando (CSP puede bloquear si falta algún origen).

**Criterio de aceptación:** Headers aplicados en producción; ninguna funcionalidad rota.

---

## Fase 3: Seguridad en base de datos y backend

**Objetivo:** Constraints en Supabase, notifier seguro y buen uso de secrets.

### 3.1 Constraints y checks en Supabase

**Orden:** Después de tener definidos los límites (Fase 2.1).

**Tareas:**
1. Crear script o documento SQL (ej. `supabase/migrations/XXXX_add_validation_constraints.sql` o en docs):
   - `transactions.description`: CHECK (char_length(description) <= 500) (o el valor acordado).
   - `transactions.amount`: CHECK (amount > 0) si no existe.
   - `categories.name`: CHECK (char_length(name) <= 100).
   - `profiles.display_name`: CHECK (display_name IS NULL OR char_length(display_name) <= 100).
   - `profiles.job_title`: CHECK (job_title IS NULL OR char_length(job_title) <= 200).
   - Columnas de metas de ahorro: longitud si existen.
2. Ejecutar en Supabase (SQL Editor o migración) y verificar que inserts/updates que excedan los límites fallen con mensaje claro.
3. Ajustar frontend si algún límite en DB es más estricto que el del cliente.

**Criterio de aceptación:** La base rechaza datos que violen longitud o reglas de negocio; frontend ya no debería enviarlos gracias a 2.2.

---

### 3.2 Revisión del notifier (backend)

**Orden:** Paralelo a 3.1.

**Tareas:**
1. Verificar que `backend/.env` esté en `.gitignore` (y en raíz si el backend está en el mismo repo).
2. Añadir en README o en docs: "Nunca exponer notifier como API HTTP; ejecutar solo por cron/job".
3. Opcional: validar/escapar contenido de `message` antes de enviar a Slack (evitar caracteres que rompan el payload). Para email, texto plano está bien.
4. Plan a medio plazo: sustituir credenciales SMTP por servicio con API key (SendGrid/Resend) y documentar rotación de API keys.

**Criterio de aceptación:** No hay riesgo de commit de .env; notifier sigue siendo solo script; documentación clara.

---

### 3.3 Auditoría de dependencias

**Orden:** Cualquier momento; recomendado al menos una vez por sprint.

**Tareas:**
1. En `app/`: ejecutar `npm audit`; resolver vulnerabilidades críticas y altas (actualizar deps o usar overrides si es necesario).
2. Revisar `npm outdated` y planificar actualizaciones (React, Vite, Supabase, etc.) con pruebas.
3. Opcional: añadir en CI un paso `npm audit --audit-level=high` que falle si hay vulnerabilidades altas/críticas.

**Criterio de aceptación:** No hay vulnerabilidades críticas/altas sin plan de remediación; CI opcional bloquea por audit.

---

## Fase 4: Tests de integración y E2E

**Objetivo:** Flujos con Supabase mockeado (MSW) y E2E con Playwright del happy path y rutas protegidas.

### 4.1 MSW y handlers de Supabase

**Orden:** Primero en Fase 4.

**Tareas:**
1. Crear `app/src/test/mocks/handlers.js` (o similar):
   - Handlers para PostgREST: por ejemplo interceptar `*/rest/v1/profiles*`, `*/rest/v1/transactions*`, `*/rest/v1/categories*`, `*/rest/v1/notifications*`.
   - Respuestas mock: listas vacías o con datos controlados para select; 200/201 para insert/update/delete.
2. En setup de tests de integración, usar `msw/server.use(...handlers)` y `server.listen()` en beforeAll; `server.close()` en afterAll; `server.resetHandlers()` en afterEach si hace falta.
3. Documentar en un comentario o en README cómo añadir nuevos handlers para nuevas tablas o endpoints.

**Entregable:** Tests que llamen a la app (o a hooks/páginas que usen Supabase) pueden correr sin Supabase real.

---

### 4.2 Tests de integración por flujo

**Orden:** Después de 4.1.

**Tareas:**
1. **Login:** Página Login; click en "Iniciar con Google" → verificar que se llama `signInWithOAuth` (mock del cliente Supabase auth).
2. **Categorías:** Página Categories; con user mock y handlers de categories (select vacío, luego insert success); crear categoría y verificar que se dispara insert con user_id correcto.
3. **Transacciones:** Crear movimiento desde modal o desde página; verificar insert con payload correcto; listado con select filtrado por user.
4. **Perfil:** Actualizar display_name y guardar; verificar update en profiles con eq('id', user.id).
5. **Notificaciones:** Componente que usa Realtime; mock del canal postgres_changes o del hook que subscribe; simular INSERT y verificar que el estado de notificaciones se actualiza.

**Criterio de aceptación:** Cada flujo tiene al menos un test de integración que pasa con MSW.

---

### 4.3 E2E con Playwright

**Orden:** Después de 0.3 (configuración) y con app estable.

**Tareas:**
1. **Stub de OAuth:** Configurar en tests E2E un estado de auth (cookie/localStorage de Supabase o página de login que inyecte sesión de prueba). Alternativa: usar cuenta de prueba y login real (más frágil).
2. Test "rutas protegidas": sin sesión, visitar `/`, `/movimientos`, etc. → redirección a `/login`.
3. Test "happy path": login (stub) → dashboard con al menos una tarjeta → abrir modal nuevo movimiento → rellenar y guardar → ver movimiento en lista o en resumen.
4. Test "export CSV": en Movimientos, click en exportar → comprobar que se descarga un archivo con nombre tipo `RootCash_*.csv` y que la primera línea contiene las columnas esperadas.
5. Configurar en CI el job de E2E (Playwright) con `npx playwright install --with-deps` si es necesario; que corra después de `npm run build` y contra el preview (o dev server).

**Criterio de aceptación:** E2E pasan en local y en CI; el happy path y la protección de rutas están cubiertos.

---

## Fase 5: Privacidad y estabilidad

**Objetivo:** Política de privacidad, exportar/eliminar cuenta y manejo de errores robusto.

### 5.1 Páginas legales y enlaces

**Orden:** Primero en Fase 5.

**Tareas:**
1. Redactar (o usar plantilla) **Política de privacidad**: qué datos se recogen (auth, perfil, transacciones), uso (solo servicio), almacenamiento (Supabase), no venta a terceros, derechos (acceso, rectificación, eliminación), cookies si aplica.
2. Redactar **Términos de uso** (uso aceptable, responsabilidad, cambios).
3. Añadir en la app (footer del Login o del Sidebar/Perfil) enlaces: "Privacidad", "Términos". Pueden ser rutas `/privacidad` y `/terminos` que rendericen contenido estático (componente con texto o markdown).
4. En pantalla de login o registro, enlace a política de privacidad si es buen momento para informar antes de crear cuenta.

**Criterio de aceptación:** Usuario puede leer política y términos desde la app.

---

### 5.2 Exportar datos y eliminar cuenta

**Orden:** Después de 5.1.

**Tareas:**
1. **Exportar datos:**
   - En Perfil (o en una sección "Datos y privacidad"), botón "Exportar mis datos".
   - Al hacer click: obtener de Supabase (con RLS) profiles, categories, transactions, budgets, fixed_debts, notifications del usuario; generar JSON (o ZIP con JSON/CSV) y descargar.
   - Mostrar mensaje de éxito y advertencia de que los datos son sensibles.
2. **Eliminar cuenta:**
   - Botón "Eliminar mi cuenta" en la misma sección, con confirmación (modal con texto claro y doble confirmación).
   - Flujo: llamar a Supabase Auth para eliminar usuario (o desactivar) según documentación de Supabase; opcionalmente ejecutar en backend (o con Edge Function) borrado/anonymización de filas en profiles, transactions, etc., para cumplir "derecho al olvido". Si no hay backend, documentar que el usuario debe solicitar eliminación y hacerlo manualmente o con un script one-off.
   - Tras eliminación: signOut y redirección a /login con mensaje.
3. Documentar en política de privacidad que el usuario puede exportar y eliminar su cuenta desde la app.

**Criterio de aceptación:** Usuario puede descargar sus datos y solicitar eliminación con flujo claro y documentado.

---

### 5.3 Revisión de errores de Supabase

**Orden:** Paralelo a 2.3 o después.

**Tareas:**
1. Revisar todos los archivos que usan `supabase.from(...)`:
   - Asegurar que en cada `.insert`, `.update`, `.delete` se compruebe `error` y se muestre feedback al usuario (toast o mensaje inline).
   - Evitar confiar solo en `data` para decidir éxito.
2. En listados (Dashboard, Transactions, Categories, etc.): si la petición falla, mostrar estado "Error al cargar" con opción de reintentar (botón que vuelve a llamar fetch).
3. Opcional: hook `useSupabaseQuery` que unifique loading, error y retry para no repetir lógica.

**Criterio de aceptación:** Ningún flujo crítico ignora errores de Supabase; el usuario siempre tiene feedback y opción de reintentar donde aplique.

---

## Fase 6: Escalabilidad y mantenibilidad (opcional / gradual)

**Objetivo:** Paginación en Movimientos, TypeScript gradual, documentación y calidad de código.

### 6.1 Paginación o filtrado por fechas (Movimientos)

**Orden:** Cuando el volumen de transacciones pueda ser alto.

**Tareas:**
1. En `Transactions.jsx`: en lugar de cargar todas las transacciones, cargar por rango de fechas (mes actual por defecto) usando `.gte('date', firstDay).lte('date', lastDay)` o paginación con `.range(from, to)`.
2. Mantener filtros (búsqueda, tipo) en cliente sobre los datos ya cargados, o mover filtros a query si se usa paginación server-side.
3. Añadir controles "Mes anterior / Siguiente" que cambien el rango y recarguen.

**Criterio de aceptación:** Con muchas transacciones, la página sigue siendo usable y no se cargan miles de filas de golpe.

---

### 6.2 TypeScript gradual

**Orden:** Cuando el equipo decida adoptar TS.

**Tareas:**
1. Renombrar `app/vite.config.js` → `vite.config.ts` y configurar para TS (si no está).
2. Añadir `tsconfig.json` con `allowJs: true` y `checkJs: false` inicialmente.
3. Migrar en este orden: `utils/formatters.js` → `.ts`; `lib/supabase.js` → `.ts` y tipos de respuesta; `constants/validation.js` y `lib/schemas.js`; luego componentes (TransactionModal, AuthContext, etc.).
4. Habilitar `checkJs: true` cuando no queden archivos JS críticos sin tipar.

**Criterio de aceptación:** Sin romper build ni tests; tipos en módulos críticos reducen errores en IDE.

---

### 6.3 Documentación y convenciones

**Orden:** Cualquier momento.

**Tareas:**
1. Crear `CONTRIBUTING.md`: cómo clonar, instalar, correr tests (`npm run test:run`, `npm run test:e2e`), lint, y hacer PR (convenciones de commits si las tienen).
2. Actualizar README: añadir sección "Testing" con los comandos y que las PR deben mantener tests verdes.
3. Opcional: documento interno de arquitectura (una página) con diagrama de flujo (login → Supabase, Realtime, notifier) y dónde viven validaciones, auth y estado.

**Criterio de aceptación:** Un desarrollador nuevo puede seguir CONTRIBUTING y ejecutar tests y lint sin preguntas.

---

## Resumen de dependencias entre fases

```
Fase 0 (Preparación) ──────────────────────────────────────────────────────────►
       │
       ├──► Fase 1 (Tests unitarios) ─────────────────────────────────────────►
       │            │
       │            └──► Fase 4 (Integración + E2E) depende de 1 y 0
       │
       ├──► Fase 2 (Validación + seguridad frontend) ──────────────────────────►
       │            │
       │            └──► Fase 3 (DB + backend) usa constantes de 2.1
       │
       └──► Fase 5 (Privacidad + estabilidad) puede hacerse en paralelo a 2–4
       └──► Fase 6 (Escalabilidad + mantenibilidad) cuando haya tiempo
```

---

## Checklist final (para marcar avance)

- [ ] Fase 0: Vitest, Playwright, setup, carpetas, opcional Prettier/Husky
- [ ] Fase 1.1: Tests formatters
- [ ] Fase 1.2: Tests AuthContext y ProtectedRoute
- [ ] Fase 1.3: Tests TransactionModal
- [ ] Fase 1.4: Tests SavingsGoal
- [ ] Fase 1.5: Tests Dashboard
- [ ] Fase 1.6: CI
- [ ] Fase 2.1: Constantes de validación
- [ ] Fase 2.2: Esquemas Zod y uso en formularios
- [ ] Fase 2.3: Toast / mensajes de error unificados
- [ ] Fase 2.4: Headers Vercel
- [ ] Fase 3.1: Constraints Supabase
- [ ] Fase 3.2: Revisión notifier y .env
- [ ] Fase 3.3: npm audit y opcional en CI
- [ ] Fase 4.1: MSW handlers
- [ ] Fase 4.2: Tests integración por flujo
- [ ] Fase 4.3: E2E Playwright + CI
- [ ] Fase 5.1: Privacidad y términos (páginas + enlaces)
- [ ] Fase 5.2: Exportar datos y eliminar cuenta
- [ ] Fase 5.3: Revisión errores Supabase
- [ ] Fase 6.1: Paginación Movimientos (opcional)
- [ ] Fase 6.2: TypeScript gradual (opcional)
- [ ] Fase 6.3: CONTRIBUTING y docs (opcional)

---

*Plan de implementación alineado con MEJORAS.md. Ajustar fechas y prioridades según capacidad del equipo.*
