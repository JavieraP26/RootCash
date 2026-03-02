# RootCash — Plan de mejoras, testeo y seguridad

Documento de revisión fullstack: plan de tests, seguridad, privacidad y mejoras para estabilidad, escalabilidad y mantenibilidad. **No se ha modificado ningún archivo del proyecto**; este documento solo propone acciones.

---

## 1. Plan de testeo

### 1.1 Estado actual
- **No hay tests** en el repositorio (ni unit, ni integration, ni e2e).
- No existe script `test` ni `coverage` en `app/package.json`.
- La aplicación funciona bien en producción (Vercel + Supabase) pero cualquier cambio puede romper flujos sin detección automática.

### 1.2 Objetivos del plan
- Detectar regresiones antes de desplegar.
- Dar confianza al refactor y a nuevas features.
- Documentar el comportamiento esperado de los módulos críticos.
- Facilitar onboarding de nuevos desarrolladores.

### 1.3 Estrategia recomendada

| Nivel        | Herramienta sugerida     | Alcance                                                                 |
|-------------|--------------------------|-------------------------------------------------------------------------|
| Unit        | **Vitest** + React Testing Library | Utilidades (`formatters.js`), hooks/context (AuthContext), componentes presentacionales. |
| Integration | Vitest + MSW (Mock Service Worker) | Flujos que llaman a Supabase: login, CRUD categorías, transacciones, perfil. Simular respuestas de Supabase sin tocar la DB real. |
| E2E         | **Playwright** (o Cypress)          | Flujo completo: login con Google (stub), crear movimiento, ver dashboard, exportar CSV. |
| Visual / regresión | Opcional: Chromatic o Percy | Capturas de pantalla en builds para detectar cambios de UI no deseados. |

### 1.4 Tests unitarios a implementar

**Prioridad alta**
- **`utils/formatters.js`**
  - `formatCLP`: ceros, negativos, decimales, números grandes.
  - `formatDate`: distintos formatos de fecha, fechas inválidas.
  - `parseAmount`: formato chileno ("1.200.000"), comas, valores inválidos, vacíos.
- **AuthContext**
  - Estado inicial (loading, user null).
  - Tras `getSession` con sesión: user poblado.
  - Tras `signOut`: user null.
  - `signInWithGoogle` redirige (mock de `supabase.auth.signInWithOAuth`).
- **ProtectedRoute**
  - Sin user → redirige a `/login`.
  - Con user → renderiza children.

**Prioridad media**
- **TransactionModal**
  - Validación de monto: rechaza NaN, ≤ 0; acepta formato chileno.
  - Submit con datos válidos llama a `supabase.from('transactions').insert` con payload esperado.
  - Cierre del modal al hacer submit exitoso y callback `onSuccess`.
- **SavingsGoal**
  - Cálculo de progreso (periodSavings, goalAmountNum, progress %).
  - Guardado de meta: payload correcto a `profiles.update`.
- **Dashboard**
  - Cálculo de totalIncome, totalExpenses, currentBalance con datos mock.
  - Racha (streak) de meses en positivo con datos mock por mes.

### 1.5 Tests de integración (con Supabase mockeado)

- **Login**
  - Flujo: click "Iniciar con Google" → se llama `signInWithOAuth` con provider `google` y `redirectTo` correcto.
- **CRUD categorías**
  - Crear categoría: insert con `user_id` del usuario actual.
  - Editar y eliminar: update/delete con mismo user.
- **Transacciones**
  - Crear movimiento: insert con user_id, amount, type, date, description, category_id.
  - Listado filtra por user y orden por fecha.
- **Perfil**
  - Actualización de display_name, avatar, monthly_income: update en `profiles` con `eq('id', user.id)`.
- **Notificaciones**
  - Realtime: suscripción al canal con filtro `user_id=eq.${user.id}`; al recibir INSERT, estado se actualiza.

### 1.6 Tests E2E (Playwright)

- **Happy path**
  1. Ir a `/login` → ver botón de Google.
  2. Login (stub de OAuth o cuenta de prueba).
  3. Redirección a `/` (Dashboard).
  4. Ver al menos una tarjeta de resumen (sueldo/gastos/saldo).
  5. Abrir modal "Nuevo movimiento", rellenar y guardar.
  6. Ver el movimiento en la lista o en el resumen.
- **Rutas protegidas**
  - Sin sesión: `/`, `/movimientos`, etc. redirigen a `/login`.
- **Export CSV**
  - En Movimientos, click exportar → se descarga un CSV con el nombre esperado y columnas correctas.

### 1.7 Configuración sugerida (solo referencia, no aplicada)

- Añadir en `app/package.json`: `"test": "vitest"`, `"test:ui": "vitest --ui"`, `"test:coverage": "vitest run --coverage"`.
- Dependencias: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `msw` (para integration), `@playwright/test` (dev).
- Archivo `app/vitest.config.js` con environment `jsdom` y setup que importe `@testing-library/jest-dom`.
- Carpetas: `app/src/utils/__tests__/`, `app/src/contexts/__tests__/`, `app/src/components/__tests__/`, `app/src/pages/__tests__/`, y opcionalmente `e2e/` en raíz o en `app/`.

### 1.8 Cobertura objetivo (referencia)

- **Fase 1:** Utilidades y AuthContext > 80%.
- **Fase 2:** Componentes críticos (TransactionModal, Dashboard, SavingsGoal) y flujos de integración con Supabase mockeado.
- **Fase 3:** E2E de flujo principal y rutas protegidas; opcional visual regression.

---

## 2. Seguridad

### 2.1 Lo que está bien
- **Secrets:** Variables sensibles en `.env` / `.env.local`; `.gitignore` excluye `.env`, `.env.local`, `.env.production`. No hay claves hardcodeadas en el repo.
- **RLS en Supabase:** Todas las tablas relevantes tienen RLS habilitado y políticas por `auth.uid() = user_id` (o `id` en profiles). El cliente usa solo la anon key; la autorización la hace la base.
- **Auth:** Login con Google OAuth; Supabase gestiona sesión y JWT. No hay contraseñas en texto plano ni lógica de auth propia.
- **Backend notifier:** Usa `SUPABASE_SERVICE_ROLE_KEY` solo en el script Python, que no está expuesto como API pública; el script se ejecuta en cron/tarea programada.
- **Export CSV:** Se escapan comillas en descripción (`replace(/"/g, '""')`) para evitar ruptura de columnas e inyección en CSV.

### 2.2 Mejoras recomendadas

#### 2.2.1 Validación y sanitización de entradas
- **Problema:** La validación es básica (montos con `parseAmount` + `isNaN`/`< 0`). No hay límites de longitud ni sanitización explícita para texto (descripción, nombre de categoría, display_name, etc.).
- **Acciones:**
  - Definir límites en frontend y en DB: longitud máxima para `description`, `name` (categoría), `display_name`, `job_title`, `savings_goal_title`, etc. (ej. 200–500 caracteres según campo).
  - En frontend: validar longitud y caracteres permitidos antes de enviar a Supabase; mostrar mensajes claros al usuario.
  - En Supabase: añadir `CHECK` o triggers que rechacen valores fuera de rango (ej. `description` length, `amount` positivo, `type` in ('expense','income')). Parte de esto ya existe (ej. `type` check en `transactions`).
  - Considerar una capa de validación con esquemas (Zod/Yup) en el cliente para formularios (TransactionModal, Profile, Categories, SavingsGoal, etc.) y reutilizar reglas.

#### 2.2.2 XSS y contenido generado por usuario
- **Problema:** Contenido como `t.description`, `category.name`, `note.message` se renderiza en React (por defecto escapado). Si en el futuro se usara `dangerouslySetInnerHTML` o se inyectara HTML en mensajes (ej. notificaciones generadas por backend), podría haber riesgo.
- **Acciones:**
  - Evitar `dangerouslySetInnerHTML` para cualquier dato de usuario o de notificaciones.
  - En el notifier: no incluir HTML en `message`; mantener mensajes en texto plano. Si más adelante se permiten notificaciones con formato, usar un subconjunto seguro (ej. Markdown renderizado con una lib segura).
  - Revisar que ningún campo guardado en DB se pinte como HTML sin sanitización (hoy no parece el caso).

#### 2.2.3 Cliente Supabase y variables de entorno
- **Problema:** Si `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` faltan, se crea el cliente con string vacío y solo un `console.warn`. En producción podría fallar de forma poco clara.
- **Acciones:**
  - En desarrollo: lanzar un error claro o mostrar un aviso visible si faltan las variables, para no desplegar por error sin config.
  - La anon key es pública por diseño; asegurar en Supabase que las políticas RLS sean estrictas y que no existan tablas sensibles sin RLS. Revisar periódicamente las políticas (incl. `profiles` y `notifications`).

#### 2.2.4 Notificaciones (tabla y Realtime)
- **Estado:** La tabla `notifications` tiene SELECT y UPDATE por `auth.uid() = user_id`. No hay política INSERT para el cliente; solo el backend (service role) inserta. Correcto.
- **Acciones:**
  - Mantener así: el cliente nunca debe insertar notificaciones; solo leer y marcar como leídas.
  - En Realtime, el filtro `user_id=eq.${user.id}` está bien; asegurar en el dashboard de Supabase que Realtime esté habilitado solo para las tablas necesarias y con políticas adecuadas.

#### 2.2.5 Backend notifier.py
- **Problema:** Uso de `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS) y envío de emails con credenciales en env. Si el script se comprometiera o se ejecutara en un entorno inseguro, podría haber fuga de datos.
- **Acciones:**
  - Mantener el script en un entorno controlado (cron en servidor seguro o job en plataforma confiable). No exponer el script como endpoint HTTP.
  - No commitear `backend/.env`; asegurar que `backend/.env` esté en `.gitignore` (revisar que esté incluido si el backend está en el mismo repo).
  - Para email: preferir un servicio con API key (SendGrid, Resend, etc.) en lugar de guardar contraseña de Gmail en env, y rotar credenciales periódicamente.
  - Validar que `user_email` y campos usados en el mensaje no contengan caracteres que puedan afectar a Slack/email (ej. escapes mínimos si se concatenan en formatos estructurados).

#### 2.2.6 Headers y despliegue (Vercel)
- **Problema:** No hay configuración explícita de headers de seguridad en el repo (CSP, X-Frame-Options, etc.). Vercel y Supabase aplican sus propios headers, pero la SPA puede beneficiarse de una política explícita.
- **Acciones:**
  - En `vercel.json` (cuando se decida aplicar cambios), añadir headers como:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY` (o SAMEORIGIN si se necesita embed)
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - Content-Security-Policy básica: permitir solo orígenes necesarios (Supabase, Google OAuth, dominio de la app). Ajustar según recursos (fonts, scripts, connect).
  - No bloquear Supabase ni los dominios de auth de Google; probar login y Realtime después de aplicar CSP.

#### 2.2.7 Dependencias
- **Acciones:**
  - Ejecutar `npm audit` en `app/` y en raíz de forma periódica; corregir vulnerabilidades críticas/altas.
  - Revisar dependencias obsoletas (`npm outdated`) y actualizar con criterio (probando tests y build).
  - Fijar versiones en `package.json` de forma consciente (evitar rangos muy amplios en producción si se busca repetibilidad).

---

## 3. Privacidad

### 3.1 Datos que se tratan
- **Auth:** Email y datos básicos de Google (manejados por Supabase Auth).
- **Perfil:** display_name, avatar, edad, género, cargo, fechas de trabajo, sueldo, metas de ahorro.
- **Financieros:** transacciones, categorías, presupuestos, deudas fijas.
- **Notificaciones:** mensajes de recordatorio generados por el backend.

### 3.2 Mejoras recomendadas
- **Política de privacidad y términos:** Tener una página o enlace a política de privacidad y términos de uso (almacenamiento, uso de Google OAuth, datos en Supabase, no compartir con terceros salvo lo necesario para el servicio). Especialmente importante si la app es pública o se monetiza.
- **Retención y eliminación:** Definir cuánto tiempo se conservan transacciones y notificaciones; ofrecer en Perfil la opción de “Exportar mis datos” y “Eliminar mi cuenta” (Supabase Auth + borrado/anonimizado en `profiles`, `transactions`, etc.). Implementar el flujo en la app y, si aplica, en el backend (notifier no debería seguir enviando a un usuario eliminado).
- **Minimización:** No pedir datos que no se usen (ej. género y edad son opcionales; mantenerlos opcionales y no compartirlos con terceros).
- **Supabase:** Revisar en el dashboard la ubicación de la región de datos y cumplimiento (GDPR si hay usuarios en UE). Supabase permite elegir región al crear el proyecto.

---

## 4. Estabilidad, escalabilidad y mantenibilidad

### 4.1 Estabilidad
- **Manejo de errores:** Varios `catch` solo hacen `console.error` y `alert`. Unificar estrategia: por ejemplo, un pequeño toast o componente de error global, y en flujos críticos (login, guardar transacción) mostrar mensajes claros y opcionalmente reintento.
- **Estados de carga:** Hay `loading` en varias vistas; asegurar que no se disparen dobles fetches (ej. `useEffect` con dependencias correctas, o evitar llamadas si ya hay carga). Revisar especialmente Dashboard y listados.
- **Supabase:** Comprobar siempre `error` en las respuestas y no confiar solo en `data`. En algunos sitios ya se hace; extender a todos los `.insert`, `.update`, `.delete`, `.select` que afecten datos críticos.
- **Realtime:** El canal de notificaciones se suscribe en `useEffect` y se desuscribe en el cleanup; está bien. Evitar suscribir múltiples canales iguales para el mismo usuario (dependencias del `useEffect` correctas).

### 4.2 Escalabilidad
- **Listados:** En Movimientos se cargan “todos” los movimientos y se filtra en cliente. Para muchos registros (miles), conviene paginación o filtrado por rango de fechas en el servidor (Supabase `.range()` o filtros `date >= X and date <= Y`) y cargar por páginas o meses.
- **Caché/estado:** Si se añaden más pantallas o más datos, considerar un estado global ligero (Context por dominio o Zustand) para evitar refetches innecesarios; hoy AuthContext es el único contexto global y está bien para el tamaño actual.
- **Backend notifier:** Si el número de usuarios crece mucho, el script que recorre todas las deudas y envía emails uno a uno puede ser lento. Considerar colas (workers) o procesamiento por lotes y límites de envío (rate limit) para email/Slack.

### 4.3 Mantenibilidad
- **Estructura:** La separación por `pages/`, `components/`, `contexts/`, `lib/`, `utils/` es clara. Se puede afinar con carpetas por feature (ej. `features/transactions/`, `features/categories/`) si el equipo crece o las features se complejizan.
- **Tipado:** El proyecto es JavaScript. Introducir TypeScript de forma gradual (empezando por `utils`, `lib/supabase`, tipos de modelos de DB) mejorará autocompletado y detección de errores.
- **Constantes y configuración:** Centralizar constantes (ej. límites de longitud, opciones de período de meta, colores por defecto) en un archivo `constants.js` o por módulo, para no repetir “magic numbers” o strings.
- **Documentación:** README ya describe stack, instalación y deploy. Añadir un CONTRIBUTING.md con cómo correr tests, lint y convenciones de commits ayuda a que el proyecto sea mantenible a largo plazo.
- **Linting y formato:** Ya hay ESLint; considerar Prettier y pre-commit hooks (husky + lint-staged) para formato consistente y que los tests/lint corran antes de push.

### 4.4 Mejoras de producto/código (sin cambiar archivos)
- **Accesibilidad:** Revisar contraste, focus visible en botones y enlaces, y labels en formularios; añadir `aria-label` donde falte (ej. botones solo con icono).
- **i18n:** Si se planea más de un idioma, preparar textos en un objeto o usar una librería de i18n para no tener strings repartidos por JSX.
- **PWA / offline:** Valorar service worker y manifest para uso offline básico o caché de assets (Vite tiene plugins para PWA).
- **Schema de DB documentado:** Mantener un único documento o script que refleje el estado actual de tablas y políticas (los `schema_*.sql` actuales son buena base; se puede generar algo desde Supabase o mantener un README de DB).

---

## 5. Resumen de acciones prioritarias

| Prioridad | Área        | Acción resumida |
|----------|-------------|------------------|
| Alta     | Tests       | Introducir Vitest + RTL; tests unitarios para formatters, AuthContext y ProtectedRoute; después TransactionModal y cálculos del Dashboard. |
| Alta     | Seguridad   | Validación/sanitización de inputs (longitud, tipos); esquemas Zod/Yup en formularios; revisar que backend/.env no se suba. |
| Alta     | Privacidad  | Añadir política de privacidad y opción de exportar/eliminar cuenta. |
| Media    | Tests       | Integración con MSW para flujos Supabase; E2E con Playwright del flujo principal. |
| Media    | Seguridad   | Headers en Vercel (CSP, X-Frame-Options, etc.); `npm audit` y actualización de dependencias. |
| Media    | Estabilidad | Manejo de errores unificado; comprobar `error` en todas las llamadas a Supabase; paginación en Movimientos. |
| Baja     | Mantenibilidad | TypeScript gradual; constantes centralizadas; Prettier + husky; documentación de contribución. |

---

*Documento generado a partir de una revisión del repositorio RootCash. No se ha modificado ningún archivo del proyecto; todas las acciones son propuestas.*
