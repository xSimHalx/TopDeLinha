// --- CONFIGURAÇÃO DE MOEDA ---
// Esta função depende do objeto global `currency` carregado via CDN.
const BRLConfig = { separator: '.', decimal: ',', symbol: 'R$ ', errorOnInvalid: false, precision: 2 };

// --- FUNÇÕES PURAS (SEM DEPENDÊNCIAS EXTERNAS) ---

/**
 * Formata um valor numérico para a moeda brasileira (BRL).
 * @param {number|string} value - O valor a ser formatado.
 * @returns {string} - A string formatada, ex: "R$ 1.234,56".
 */
export const formatCurrency = (value) => {
    return currency(value, BRLConfig).format();
};

/**
 * Converte uma string de moeda (ou número) para um valor numérico.
 * @param {number|string} value - O valor a ser convertido.
 * @returns {number} - O valor como um float, ex: 1234.56.
 */
export const parseCurrency = (value) => {
    // Se for string, aplica a lógica de compatibilidade
    if (typeof value === 'string') {
        // Remove 'R$ ' e espaços extras para um parse mais robusto
        let cleanedValue = value.replace(/R\$\s?/, '').trim();

        const hasComma = cleanedValue.includes(',');
        const hasDot = cleanedValue.includes('.');

        // Heurística para compatibilidade: se o usuário digitar '99.90' em vez de '99,90'
        // Se não houver vírgula e houver exatamente um ponto, e a parte final tiver 1 ou 2 dígitos,
        // é provável que o ponto seja um decimal.
        if (!hasComma && hasDot) {
            const parts = cleanedValue.split('.');
            if (parts.length === 2) {
                const lastPart = parts[parts.length - 1];
                if (lastPart.length === 1 || lastPart.length === 2) {
                    // Substitui o ponto por vírgula para o parse correto com a config BRL
                    cleanedValue = cleanedValue.replace('.', ',');
                }
            }
        }
        return currency(cleanedValue, BRLConfig).value;
    }

    // Se for número ou outro tipo, deixa o currency.js lidar com isso
    return currency(value, BRLConfig).value;
};

/**
 * Calcula o valor total de um carrinho de compras.
 * @param {Array} cart - O array de itens do carrinho.
 * @returns {object} - Um objeto currency com o total.
 */
export function calculateCartTotal(cart) {
    if (!Array.isArray(cart)) return currency(0, BRLConfig);

    return cart.reduce((sum, item) => {
        const itemPrice = item.price || 0;
        const itemQuantity = item.quantity || 0;
        const itemTotal = currency(itemPrice, BRLConfig).multiply(itemQuantity);
        return sum.add(itemTotal);
    }, currency(0, BRLConfig));
}

/**
 * Analisa um código de barras para verificar se é do tipo balança com valor fechado.
 * @param {string} scannedCode - O código lido.
 * @returns {object|null} - Objeto com os dados se for balança, ou null caso contrário.
 */
export const parseScaleBarcode = (scannedCode) => {
    // Verifica se começa com '2' e tem o tamanho esperado (13 dígitos para EAN-13)
    if (scannedCode.startsWith('2') && scannedCode.length === 13) {
        // Padrão EAN-13 Balança: [2][XXXXXX][VVVVV][C]
        // Onde VVVVV é o valor total em centavos (5 dígitos)
        const valuePart = scannedCode.substring(7, 12);
        const value = parseFloat(valuePart) / 100;

        return {
            tipo: "BALANCA_VALOR",
            valor: value,
            codigoBalanca: scannedCode
        };
    }
    return null;
};