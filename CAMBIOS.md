# Historial de mejoras — RootCash

Documento generado el 30/04/2026. Registra todos los cambios realizados en la sesión de desarrollo.

---

## 1. Color del ícono de editar en Gastos Fijos

**Archivos:** `app/src/pages/FixedDebts.jsx`, `app/src/pages/Categories.css`

**Qué:** El lápiz (✏️) para editar un gasto fijo era prácticamente invisible porque no tenía clase de color asignada. El mismo problema existía en la página de Categorías.

**Por qué:** El botón usaba solo `className="icon-btn"` sin la clase `edit`, por lo que heredaba el color de texto por defecto (muy tenue). La clase `.icon-btn.edit` en Categories.css usaba `var(--text-muted)`, que también es poco visible.

**Cambio:**
- Se agregó la clase `edit` al botón del lápiz en FixedDebts.jsx
- Se cambió el color de `.icon-btn.edit` de `var(--text-muted)` a `var(--accent)` (verde claro `#8fb87a`), coherente con la paleta de la app

---

## 2. Color del menú desplegable de categorías

**Archivo:** `app/src/index.css`

**Qué:** Al abrir cualquier `<select>` de categorías en la app, el menú desplegable nativo del navegador aparecía en blanco, rompiendo el tema oscuro.

**Por qué:** El navegador renderiza el dropdown nativo con estilos del sistema operativo y no hereda el `background` del elemento padre. Los `<option>` necesitan su propio color declarado explícitamente.

**Cambio:**
```css
option {
  background-color: #1d2419;
  color: var(--text-main);
}
```
Aplica globalmente a todos los `<select>` de la aplicación.

> Nota: Safari en iOS ignora el `background` de `<option>` por diseño del sistema. En ese caso el menú sigue viéndose con estilo nativo del sistema.

---

## 3. Picker de emojis para categorías

**Archivo:** `app/src/pages/Categories.jsx`

**Qué:** El campo "Emoji" en el formulario de categorías era un input de texto simple. No existía forma de seleccionar un emoji fácilmente, especialmente en desktop.

**Por qué:** La experiencia era confusa — el usuario no sabía que podía escribir un emoji ahí, y en desktop no hay un teclado de emojis accesible.

**Cambio:**
- Reemplazado el `<input type="text">` por un botón que muestra el emoji actual (o "+ emoji" si está vacío)
- Al hacer clic se abre un picker con ~80 emojis en 10 categorías: Comida, Transporte, Compras, Salud, Entret., Hogar, Tecnología, Educación, Mascotas, Varios
- El picker se cierra al hacer clic fuera (listener en `document`)
- Si ya hay un emoji, aparece el botón "✕ Quitar emoji"
- El emoji seleccionado queda visualmente resaltado en el grid

---

## 4. Navegación por meses en el Dashboard

**Archivo:** `app/src/pages/Dashboard.jsx`

**Qué:** El Dashboard solo mostraba el mes actual. Era imposible ver o registrar datos de meses pasados desde la pantalla principal.

**Por qué:** El usuario necesitaba rellenar gastos de meses anteriores (hasta 3 meses atrás) y ver cómo evolucionaron sus finanzas mes a mes, similar a como funciona "Screen Time" en iPhone.

**Cambios:**
- Agregados estados `selectedMonth` y `selectedYear` (por defecto: mes actual)
- Todas las transacciones se cargan una vez y se filtran en memoria según el mes seleccionado
- Botones `←` y `→` junto al subtítulo para navegar entre meses
- El botón `→` se deshabilita cuando se está en el mes actual (no permite ir al futuro)
- El subtítulo cambia según el contexto: "Resumen de este mes" o "Resumen de Febrero 2026"
- Las tarjetas de Gastos y Movimientos actualizan su título con el mes seleccionado
- Si un mes pasado no tiene transacciones, aparece un botón directo "Agregar transacción"

---

## 5. Resumen por categoría en el Dashboard

**Archivo:** `app/src/pages/Dashboard.jsx`

**Qué:** Nueva sección que muestra el desglose de gastos por categoría del mes seleccionado.

**Por qué:** El usuario quería ver "en marzo gasté $80.000 en Comida, $25.000 en Transporte..." directamente en la pantalla principal, sin tener que ir a Estadísticas.

**Cambio:**
- Sección que aparece automáticamente cuando hay gastos en el mes seleccionado
- Muestra cada categoría con: ícono, nombre, porcentaje y monto
- Barra de progreso visual coloreada con el color de cada categoría
- Los gastos sin categoría se agrupan al final
- Funciona para cualquier mes, no solo el actual

---

## 6. Meta de ahorro movida al final del Dashboard

**Archivo:** `app/src/pages/Dashboard.jsx`

**Qué:** El componente `SavingsGoal` (meta de ahorro) aparecía entre las tarjetas de resumen y los movimientos recientes.

**Por qué:** Los datos críticos (cuánto gasté, cuánto tengo) deben verse de inmediato. La meta de ahorro es contextual y tiene más sentido al final, después de ver el detalle del mes.

**Cambio:** `SavingsGoal` movido debajo de la lista de movimientos recientes.

---

## 7. Eliminación del mensaje "FinancialAdvice"

**Archivo:** `app/src/pages/Dashboard.jsx`

**Qué:** Se eliminó el componente que mostraba mensajes como "Excelente margen", "Vas por buen camino", "Alerta de sobregiro", etc.

**Por qué:** El usuario indicó que el mensaje no aportaba valor y generaba ruido visual innecesario.

**Cambio:** Componente eliminado completamente (definición, uso e import de `Lightbulb`).

---

## 8. Modal inteligente con fecha pre-rellenada

**Archivo:** `app/src/components/TransactionModal.jsx`

**Qué:** Al abrir el modal "Nuevo movimiento" desde un mes pasado en el Dashboard, la fecha se pre-rellena al día 1 de ese mes en vez de mostrar la fecha de hoy.

**Por qué:** Si el usuario está viendo "Febrero 2026" y presiona "+", quiere agregar un gasto de febrero. El flujo anterior obligaba a recordar cambiar la fecha manualmente.

**Cambio:**
- El Dashboard calcula `defaultDate`: si es mes actual → hoy; si es mes pasado → primer día de ese mes
- El modal acepta `defaultDate` como prop y lo usa al abrirse
- El formulario se resetea completamente en cada apertura

---

## 9. Autocomplete desde gastos fijos en el modal

**Archivo:** `app/src/components/TransactionModal.jsx`

**Qué:** Al seleccionar una categoría que tiene un gasto fijo asociado, el formulario auto-rellena la descripción y el monto automáticamente.

**Por qué:** Gastos recurrentes (arriendo, luz, internet) siempre tienen la misma descripción y monto. Con el autocomplete el usuario solo elige la categoría y presiona guardar.

**Cambios:**
- Al abrir el modal se cargan en paralelo `categories` y `fixed_debts`
- La **Categoría** se movió al inicio del formulario para que el autocomplete sea inmediato
- Flujo: categoría → (auto-rellena descripción y monto) → revisar → guardar
- Aparece un indicador "✓ Autocompletado desde gasto fijo" en verde

---

## 10. Formato de fechas dd/mm/aaaa

**Archivos:** `app/src/components/TransactionModal.jsx`, `app/src/pages/Profile.jsx`

**Qué:** Los inputs de fecha usaban `<input type="date">`, cuyo formato depende del sistema operativo y frecuentemente muestra `mm/dd/aaaa` o `aaaa-mm-dd`.

**Por qué:** El formato `dd/mm/aaaa` es el estándar en Chile. El comportamiento del input nativo no es controlable.

**Cambio:**
- Reemplazado por `<input type="text" inputMode="numeric">`
- Al tipear se insertan automáticamente las barras: `15022026` → `15/02/2026`
- Internamente se convierte a ISO (`YYYY-MM-DD`) para guardar en Supabase
- En **Profile.jsx**: las fechas de trabajo se cargan en `dd/mm/aaaa` y se guardan de vuelta en ISO

---

## 11. Vista comparativa mensual estilo iPhone Screen Time

**Archivos:** `app/src/pages/Stats.jsx`, `app/src/pages/Stats.css`

**Qué:** Nueva sección en Estadísticas que muestra los últimos 4 meses como tarjetas seleccionables con desglose por categoría al hacer clic.

**Por qué:** El usuario quería poder comparar cuánto gastó en meses distintos de un vistazo, igual a como funciona "Tiempo en pantalla" en iPhone: ves los meses uno al lado del otro y al tocar uno se expande el detalle.

**Cómo funciona:**
- Grilla de 4 tarjetas (una por mes), de más antiguo a más reciente
- Cada tarjeta: nombre del mes, total gastado, barra proporcional, delta `↑/↓ X% vs anterior`
- El mes actual tiene una etiqueta "actual" en verde
- Al hacer clic en una tarjeta se expande el desglose por categoría con barras coloreadas y porcentajes
- Por defecto el mes actual aparece expandido al cargar
- En mobile se colapsa a 2 columnas

---

## 12. Cambio de favicon: icon.svg → logo.svg

**Archivos:** `app/index.html`, `app/vite.config.js`

**Qué:** El ícono que aparece en la pestaña del navegador (y como ícono PWA al instalar) ahora usa `logo.svg` en vez de `icon.svg`.

**Por qué:** El usuario prefiere el logo con el símbolo `$` para la pestaña del navegador.

**Cambios:**
- `app/index.html`: `<link rel="icon">` y `<link rel="apple-touch-icon">` apuntan a `/logo.svg`
- `app/vite.config.js`: el manifest PWA (`icons[].src`) apunta a `logo.svg`

---

## 13. Selector de meses en la Comparativa de Estadísticas

**Archivos:** `app/src/pages/Stats.jsx`, `app/src/pages/Stats.css`

**Qué:** La sección "Comparativa" de Estadísticas tenía los 4 meses hardcodeados. Ahora el usuario puede elegir cuántos meses quiere ver: **2, 3, 4, 6 o 12 meses**.

**Por qué:** Cada persona tiene una preferencia distinta — quien quiere una vista rápida prefiere 2-3 meses, quien quiere una visión anual prefiere 12.

**Cómo funciona:**
- Botones `2m / 3m / 4m / 6m / 12m` junto al título de la sección
- El estado `compareMonths` (default: 4) controla cuántos meses se muestran
- Al cambiar, se re-consulta Supabase con el rango correcto de fechas (siempre trae al menos 6 meses para no romper el gráfico de barras)
- El grid de tarjetas se adapta dinámicamente: 2→2 cols, 3→3 cols, 4→4 cols, 6→3 cols (2 filas), 12→4 cols (3 filas)
- El título cambia: "Comparativa — últimos N meses"
- El gráfico de barras "Ingresos vs Gastos" siempre mantiene 6 meses (no se ve afectado)

**Sin cambios en base de datos** — es lógica puramente frontend.

---

## 14. Agregar movimientos desde el Historial de Movimientos

**Archivo:** `app/src/pages/Transactions.jsx`

**Qué:** La página de Historial de Movimientos no tenía forma de agregar transacciones. Ahora tiene un botón **"+ Nuevo"** en el header y un botón **"Agregar movimiento"** en el estado vacío.

**Por qué:** El usuario quería poder añadir movimientos tanto al mes actual como a meses pasados directamente desde esta vista, sin tener que ir al Dashboard.

**Cambios:**
- Importado `TransactionModal` y el ícono `Plus`
- Botón **"+ Nuevo"** (verde) en el header, junto al botón de exportar CSV
- Cuando el mes no tiene movimientos y no hay filtros activos, aparece un botón "Agregar movimiento" en el estado vacío
- La `defaultDate` se calcula igual que en el Dashboard: si es el mes actual → fecha de hoy; si es un mes pasado → primer día de ese mes
- Al guardar, la lista se recarga automáticamente (`fetchData()`)

---

## Resumen de archivos modificados

| Archivo | Cambios |
|---|---|
| `app/src/pages/FixedDebts.jsx` | Clase `edit` en botón lápiz |
| `app/src/pages/Categories.css` | Color `.icon-btn.edit` → `var(--accent)` |
| `app/src/index.css` | Estilos para `option` (dropdown oscuro) |
| `app/src/pages/Categories.jsx` | Picker de emojis reemplaza input de texto |
| `app/src/pages/Dashboard.jsx` | Navegación por meses, resumen por categoría, mover SavingsGoal, eliminar FinancialAdvice, fecha pre-rellenada en modal |
| `app/src/components/TransactionModal.jsx` | defaultDate, autocomplete desde gastos fijos, fecha dd/mm/aaaa, categoría al inicio |
| `app/src/pages/Profile.jsx` | Fechas de trabajo en dd/mm/aaaa |
| `app/src/pages/Stats.jsx` | Comparativa mensual + selector de meses dinámico |
| `app/src/pages/Stats.css` | Estilos comparativa mensual + selector de meses |
| `app/index.html` | Favicon → `logo.svg` |
| `app/vite.config.js` | Manifest PWA icon → `logo.svg` |
| `app/src/pages/Transactions.jsx` | Botón "+ Nuevo" y modal para agregar movimientos |
