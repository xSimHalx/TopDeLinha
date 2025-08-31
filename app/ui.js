
import { users, products, customers, cart, closedDays, currentDay, currentShift, saleInProgress, selectedPaymentMethod, setSaleInProgress, setSelectedPaymentMethod, setCart, setCurrentShift, setCurrentDay, setClosedDays } from './state.js';
import { addProduct, updateProductStock } from './database.js';

// --- ELEMENTOS DO DOM ---
const contentDashboard = document.getElementById('content-dashboard');
const contentCashRegister = document.getElementById('content-cash-register');
const contentPdv = document.getElementById('content-pdv');
const contentInventory = document.getElementById('content-inventory');
const contentCustomers = document.getElementById('content-customers');
const contentReports = document.getElementById('content-reports');
const tabPdv = document.getElementById('tab-pdv');
const paymentModal = document.getElementById('payment-modal');
const confirmSaleButton = document.getElementById('confirm-sale-button');
const scannerModal = document.getElementById('scanner-modal');
const editCustomerModal = document.getElementById('edit-customer-modal');
const debtPaymentModal = document.getElementById('debt-payment-modal');

// --- FUNÇÕES DE RENDERIZAÇÃO E UTILIDADES ---
const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDateTime = (date) => date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function showModal(title, message, warningMessage = '') {
    const modal = document.getElementById('success-modal');
    modal.querySelector('#modal-title').textContent = title;
    modal.querySelector('#modal-message').textContent = message;
    
    const warningArea = modal.querySelector('#modal-warning-area');
    const warningMessageEl = modal.querySelector('#modal-warning-message');

    if (warningMessage) {
        warningMessageEl.textContent = warningMessage;
        warningArea.classList.remove('hidden');
    } else {
        warningArea.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

window.closeModal = function() {
    document.getElementById('success-modal').classList.add('hidden');
}

// --- LÓGICA DAS ABAS ---
export function changeTab(tabName) {
    if (tabName === 'pdv' && !currentShift) {
        showModal('Nenhum Turno Aberto', 'Você precisa abrir um turno antes de acessar o PDV.');
        return;
    }
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if (tabName === 'dashboard') renderDashboardTab();
    if (tabName === 'reports') renderReportsTab();
    if (tabName === 'customers') renderCustomersTab();
}

// --- RENDERIZAÇÃO ESPECÍFICA DE CADA ABA ---
export function renderDashboardTab() {
    const totalSalesToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).reduce((sum, sale) => sum + sale.total, 0) : 0;
    const salesCountToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).length : 0;
    const lowStockItems = products.filter(p => p.stock <= 2);
    const totalDebt = customers.reduce((sum, c) => sum + c.debt, 0);

    contentDashboard.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-green-50 p-6 rounded-lg border border-green-200">
                <h4 class="text-sm font-semibold text-green-800">Vendas do Dia</h4>
                <p class="text-3xl font-bold text-green-600 mt-2">${formatCurrency(totalSalesToday)}</p>
                <p class="text-xs text-green-700">${salesCountToday} vendas realizadas</p>
            </div>
            <div class="bg-orange-50 p-6 rounded-lg border border-orange-200">
                <h4 class="text-sm font-semibold text-orange-800">Total a Receber (Fiado)</h4>
                <p class="text-3xl font-bold text-orange-600 mt-2">${formatCurrency(totalDebt)}</p>
                <p class="text-xs text-orange-700">${customers.filter(c => c.debt > 0).length} clientes com dívidas</p>
            </div>
            <div class="bg-red-50 p-6 rounded-lg border border-red-200 col-span-1 md:col-span-2">
                <h4 class="text-sm font-semibold text-red-800">Itens com Estoque Baixo (≤ 2 unidades)</h4>
                ${lowStockItems.length > 0 ? `
                    <ul class="mt-2 space-y-1 text-sm">
                        ${lowStockItems.map(p => `<li class="flex justify-between"><span>${p.name}</span> <span class="font-bold text-red-600">${p.stock} un.</span></li>`).join('')}
                    </ul>
                ` : '<p class="mt-4 text-center text-gray-500">Nenhum item com estoque baixo.</p>'}
            </div>
        </div>
    `;
}

export function renderCashRegisterTab() {
    const userOptions = users.map(user => `<option value="${user}">${user}</option>`).join('');
    let html = '';

    if (!currentDay) {
        html = `
        <div class="text-center py-12">
             <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-red-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
            <h2 class="mt-4 text-2xl font-bold text-gray-800">Caixa Fechado</h2>
            <form id="open-day-form" class="mt-6 max-w-sm mx-auto space-y-4">
                <div>
                    <label for="initial-cash" class="block text-sm font-medium text-gray-700">Valor Inicial (Fundo de Troco do Dia)</label>
                    <input type="number" id="initial-cash" placeholder="Ex: 100.00" step="0.01" min="0" required class="mt-1 block w-full p-2 border rounded-md shadow-sm">
                </div>
                <div>
                    <label for="opening-user" class="block text-sm font-medium text-gray-700">Operador do 1º Turno</label>
                    <select id="opening-user" required class="mt-1 block w-full p-2 border rounded-md shadow-sm">${userOptions}</select>
                </div>
                <button type="submit" class="w-full bg-green-600 text-white font-bold py-3 px-8 rounded-lg">Abrir Caixa (Iniciar Dia)</button>
            </form>
        </div>`;
    } else if (currentDay && currentShift) {
         html = `
        <div class="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-green-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5v4"></path></svg>
            <h2 class="mt-4 text-2xl font-bold text-gray-800">Turno Ativo</h2>
            <div class="mt-4 text-gray-600 space-y-2">
                <p>Início do Turno: <span id="session-start-time" class="font-semibold"></span></p>
                <p>Operador do Turno: <span id="session-opened-by" class="font-semibold"></span></p>
            </div>
            <div class="mt-8 max-w-sm mx-auto">
                 <label for="closing-user" class="block text-sm font-medium text-gray-700">Operador de Fechamento</label>
                 <select id="closing-user" required class="mt-1 block w-full p-2 border rounded-md shadow-sm">${userOptions}</select>
                 <button id="close-shift-button" class="mt-4 w-full bg-yellow-500 text-white font-bold py-3 px-8 rounded-lg">Fechar Turno</button>
            </div>
        </div>`;
    } else {
        html = `
        <div class="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-blue-500"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 6v6l4 2"></path></svg>
            <h2 class="mt-4 text-2xl font-bold text-gray-800">Dia em Operação (Aguardando Turno)</h2>
            <div class="mt-6 max-w-sm mx-auto space-y-4">
                <form id="open-shift-form" class="space-y-4 p-4 border rounded-lg">
                     <h3 class="font-semibold">Iniciar Próximo Turno</h3>
                     <div>
                        <label for="next-opening-user" class="block text-sm font-medium text-gray-700">Operador</label>
                        <select id="next-opening-user" required class="mt-1 block w-full p-2 border rounded-md shadow-sm">${userOptions}</select>
                     </div>
                     <button type="submit" class="w-full bg-green-600 text-white font-bold py-3 px-8 rounded-lg">Abrir Novo Turno</button>
                </form>
                <button id="close-day-button" class="w-full bg-red-600 text-white font-bold py-3 px-8 rounded-lg">Fechar Dia e Gerar Relatório Final</button>
            </div>
        </div>`;
    }
    contentCashRegister.innerHTML = html;
}

export function renderPdvTab() {
    contentPdv.innerHTML = `
         <div id="pdv-idle-screen" class="text-center py-20">
            <h2 class="mt-4 text-2xl font-bold text-gray-700">Caixa Livre</h2>
            <button id="start-sale-button" class="mt-6 bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg">Iniciar Nova Venda</button>
        </div>
        <div id="pdv-active-sale" class="grid grid-cols-1 lg:grid-cols-2 gap-8 hidden">
            <div>
                <div class="mb-6">
                    <label for="barcode-input-field" class="block text-sm font-medium text-gray-700">Escanear Código de Barras</label>
                    <input type="text" id="barcode-input-field" placeholder="Aguardando leitura do código..." class="mt-1 block w-full p-3 border-gray-300 rounded-md shadow-sm text-lg">
                </div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4 border-t pt-4">Ou adicione manually</h3>
                <div id="product-list" class="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2"></div>
            </div>
            <div class="bg-gray-50 p-6 rounded-xl">
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Carrinho de Compras</h3>
                <div id="cart-items" class="min-h-[200px] max-h-[40vh] overflow-y-auto pr-2"></div>
                <div class="mt-6 pt-6 border-t">
                    <p class="text-2xl font-bold text-gray-800 text-right">Total: <span id="cart-total" class="text-indigo-600">R$ 0,00</span></p>
                    <button id="checkout-button" class="mt-4 w-full bg-indigo-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-400" disabled>Finalizar Venda</button>
                </div>
            </div>
        </div>
    `;
    renderProductList();
    renderCart();
}

export function renderInventoryTab() {
     contentInventory.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <div class="mb-8">
                    <h3 class="font-semibold text-xl text-gray-700 mb-4">Entrada Rápida de Estoque</h3>
                    <div class="bg-gray-50 p-6 rounded-lg">
                        <p class="text-gray-600 mb-4 text-center">Use a câmera para escanear o código de barras:</p>
                        <button id="scan-inventory-button" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M3 6h18"/><path d="M3 10h18"/><path d="M3 14h18"/><path d="M3 18h18"/></svg>
                            Escanear com a Câmera
                        </button>
                        <p class="text-gray-600 my-4 text-center">Ou procure pelo nome para adicionar estoque:</p>
                        <input type="text" id="inventory-search-input" onkeyup="handleInventorySearch(event)" placeholder="Buscar produto..." class="w-full p-2 border rounded-md">
                        <div id="inventory-search-results" class="mt-2 max-h-40 overflow-y-auto"></div>
                    </div>
                </div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4 border-t pt-6">Adicionar Novo Produto (Manual)</h3>
                <form id="add-product-form" class="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <input type="text" id="new-sku" placeholder="Código Interno (SKU)" required class="w-full p-2 border rounded">
                    <input type="text" id="new-barcode" placeholder="Código de Barras (opcional)" class="w-full p-2 border rounded">
                    <input type="text" id="new-name" placeholder="Nome do Produto" required class="w-full p-2 border rounded">
                    <input type="number" id="new-price" placeholder="Preço (R$)" step="0.01" min="0" required class="w-full p-2 border rounded">
                    <input type="number" id="new-stock" placeholder="Estoque Inicial" min="0" required class="w-full p-2 border rounded">
                    <input type="number" id="new-min-stock" placeholder="Estoque Mínimo" min="0" required class="w-full p-2 border rounded">
                    <button type="submit" class="w-full bg-green-600 text-white font-bold py-2 rounded-lg">Adicionar Produto</button>
                </form>
            </div>
            <div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Visão Geral do Estoque</h3>
                <div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table class="w-full text-left">
                        <thead class="bg-gray-100"><tr><th class="p-3 font-semibold text-gray-600">Produto</th><th class="p-3 font-semibold text-gray-600 text-center">Estoque</th></tr></thead>
                        <tbody id="inventory-management-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `
    renderInventoryManagement();
}

export function renderCustomersTab() {
    contentCustomers.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Adicionar Novo Cliente</h3>
                <form id="add-customer-form" class="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <input type="text" id="new-customer-name" placeholder="Nome Completo" required class="w-full p-2 border rounded">
                    <input type="text" id="new-customer-phone" placeholder="Telefone (opcional)" class="w-full p-2 border rounded">
                    <input type="number" id="new-customer-debt" placeholder="Dívida Inicial (R$)" step="0.01" min="0" class="w-full p-2 border rounded">
                    <button type="submit" class="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700">Adicionar Cliente</button>
                </form>
            </div>
            <div>
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold text-xl text-gray-700">Contas a Receber</h3>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">Total em Dívidas</p>
                        <p id="total-debt-summary" class="font-bold text-lg text-red-600"></p>
                    </div>
                </div>
                <div id="debtors-list" class="overflow-x-auto max-h-[60vh] overflow-y-auto">
                   <!-- Lista de devedores será inserida aqui -->
                </div>
            </div>
        </div>
    `;
    renderDebtorsList();
}

export function renderReportsTab() {
    contentReports.innerHTML = `
        <h3 class="font-semibold text-xl text-gray-700 mb-4">Histórico de Dias de Operação</h3>
        <div id="session-reports-container" class="space-y-6">
        </div>
    `;
    renderSessionReports();
}

export function renderProductList() {
    const productListEl = document.getElementById('product-list');
    if (!productListEl) return;
    productListEl.innerHTML = '';
    products.forEach(product => {
        const productInStock = product.stock > 0;
        productListEl.innerHTML += `
            <div class="border rounded-lg p-3 flex flex-col justify-between ${!productInStock ? 'bg-gray-100 opacity-60' : 'bg-white'}">
                <div><p class="font-bold">${product.name}</p><p class="text-gray-600">${formatCurrency(product.price)}</p></div>
                <button onclick="addToCart('${product.sku}')" class="mt-3 w-full text-sm font-bold py-2 rounded-md ${productInStock ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-300 cursor-not-allowed'}" ${!productInStock ? 'disabled' : ''}>Add</button>
            </div>`;
    });
}

export function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const checkoutButton = document.getElementById('checkout-button');
    const cartTotalEl = document.getElementById('cart-total');
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center pt-16">Carrinho vazio.</p>';
        checkoutButton.disabled = true;
    } else {
        cartItemsEl.innerHTML = '';
        cart.forEach(item => {
            cartItemsEl.innerHTML += `
                <div class="flex items-center mb-3">
                    <div class="flex-grow"><p class="font-semibold">${item.name}</p></div>
                    <div class="flex items-center">
                        <button onclick="updateCartQuantity('${item.sku}', -1)" class="w-7 h-7 bg-gray-200 rounded-full font-bold">-</button>
                        <span class="w-10 text-center font-semibold">${item.quantity}</span>
                        <button onclick="updateCartQuantity('${item.sku}', 1)" class="w-7 h-7 bg-gray-200 rounded-full font-bold">+</button>
                    </div>
                </div>`;
        });
        checkoutButton.disabled = false;
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalEl.textContent = formatCurrency(total);
}

export function renderInventoryManagement() {
    const inventoryManagementTableBodyEl = document.getElementById('inventory-management-table-body');
    if (!inventoryManagementTableBodyEl) return;
    inventoryManagementTableBodyEl.innerHTML = '';

    const sortedProducts = [...products].sort((a, b) => {
        const aIsLow = a.stock <= 2;
        const bIsLow = b.stock <= 2;
        if (aIsLow && !bIsLow) return -1;
        if (!aIsLow && bIsLow) return 1;
        return 0;
    });

    sortedProducts.forEach(product => {
        const isLowStock = product.stock <= 2;
        const rowClass = isLowStock ? 'low-stock-row' : '';
        const textClass = isLowStock ? 'low-stock-text' : '';

        inventoryManagementTableBodyEl.innerHTML += `
            <tr class="${rowClass}">
                <td class="p-3">${product.name}</td>
                <td class="p-3 text-center ${textClass}">${product.stock}</td>
            </tr>
        `;
    });
}

export function renderDebtorsList() {
    const debtorsListEl = document.getElementById('debtors-list');
    if (!debtorsListEl) return;
    
    const debtors = customers.filter(c => c.id !== 1); // Exclui o cliente padrão
    const totalDebt = debtors.reduce((sum, c) => sum + c.debt, 0);
    document.getElementById('total-debt-summary').textContent = formatCurrency(totalDebt);

    if (debtors.length === 0) {
        debtorsListEl.innerHTML = '<p class="text-gray-500 text-center">Nenhum cliente cadastrado.</p>';
        return;
    }

    debtorsListEl.innerHTML = `
        <table class="w-full text-left">
            <thead class="bg-gray-100"><tr>
                <th class="p-3 font-semibold text-gray-600">Nome</th>
                <th class="p-3 font-semibold text-gray-600">Dívida</th>
                <th class="p-3 font-semibold text-gray-600 text-center">Ações</th>
            </tr></thead>
            <tbody>
                ${debtors.map(c => `
                    <tr class="border-b">
                        <td class="p-3">
                            <p class="font-semibold">${c.name}</p>
                            <p class="text-xs text-gray-500">${c.phone || ''}</p>
                        </td>
                        <td class="p-3 font-bold ${c.debt > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(c.debt)}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="openDebtPaymentModal(${c.id})" class="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">Receber</button>
                            <button onclick="openEditCustomerModal(${c.id})" class="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-gray-200">Editar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export function renderSessionReports() {
    const container = document.getElementById('session-reports-container');
    if (!container) return;

    if (closedDays.length === 0) {
        container.innerHTML = `<p id="no-sessions-message" class="text-gray-500">Nenhum dia de operação foi fechado ainda.</p>`;
    } else {
        let reportsHTML = '';
        closedDays.slice().reverse().forEach(day => {
            const allSales = day.shifts.flatMap(s => s.sales);
            const allDebtPayments = day.shifts.flatMap(s => s.debtPayments);
            const totalSalesValue = allSales.reduce((sum, sale) => sum + sale.total, 0);
            const paymentsSummary = allSales.flatMap(s => s.payments).reduce((acc, p) => {
                acc[p.method] = (acc[p.method] || 0) + p.amount;
                return acc;
            }, {});
            const totalCashInFromSales = (paymentsSummary['Dinheiro'] || 0);
            const totalCashInFromDebts = allDebtPayments.filter(p => p.method === 'Dinheiro').reduce((sum, p) => sum + p.amount, 0);
            const expectedCashInDrawer = day.initialCash + totalCashInFromSales + totalCashInFromDebts;

            let shiftsDetailsHTML = day.shifts.map(shift => {
                const shiftTotal = shift.sales.reduce((sum, s) => sum + s.total, 0);
                return `
                <div class="ml-4 mt-2 p-2 bg-white rounded border">
                    <p class="font-semibold">Turno #${shift.id}</p>
                    <p class="text-xs text-gray-500">Operadores: ${shift.openedBy} (Abertura) / ${shift.closedBy} (Fecho)</p>
                    <p class="text-xs text-gray-500">Período: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}</p>
                    <p class="text-sm">Vendas no turno: ${formatCurrency(shiftTotal)}</p>
                </div>
                `
            }).join('');

            let debtPaymentsHTML = allDebtPayments.length > 0 ? allDebtPayments.map(p => `
                <div class="flex justify-between text-sm"><span>${p.customerName}</span> <span>${formatCurrency(p.amount)} (${p.method})</span></div>
            `).join('') : '<span>Nenhum recebimento no dia.</span>';

            reportsHTML += `
                <details class="bg-gray-50 p-4 rounded-lg border">
                    <summary class="cursor-pointer">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-bold text-lg">Relatório do Dia #${day.id}</p>
                                <p class="text-sm text-gray-600">Data: ${new Date(day.date).toLocaleDateString()}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm">Total de Vendas do Dia</p>
                                <p class="font-bold text-xl">${formatCurrency(totalSalesValue)}</p>
                            </div>
                        </div>
                    </summary>
                    <div class="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p class="font-semibold">Resumo Financeiro do Dia</p>
                            <div class="text-sm mt-2 space-y-1">
                                <div class="flex justify-between"><span>Fundo de Troco Inicial:</span> <span>${formatCurrency(day.initialCash)}</span></div>
                                ${Object.entries(paymentsSummary).map(([method, amount]) => `<div class="flex justify-between"><span>Total em ${method}:</span> <span>${formatCurrency(amount)}</span></div>`).join('')}
                                <div class="flex justify-between font-bold mt-2 pt-2 border-t">
                                    <span>Esperado em Dinheiro (Final):</span>
                                    <span>${formatCurrency(expectedCashInDrawer)}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <p class="font-semibold">Recebimentos de Dívidas</p>
                            <div class="text-sm mt-2 space-y-1">${debtPaymentsHTML}</div>
                        </div>
                        <div class="md:col-span-2">
                            <p class="font-semibold mt-4">Detalhes dos Turnos (${day.shifts.length})</p>
                            ${shiftsDetailsHTML}
                        </div>
                    </div>
                </details>
            `;
        });
        container.innerHTML = reportsHTML;
    }
}

export function updateCashRegisterStatus() {
    tabPdv.disabled = !currentShift;
}

export function renderPaymentModal() {
    const total = saleInProgress.total;
    const totalPaid = saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0);
    const change = totalPaid > total ? totalPaid - total : 0;
    const customerId = parseInt(document.getElementById('payment-modal-customer-select')?.value || saleInProgress.customerId);
    
    document.getElementById('payment-modal-total').textContent = formatCurrency(total);
    document.getElementById('payment-modal-paid-amount').textContent = formatCurrency(totalPaid);
    document.getElementById('payment-modal-change').textContent = formatCurrency(change);
    
    const customerSelect = document.getElementById('payment-modal-customer-select');
    customerSelect.innerHTML = customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    customerSelect.value = customerId;

    document.getElementById('payment-modal-cart-summary').innerHTML = saleInProgress.items.map(i => `<div>${i.quantity}x ${i.name}</div>`).join('');
    document.getElementById('payment-modal-payments-list').innerHTML = saleInProgress.payments.map(p => `<div class="flex justify-between bg-white p-1 rounded"><span>${p.method}</span><span class="font-semibold">${formatCurrency(p.amount)}</span></div>`).join('');

    const remainingAmount = total - totalPaid;
    document.getElementById('payment-amount').value = (remainingAmount > 0) ? remainingAmount.toFixed(2) : '';
    
    let saleCanBeConfirmed = false;
    if (selectedPaymentMethod === 'Fiado') {
        saleCanBeConfirmed = customerId !== 1; // Não pode ser cliente padrão
    } else {
        saleCanBeConfirmed = totalPaid >= total;
    }
    confirmSaleButton.disabled = !saleCanBeConfirmed;

    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === selectedPaymentMethod) {
            btn.classList.add('active');
        }
    });

    document.getElementById('add-payment-form').style.visibility = selectedPaymentMethod === 'Fiado' ? 'hidden' : 'visible';
}

export function closePaymentModal() {
    paymentModal.querySelector('div').classList.remove('scale-100');
    setTimeout(() => paymentModal.classList.add('hidden'), 200);
}

export function resetPdv() {
    setCart([]);
    renderCart();
    document.getElementById('pdv-idle-screen').classList.remove('hidden');
    document.getElementById('pdv-active-sale').classList.add('hidden');
}
