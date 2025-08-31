
import { initializeAuth } from './auth.js';
import { addProduct } from './database.js';
import { products, customers, cart, closedDays, currentDay, currentShift, saleInProgress, selectedPaymentMethod, setSaleInProgress, setSelectedPaymentMethod, setCart, setCurrentShift, setCurrentDay, setClosedDays } from './state.js';
import { changeTab, renderDashboardTab, renderCashRegisterTab, renderPdvTab, renderInventoryTab, renderCustomersTab, renderReportsTab, updateCashRegisterStatus, renderPaymentModal, closePaymentModal, resetPdv, showModal, renderCart, renderProductList, renderInventoryManagement, renderDebtorsList, renderSessionReports } from './ui.js';

// --- RENDERIZAÇÃO GERAL ---
export function renderAll() {
    renderDashboardTab();
    renderCashRegisterTab();
    renderPdvTab();
    renderInventoryTab();
    renderCustomersTab();
    renderReportsTab();
    updateCashRegisterStatus();
}

// --- LÓGICA DE GESTÃO DE CAIXA ---
function handleOpenDay(event) {
    event.preventDefault();
    const initialCash = parseFloat(document.getElementById('initial-cash').value);
    const openedBy = document.getElementById('opening-user').value;
    if (isNaN(initialCash) || initialCash < 0) {
        showModal('Valor Inválido', 'Por favor, insira um valor inicial válido.');
        return;
    }
    setCurrentDay({ id: closedDays.length + 1, date: new Date(), initialCash, shifts: [], status: 'open' });
    handleOpenShift(null, openedBy);
}

function handleOpenShift(event, user) {
    if(event) event.preventDefault();
    const openedBy = user || document.getElementById('next-opening-user').value;
    setCurrentShift({ id: currentDay.shifts.length + 1, startTime: new Date(), endTime: null, openedBy, closedBy: null, sales: [], debtPayments: [] });
    renderCashRegisterTab();
    updateCashRegisterStatus();
    showModal('Turno Aberto!', 'Você já pode iniciar as vendas.');
}

function handleCloseShift() {
    if (!currentShift) return;
    const closedBy = document.getElementById('closing-user').value;
    currentShift.endTime = new Date();
    currentShift.closedBy = closedBy;
    currentDay.shifts.push(currentShift);
    setCurrentShift(null);
    renderCashRegisterTab();
    updateCashRegisterStatus();
    showModal('Turno Fechado', 'O próximo operador pode iniciar um novo turno ou o dia pode ser fechado.');
}

function handleCloseDay() {
    if (!currentDay || currentShift) {
        showModal('Ação Inválida', 'Feche o turno atual antes de fechar o dia.');
        return;
    }
    currentDay.status = 'closed';
    setClosedDays([...closedDays, currentDay]);
    setCurrentDay(null);
    renderCashRegisterTab();
    updateCashRegisterStatus();
    renderReportsTab();
    showModal('Dia Fechado', 'O dia de operações foi encerrado e o relatório final gerado.');
    changeTab('reports');
}

// --- LÓGICA DE CLIENTES E FIADO ---
function handleAddCustomer(event) {
    event.preventDefault();
    const name = document.getElementById('new-customer-name').value.trim();
    const phone = document.getElementById('new-customer-phone').value.trim();
    const debt = parseFloat(document.getElementById('new-customer-debt').value) || 0;
    if (!name) {
        showModal('Erro', 'O nome do cliente é obrigatório.');
        return;
    }
    const newCustomer = { id: Date.now(), name, phone, debt };
    customers.push(newCustomer);
    renderDebtorsList();
    document.getElementById('add-customer-form').reset();
    showModal('Sucesso!', 'Novo cliente cadastrado.');
}

window.openDebtPaymentModal = function(customerId) {
    if (!currentShift) {
        showModal('Caixa Fechado', 'É necessário abrir um turno para receber pagamentos de dívidas.');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    if (customer.debt <= 0) {
        showModal('Informação', 'Este cliente não possui dívidas.');
        return;
    }

    document.getElementById('debt-customer-id').value = customer.id;
    document.getElementById('debt-customer-name').textContent = customer.name;
    document.getElementById('debt-customer-current-debt').textContent = formatCurrency(customer.debt);
    document.getElementById('debt-payment-amount').max = customer.debt;
    document.getElementById('debt-payment-amount').value = customer.debt.toFixed(2);
    
    debtPaymentModal.classList.remove('hidden');
}

window.closeDebtPaymentModal = function() {
    debtPaymentModal.classList.add('hidden');
}

function handleConfirmDebtPayment() {
    const customerId = parseInt(document.getElementById('debt-customer-id').value);
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const amount = parseFloat(document.getElementById('debt-payment-amount').value);
    const method = document.getElementById('debt-payment-method').value;

    if (isNaN(amount) || amount <= 0 || amount > customer.debt) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }

    customer.debt -= amount;
    
    if (currentShift) {
        currentShift.debtPayments.push({ customerId, customerName: customer.name, amount, method });
    }

    renderDebtorsList();
    closeDebtPaymentModal();
    showModal('Pagamento Recebido', `${formatCurrency(amount)} foram abatidos da dívida de ${customer.name}.`);
}

window.openEditCustomerModal = function(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('edit-customer-id').value = customer.id;
    document.getElementById('edit-customer-name').value = customer.name;
    document.getElementById('edit-customer-phone').value = customer.phone || '';
    document.getElementById('edit-customer-debt').value = customer.debt.toFixed(2);
    
    editCustomerModal.classList.remove('hidden');
}

window.closeEditCustomerModal = function() {
    editCustomerModal.classList.add('hidden');
}

function handleUpdateCustomer() {
    const id = parseInt(document.getElementById('edit-customer-id').value);
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    customer.name = document.getElementById('edit-customer-name').value.trim();
    customer.phone = document.getElementById('edit-customer-phone').value.trim();
    customer.debt = parseFloat(document.getElementById('edit-customer-debt').value) || 0;

    renderDebtorsList();
    closeEditCustomerModal();
    showModal('Sucesso', 'Dados do cliente atualizados.');
}

// --- LÓGICA DE VENDA E PAGAMENTO ---
function startNewSale() {
    document.getElementById('pdv-idle-screen').classList.add('hidden');
    document.getElementById('pdv-active-sale').classList.remove('hidden');
    document.getElementById('barcode-input-field').focus();
}

function handleBarcodeKeypress(e) {
    if (e.key === 'Enter' && e.target.value.trim()) {
        e.preventDefault();
        handleBarcodeScan(e.target.value.trim());
        e.target.value = '';
    }
}

function handleBarcodeScan(scannedCode) {
    const product = products.find(p => p.barcode === scannedCode);
    if (product) {
        addToCart(product.sku);
    } else {
        showModal('Produto não encontrado', `Nenhum produto corresponde ao código '${scannedCode}'.`);
    }
}

function addToCart(sku) {
    const product = products.find(p => p.sku === sku);
    const cartItem = cart.find(item => item.sku === sku);
    const availableStock = product.stock - (cartItem ? cartItem.quantity : 0);
    if (availableStock <= 0) {
        showModal('Estoque Insuficiente', `Não há mais estoque para ${product.name}.`);
        return;
    }
    if (cartItem) cartItem.quantity++;
    else cart.push({ ...product, quantity: 1 });
    renderCart();
}

window.updateCartQuantity = function(sku, change) {
    const cartItem = cart.find(item => item.sku === sku);
    if (!cartItem) return;
    if (change > 0) {
        const product = products.find(p => p.sku === sku);
        if (product.stock - cartItem.quantity <= 0) {
            showModal('Estoque Insuficiente', `Não há mais estoque para ${product.name}.`);
            return;
        }
    }
    cartItem.quantity += change;
    if (cartItem.quantity <= 0) setCart(cart.filter(item => item.sku !== sku));
    if (cart.length === 0) resetPdv();
    renderCart();
}

function handleCheckout() {
    if (cart.length === 0) return;
    setSaleInProgress({
        items: JSON.parse(JSON.stringify(cart)),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        payments: [],
        customerId: 1,
    });
    setSelectedPaymentMethod('Dinheiro'); // Reseta para o padrão
    renderPaymentModal();
    paymentModal.classList.remove('hidden');
    setTimeout(() => paymentModal.querySelector('div').classList.add('scale-100'), 10);
}

function handleAddPayment(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('payment-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }
    saleInProgress.payments.push({ method: selectedPaymentMethod, amount });
    renderPaymentModal();
}

function confirmSale() {
    const customerId = parseInt(document.getElementById('payment-modal-customer-select').value);
    saleInProgress.customerId = customerId;

    if (selectedPaymentMethod === 'Fiado') {
        if (customerId === 1) {
            showModal('Ação Inválida', 'Selecione um cliente cadastrado para vendas a fiado.');
            return;
        }
        const customer = customers.find(c => c.id === customerId);
        customer.debt += saleInProgress.total;
        saleInProgress.payments = [{ method: 'Fiado', amount: saleInProgress.total }];
    }

    saleInProgress.id = (currentShift.sales.length + 1);
    saleInProgress.date = new Date();
    currentShift.sales.push(saleInProgress);

    const lowStockItems = [];
    saleInProgress.items.forEach(cartItem => {
        const productInDb = products.find(p => p.sku === cartItem.sku);
        if (productInDb) {
            productInDb.stock -= cartItem.quantity;
            if (productInDb.stock <= 2) {
                lowStockItems.push(productInDb.name);
            }
        }
    });
    
    const totalPaid = saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0);
    const change = totalPaid > saleInProgress.total ? totalPaid - saleInProgress.total : 0;

    renderAll();
    resetPdv();
    closePaymentModal();
    
    let mainMessage = `Venda Confirmada! Troco: ${formatCurrency(change)}`;
    if (selectedPaymentMethod === 'Fiado') {
        mainMessage = `Venda adicionada à conta de ${customers.find(c => c.id === customerId).name}.`;
    }
    
    let warningMessage = '';
    if (lowStockItems.length > 0) {
        warningMessage = `Estoque baixo para: ${lowStockItems.join(', ')}`;
    }
    showModal('Sucesso!', mainMessage, warningMessage);
}

// --- OUTRAS LÓGICAS ---
async function handleAddProduct(event) {
    event.preventDefault();
    const sku = document.getElementById('new-sku').value.trim();
    const barcode = document.getElementById('new-barcode').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const price = parseFloat(document.getElementById('new-price').value);
    const stock = parseInt(document.getElementById('new-stock').value);
    const minStock = parseInt(document.getElementById('new-min-stock').value);

    if(!sku || !name || isNaN(price) || isNaN(stock) || isNaN(minStock)) {
        showModal('Erro', 'Preencha todos os campos obrigatórios.');
        return;
    }

    const newProduct = { sku, barcode, name, price, stock, minStock };
    await addProduct(newProduct);
    document.getElementById('add-product-form').reset();
}

let html5QrcodeScanner = null;
function startInventoryScan() {
    scannerModal.classList.remove('hidden');
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess) 
    .catch(err => {
        console.error("Erro ao iniciar o scanner", err);
        showModal("Erro de Câmera", "Não foi possível aceder à câmera. Verifique as permissões do navegador.");
        stopInventoryScan();
    });
}

function stopInventoryScan() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().catch(err => console.error("Erro ao parar scanner.", err));
    }
    scannerModal.classList.add('hidden');
}

function onScanSuccess(decodedText, decodedResult) {
    stopInventoryScan();
    handleInventoryScanResult(decodedText);
}

function handleInventoryScanResult(barcode) {
    if (!barcode || barcode.trim() === '') return;

    const product = products.find(p => p.barcode === barcode.trim());
    if (product) {
        const quantityStr = prompt(`Produto encontrado: ${product.name}\nEstoque atual: ${product.stock}\n\nQual a quantidade a adicionar?`);
        const quantity = parseInt(quantityStr);
        if (!isNaN(quantity) && quantity > 0) {
            product.stock += quantity;
            renderInventoryManagement();
            showModal('Sucesso', `${quantity} unidades de ${product.name} adicionadas ao estoque.`);
        } else if(quantityStr !== null) {
            showModal('Erro', 'Quantidade inválida.');
        }
    } else {
        if (confirm(`Produto com código de barras "${barcode}" não encontrado.\nDeseja cadastrá-lo agora?`)) {
            renderInventoryTab();
            changeTab('inventory');
            document.getElementById('new-barcode').value = barcode.trim();
            document.getElementById('new-sku').focus();
        }
    }
}

window.handleInventorySearch = function(event) {
    const searchTerm = event.target.value.toLowerCase();
    const resultsContainer = document.getElementById('inventory-search-results');
    
    if (searchTerm.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm));

    if (filteredProducts.length > 0) {
        resultsContainer.innerHTML = filteredProducts.map(p => `
            <div onclick="addProductStockFromSearch('${p.id}')" class="p-2 border-b hover:bg-gray-100 cursor-pointer">
                <p class="font-semibold">${p.name}</p>
                <p class="text-sm text-gray-500">Estoque atual: ${p.stock}</p>
            </div>
        `).join('');
    } else {
        resultsContainer.innerHTML = '<p class="p-2 text-gray-500">Nenhum produto encontrado.</p>';
    }
}

window.addProductStockFromSearch = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const quantityStr = prompt(`Produto selecionado: ${product.name}\nEstoque atual: ${product.stock}\n\nQual a quantidade a adicionar?`);
    const quantity = parseInt(quantityStr);

    if (!isNaN(quantity) && quantity > 0) {
        await updateProductStock(product.id, quantity);
    } else if (quantityStr !== null) {
        showModal('Erro', 'Quantidade inválida.');
    }
    
    // Clear search
    document.getElementById('inventory-search-input').value = '';
    document.getElementById('inventory-search-results').innerHTML = '';
}

// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();

    // Event listeners que dependem de elementos renderizados dinamicamente
    document.getElementById('content-cash-register').addEventListener('submit', (event) => {
        if (event.target.id === 'open-day-form') handleOpenDay(event);
        if (event.target.id === 'open-shift-form') handleOpenShift(event);
    });

    document.getElementById('content-cash-register').addEventListener('click', (event) => {
        if (event.target.id === 'close-shift-button') handleCloseShift();
        if (event.target.id === 'close-day-button') handleCloseDay();
    });

    document.getElementById('content-pdv').addEventListener('click', (event) => {
        if (event.target.id === 'start-sale-button') startNewSale();
        if (event.target.id === 'checkout-button') handleCheckout();
    });

    document.getElementById('content-pdv').addEventListener('keypress', (event) => {
        if (event.target.id === 'barcode-input-field') handleBarcodeKeypress(event);
    });

    document.getElementById('content-inventory').addEventListener('submit', (event) => {
        if (event.target.id === 'add-product-form') handleAddProduct(event);
    });

    document.getElementById('content-inventory').addEventListener('click', (event) => {
        if (event.target.id === 'scan-inventory-button') startInventoryScan();
    });

    document.getElementById('content-customers').addEventListener('submit', (event) => {
        if (event.target.id === 'add-customer-form') handleAddCustomer(event);
    });

    document.getElementById('add-payment-form').addEventListener('submit', handleAddPayment);
    document.getElementById('confirm-sale-button').addEventListener('click', confirmSale);
    document.getElementById('stop-scanner-button')?.addEventListener('click', stopInventoryScan);
    document.getElementById('update-customer-button')?.addEventListener('click', handleUpdateCustomer);
    document.getElementById('confirm-debt-payment-button')?.addEventListener('click', handleConfirmDebtPayment);

    paymentModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-method-btn')) {
            setSelectedPaymentMethod(e.target.dataset.method);
            renderPaymentModal();
        }
    });

    debtPaymentModal.addEventListener('click', (e) => {
        if (e.target.id === 'pay-full-debt-button') {
            const customerId = parseInt(document.getElementById('debt-customer-id').value);
            const customer = customers.find(c => c.id === customerId);
            if(customer) {
                document.getElementById('debt-payment-amount').value = customer.debt.toFixed(2);
            }
        }
    });

    // Adiciona os eventos para as abas
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.id.replace('tab-', '');
            changeTab(tabName);
        });
    });
});
