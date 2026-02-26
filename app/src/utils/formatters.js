/**
 * Formatea un número a Pesos Chilenos (CLP)
 * Ejemplo: 1500000 -> "$ 1.500.000"
 */
export const formatCLP = (amount) => {
    if (amount === undefined || amount === null) return '$ 0';

    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount).replace('CLP', '$');
};

/**
 * Normaliza un monto ingresado por el usuario (formato chileno o plano)
 * Acepta: "44.000", "44000", "1.500.000"
 * Retorna: 44000, 44000, 1500000 (número)
 */
export const parseAmount = (value) => {
    // Elimina puntos (separadores de miles en CLP) y reemplaza comas por punto decimal
    const cleaned = String(value).replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(cleaned);
};

/**
 * Formatea una fecha ISO (yyyy-mm-dd) a formato chileno dd/mm/yyyy
 * Ejemplo: '2026-02-26' -> '26/02/2026'
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};
