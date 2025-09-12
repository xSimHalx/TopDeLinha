import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, limit, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
// IMPORTANTE: Substitua estas chaves pelas do seu projeto no site do Firebase!
const firebaseConfig = {
    apiKey: "AIzaSyD0aw5it4FgY7TdCIUrj9cGfGp3c0au10U",
    authDomain: "topdelinhacaixaestoque.firebaseapp.com",
    projectId: "topdelinhacaixaestoque",
    storageBucket: "topdelinhacaixaestoque.firestorage.app",
    messagingSenderId: "177632701767",
    appId: "1:177632701767:web:ad38d9abb95a321d42b062",
    measurementId: "G-M0PEZ05LWE"
};

// --- INICIALIZAÇÃO DO FIREBASE ---
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Erro na configuração do Firebase. Verifique as suas chaves.", e);
    //alert("Erro de configuração. Verifique as chaves do Firebase no código.");
}

// --- BASE DE DADOS (Agora serão carregados do Firebase) ---
export let products = [];
let customers = [];
export let cart = [];
let closedDays = [];
let currentDay = null;
let currentShift = null;
let saleInProgress = {};
let selectedPaymentMethod = 'Dinheiro';
let salesChart = null;
let settings = {}; // NEW: To store settings
let html5QrcodeScanner = null;

// --- ELEMENTOS DO DOM ---
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const logoutButton = document.getElementById('logout-button');
const contentDashboard = document.getElementById('content-dashboard');
const contentCashRegister = document.getElementById('content-cash-register');
const contentPdv = document.getElementById('content-pdv');
const contentInventory = document.getElementById('content-inventory');
const contentCustomers = document.getElementById('content-customers');
const contentReports = document.getElementById('content-reports');
const contentActivities = document.getElementById('content-activities');
const contentSettings = document.getElementById('content-settings'); // NEW
const tabPdv = document.getElementById('tab-pdv');
const paymentModal = document.getElementById('payment-modal');
const confirmSaleButton = document.getElementById('confirm-sale-button');
const addPaymentForm = document.getElementById('add-payment-form');
const editCustomerModal = document.getElementById('edit-customer-modal');
const debtPaymentModal = document.getElementById('debt-payment-modal');
const receiptModal = document.getElementById('receipt-modal');
const diversosModal = document.getElementById('diversos-modal');

// --- FUNÇÕES DE RENDERIZAÇÃO E UTILIDADES ---
export const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Função para converter string monetária (pt-BR) para número
export const parseCurrency = (value) => {
    if (typeof value !== 'string') return Number(value) || 0;
    // Remove símbolo R$, espaços e tudo que não é número, ponto ou vírgula
    let cleaned = value.replace(/R\$|\s/g, '');
    // Remove pontos (milhar), troca vírgula por ponto (decimal)
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
    // Se sobrar só vírgula, trata como zero
    if (cleaned === '' || cleaned === ',') return 0;
    return parseFloat(cleaned) || 0;
};
const formatDateTime = (date) => new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

window.showModal = function (title, message, warningMessage = '') {
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

window.closeModal = function () {
    document.getElementById('success-modal').classList.add('hidden');
}

// --- LÓGICA DE AUTENTICAÇÃO (FIREBASE REAL) ---
function handleLogin(event) {
    event.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            console.error("Erro de login:", error.code);
            showModal("Erro de Login", "Email ou senha incorretos. Por favor, tente novamente.");
        });
}

function handleLogout() {
    signOut(auth);
}

function handleForgotPassword() {
    const email = prompt("Por favor, insira o seu email para receber o link de redefinição de senha.");
    if (email) {
        sendPasswordResetEmail(auth, email)
            .then(() => {
                showModal("Email Enviado", "Um link para redefinir a sua senha foi enviado para o seu email.");
            })
            .catch(error => {
                console.error("Erro ao enviar email:", error.code);
                showModal("Erro", "Não foi possível enviar o email. Verifique se o endereço está correto.");
            });
    }
}

onAuthStateChanged(auth, async (user) => {
    if (loginScreen && mainApp) { // Adicionado verificação para evitar erro em testes
        if (user) {
            loginScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            mainApp.classList.add('flex');
            await loadInitialData(); // Carrega os dados APÓS o login
            renderAll();
        } else {
            loginScreen.classList.remove('hidden');
            mainApp.classList.add('hidden');
            mainApp.classList.remove('flex');
        }
    }
});


// --- LÓGICA DAS ABAS ---
window.changeTab = function (tabName) {
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
    if (tabName === 'activities') renderActivityTab();
    if (tabName === 'settings') renderSettingsTab();
    if (tabName === 'inventory') {
        setTimeout(() => {
            document.getElementById('inventory-barcode-input').focus();
        }, 0);
    }
    if (tabName === 'pdv') {
        startNewSale();
    }
}

// --- RENDERIZAÇÃO GERAL E INICIALIZAÇÃO ---
function renderAll() {
    renderDashboardTab();
    renderCashRegisterTab();
    renderPdvTab();
    renderInventoryTab();
    renderCustomersTab();
    renderReportsTab();
    renderSettingsTab(); // NEW
    updateCashRegisterStatus();
}

// --- CARREGAMENTO DE DADOS ---
async function loadInitialData() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    console.log("Loading data for user:", uid); // DEBUG

    try {
        // Fetch settings first
        const settingsRef = doc(db, "settings", uid);
        const settingsSnap = await getDoc(settingsRef);
        let settingsData = {};
        let needsUpdate = false;

        console.log("Settings snapshot exists:", settingsSnap.exists()); // DEBUG

        if (settingsSnap.exists()) {
            settingsData = settingsSnap.data();
            console.log("Loaded settings:", settingsData); // DEBUG
        } else {
            console.log("No settings found, creating default settings."); // DEBUG
            settingsData = {
                companyInfo: {
                    name: 'Sua Loja Aqui',
                    address: 'Seu Endereço',
                    cnpj: '00.000.000/0000-00',
                    receiptMessage: 'Obrigado pela preferência!'
                },
                operators: ['Caixa 1', 'Gerente']
            };
            needsUpdate = true;
        }

        // Ensure operators array exists
        if (!settingsData.operators) {
            console.log("Operators not found, creating default."); // DEBUG
            settingsData.operators = ['Caixa 1', 'Gerente'];
            needsUpdate = true;
        }

        // Ensure companyInfo object exists
        if (!settingsData.companyInfo) {
            console.log("CompanyInfo not found, creating default."); // DEBUG
            settingsData.companyInfo = {
                name: 'Sua Loja Aqui',
                address: 'Seu Endereço',
                cnpj: '00.000.000/0000-00',
                receiptMessage: 'Obrigado pela preferência!'
            };
            needsUpdate = true;
        }

        settings = settingsData;

        if (needsUpdate) {
            console.log("Updating settings in Firestore with defaults."); // DEBUG
            await setDoc(settingsRef, settings, { merge: true });
        }

        const productsQuery = query(collection(db, "products"), where("usuarioId", "==", uid));
        const productsSnapshot = await getDocs(productsQuery);
        products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const customersQuery = query(collection(db, "customers"), where("usuarioId", "==", uid));
        const customersSnapshot = await getDocs(customersQuery);
        customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Query for the open day
        const openDayQuery = query(collection(db, "operating_days"), where("status", "==", "open"), where("usuarioId", "==", uid), limit(1));
        const openDaySnapshot = await getDocs(openDayQuery);

        if (!openDaySnapshot.empty) {
            const openDayDoc = openDaySnapshot.docs[0];
            currentDay = { id: openDayDoc.id, ...openDayDoc.data() };
            if (currentDay.shifts) {
                currentShift = currentDay.shifts.find(shift => !shift.endTime) || null;
            } else {
                currentDay.shifts = [];
                currentShift = null;
            }
        } else {
            currentDay = null;
            currentShift = null;
        }

        // Load closed days for reports
        const closedDaysQuery = query(collection(db, "operating_days"), where("status", "==", "closed"), where("usuarioId", "==", uid), orderBy("date", "desc"));
        const closedDaysSnapshot = await getDocs(closedDaysQuery);
        closedDays = closedDaysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showModal("Erro de Conexão", "Não foi possível carregar os dados da base de dados. Verifique a sua conexão e as regras de segurança do Firestore.");
    }
}

// --- LOG DE ATIVIDADES ---
async function logActivity(type, details, user = 'Sistema') {
    if (!auth.currentUser) return;
    try {
        await addDoc(collection(db, "activity_log"), {
            timestamp: new Date().toISOString(),
            type,
            user,
            details,
            usuarioId: auth.currentUser.uid
        });
    } catch (error) {
        console.error("Erro ao registrar atividade no log:", error);
        showModal("Erro de Log", "Não foi possível registrar a atividade. Verifique a sua conexão ou as regras do Firestore.");
    }
}

// --- RENDERIZAÇÃO ESPECÍFICA DE CADA ABA ---

const releaseNotes = [{
    version: '1.6.1',
    date: '11/09/2025',
    notes: [
        'Corrigido bug que impedia o botão "Confirmar Venda" de ser habilitado quando o valor pago era exatamente igual ao total, devido a problemas de arredondamento.'
    ]
}, {
    version: '1.6.0',
    date: '11/09/2025',
    notes: [
        'Reorganizados os botões na tela de PDV para melhor usabilidade.',
        'Adicionado botão "Escanear" com a câmera no PDV.'
    ]
}, {
    version: '1.5.9',
    date: '11/09/2025',
    notes: [
        'Adicionado botão [X] para remover itens diretamente do carrinho.',
        'Melhorada a visualização dos itens no carrinho com mais detalhes.'
    ]
}, {
    version: '1.5.8',
    date: '11/09/2025',
    notes: [
        'Corrigido bug crítico na venda a fiado que impedia a finalização da venda.',
    ]
}, {
    version: '1.5.7',
    date: '11/09/2025',
    notes: [
        'Corrigido um bug que poderia ocorrer ao tentar atualizar um cliente sem um ID válido.',
        'Melhorada a robustez da função de atualização de clientes.'
    ]
}, {
    version: '1.5.6',
    date: '11/09/2025',
    notes: [
        'Adicionada opção de pagamento "Fiado" no modal de pagamento.'
    ]
}, {
    version: '1.5.5',
    date: '11/09/2025',
    notes: [
        'Corrigido o botão "Diversos" que não estava funcionando corretamente.'
    ]
}, {
    version: '1.5.4',
    date: '11/09/2025',
    notes: [
        'Adicionado botão "Diversos" no PDV para adicionar itens não cadastrados com valor customizado.'
    ]
}, {
    version: '1.5.3',
    date: '11/09/2025',
    notes: [
        'Corrigido o botão "Cancelar Venda" que não estava funcionando corretamente.'
    ]
}, {
    version: '1.5.2',
    date: '11/09/2025',
    notes: [
        'Adicionada validação para o campo de código de barras, exigindo 13 dígitos para o padrão EAN-13, além de verificar se contém apenas números.'
    ]
},
{
    version: '1.5.1',
    date: '11/09/2025',
    notes: [
        'Adicionada validação para o campo de código de barras ao adicionar um novo produto, garantindo que contenha apenas números ou seja deixado em branco.'
    ]
},
{
    version: '1.5.0',
    date: '10/09/2025',
    notes: [
        'Adicionada opção de pesquisa de produto por nome na aba Frente de Caixa (PDV).',
        'Implementada leitura de códigos de barra de balança (iniciados com \'2\') para extrair SKU e preço.'
    ]
},
{
    version: '1.4.0',
    date: '10/09/2025',
    notes: [
        'Limites de historico de atividades aumentado, de 50 para 300'
    ]
},
{
    version: '1.3.0',
    date: '10/09/2025',
    notes: [
        'Adicionado filtro de data na aba de relatórios.',
        'Alterada a ordem de exibição do log de atividades para mostrar os itens mais recentes primeiro.'
    ]
},
{
    version: '1.2.1',
    date: '10/09/2025',
    notes: [
        'Adicionada seção de "Novidades da Versão" ao Painel.',
        'Corrigido o alerta de estoque baixo no painel para usar o valor mínimo definido por produto.',
        'Adicionado aviso de estoque mínimo no recibo após a venda.'
    ]
},
{
    version: '1.1.0',
    date: '09/09/2025',
    notes: [
        'Implementado scanner de código de barras com a câmera, com preferência para a câmera traseira.',
        'Tradução de mais elementos da interface para Português (Brasil).'
    ]
},
{
    version: '1.0.0',
    date: '01/09/2025',
    notes: [
        'Lançamento inicial do sistema TopDeLinha PDV.'
    ]
}
];

function renderReleaseNotes() {
    const container = document.getElementById('release-notes-container');
    if (!container) return;

    container.innerHTML = releaseNotes.map(release => `
        <div class="bg-white p-4 rounded-lg shadow-sm border">
            <h4 class="font-bold text-lg">Versão ${release.version} <span class="text-sm font-normal text-gray-500">- ${release.date}</span></h4>
            <ul class="list-disc list-inside mt-2 space-y-1 text-gray-700">
                ${release.notes.map(note => `<li>${note}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

function renderDashboardTab() {
    const totalSalesToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).reduce((sum, sale) => sum + sale.total, 0) : 0;
    const salesCountToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).length : 0;
    const lowStockItems = products.filter(p => p.stock <= p.minStock);
    const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);

    contentDashboard.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button onclick="window.goToReportsHoje()" class="bg-green-50 p-6 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                <h4 class="text-sm font-semibold text-green-800">Vendas do Dia</h4>
                <p class="text-3xl font-bold text-green-600 mt-2">${formatCurrency(totalSalesToday)}</p>
                <p class="text-xs text-green-700">${salesCountToday} vendas realizadas</p>
            </button>
            <button onclick="window.goToClientesComDivida()" class="bg-orange-50 p-6 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors">
                <h4 class="text-sm font-semibold text-orange-800">Total a Receber (Fiado)</h4>
                <p class="text-3xl font-bold text-orange-600 mt-2">${formatCurrency(totalDebt)}</p>
                <p class="text-xs text-orange-700">${customers.filter(c => c.debt > 0).length} clientes com dívidas</p>
            </button>
            <button onclick="window.goToEstoqueBaixo()" class="bg-red-50 p-6 rounded-lg border border-red-200 col-span-1 md:col-span-2 cursor-pointer hover:bg-red-100 transition-colors">
                <h4 class="text-sm font-semibold text-red-800">Itens com Estoque Baixo</h4>
                ${lowStockItems.length > 0 ? `
                    <ul class="mt-2 space-y-1 text-sm max-h-[10vh] overflow-y-auto">
                        ${lowStockItems.map(p => `<li class="flex justify-between"><span>${p.name}</span> <span class="font-bold text-red-600">${p.stock} / min: ${p.minStock}</span></li>`).join('')}
                    </ul>
                ` : '<p class="mt-4 text-center text-gray-500">Nenhum item com estoque baixo.</p>'}
            </button>
        </div>
        <div>
            <h3 class="text-xl font-bold text-gray-700 mt-8 mb-4">Novidades da Versão</h3>
            <div id="release-notes-container" class="space-y-4 max-h-[30vh] overflow-y-auto pr-2">
                <!-- Release notes will be injected here -->
            </div>
        </div>
    `;
    // Funções de navegação dos cards
    window.goToReportsHoje = function () {
        changeTab('reports');
        // Preenche filtro para hoje
        const hoje = new Date();
        const yyyy = hoje.getFullYear();
        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
        const dd = String(hoje.getDate()).padStart(2, '0');
        const dataHoje = `${yyyy}-${mm}-${dd}`;
        setTimeout(() => {
            document.getElementById('report-start-date').value = dataHoje;
            document.getElementById('report-end-date').value = dataHoje;
            document.getElementById('filter-reports-button').click();
        }, 100);
    };
    window.goToClientesComDivida = function () {
        changeTab('customers');
        setTimeout(() => {
            // Filtra lista de clientes para mostrar só os com dívida
            const debtorsListEl = document.getElementById('debtors-list');
            if (debtorsListEl) {
                const trs = debtorsListEl.querySelectorAll('tbody tr');
                trs.forEach(tr => {
                    const valor = tr.querySelector('td:nth-child(2)').textContent;
                    if (!valor.includes('-') && !valor.match(/R\$\s*0,00/)) {
                        tr.style.display = '';
                    } else {
                        tr.style.display = 'none';
                    }
                });
            }
        }, 200);
    };
    window.goToEstoqueBaixo = function () {
        changeTab('inventory');
        setTimeout(() => {
            // Filtra lista de produtos para mostrar só os de baixo estoque
            const tableBody = document.getElementById('inventory-management-table-body');
            if (tableBody) {
                const trs = tableBody.querySelectorAll('tr');
                trs.forEach(tr => {
                    const estoque = tr.querySelector('td:last-child').textContent;
                    if (estoque.includes('min:') || estoque.includes('baixo')) {
                        tr.style.display = '';
                    } else {
                        tr.style.display = 'none';
                    }
                });
            }
        }, 200);
    };
    renderReleaseNotes();
}

function renderCashRegisterTab() {
    const userOptions = settings.operators.map(user => `<option value="${user}">${user}</option>`).join('');

    const cashRegisterClosedState = document.getElementById('cash-register-closed-state');
    const cashRegisterActiveShiftState = document.getElementById('cash-register-active-shift-state');
    const cashRegisterWaitingShiftState = document.getElementById('cash-register-waiting-shift-state');

    cashRegisterClosedState.classList.add('hidden');
    cashRegisterActiveShiftState.classList.add('hidden');
    cashRegisterWaitingShiftState.classList.add('hidden');

    if (!currentDay) {
        cashRegisterClosedState.classList.remove('hidden');
        document.getElementById('opening-user').innerHTML = userOptions;
    } else if (currentDay && currentShift) {
        cashRegisterActiveShiftState.classList.remove('hidden');
        document.getElementById('session-start-time').textContent = formatDateTime(currentShift.startTime);
        document.getElementById('session-opened-by').textContent = currentShift.openedBy;
        document.getElementById('closing-user').innerHTML = userOptions;
    } else {
        cashRegisterWaitingShiftState.classList.remove('hidden');
        document.getElementById('next-opening-user').innerHTML = userOptions;
    }
}

function renderPdvTab() {
    contentPdv.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-700">Frente de Caixa (PDV)</h3>
                </div>
                 <div id="pdv-idle-screen" class="text-center py-20 hidden">
                    <h2 class="mt-4 text-2xl font-bold text-gray-700">Caixa Livre</h2>
                    <button id="start-sale-button" class="mt-6 bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg">Iniciar Nova Venda</button>
                </div>
                <div id="pdv-active-sale" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div id="pdv-left-column" class="relative">
                        <div class="mb-6">
                            <label for="barcode-input-field" class="block text-sm font-medium text-gray-700">Escanear Código de Barras</label>
                            <div class="flex items-center gap-2 mt-1">
                                <input type="text" id="barcode-input-field" placeholder="Use o leitor ou a câmera..." class="block w-full p-3 border-gray-300 rounded-md shadow-sm text-lg">
                                <button type="button" id="pdv-scan-button" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 whitespace-nowrap">Escanear</button>
                            </div>
                        </div>
                        <div class="mb-6">
                            <label for="product-search-input" class="block text-sm font-medium text-gray-700">Pesquisar Produto por Nome</label>
                            <div class="flex items-center gap-2 mt-1">
                                <input type="text" id="product-search-input" onkeyup="handlePdvProductSearch(event)" placeholder="Digite o nome do produto..." class="block w-full p-3 border-gray-300 rounded-md shadow-sm text-lg">
                                <button id="diversos-button" class="bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 whitespace-nowrap">Diversos</button>
                            </div>
                            <div id="pdv-search-results" class="mt-2 max-h-40 overflow-y-auto"></div>
                        </div>
                        <h3 class="font-semibold text-xl text-gray-700 mb-4 border-t pt-4">Ou adicione manualmente</h3>
                        <div id="product-list" class="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2"></div>
                    </div>
                    <div class="bg-gray-50 p-6 rounded-xl">
                        <h3 class="font-semibold text-xl text-gray-700 mb-4">Carrinho de Compras</h3>
                        <div id="cart-items" class="min-h-[200px] max-h-[40vh] overflow-y-auto pr-2"></div>
                        <div class="mt-6 pt-6 border-t">
                            <p class="text-2xl font-bold text-gray-800 text-right">Total: <span id="cart-total" class="text-indigo-600">R$ 0,00</span></p>
                            <button id="checkout-button" class="mt-4 w-full bg-indigo-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-400" disabled>Finalizar Venda</button>
                            <button id="cancel-sale-button" class="mt-2 w-full bg-red-500 text-white font-bold py-2 rounded-lg hover:bg-red-600">Cancelar Venda</button>
                        </div>
                    </div>
                </div>
            `;
    renderProductList();
    renderCart();
    document.getElementById('barcode-input-field').focus();
}

window.handlePdvProductSearch = function (event) {
    const searchTerm = event.target.value.toLowerCase();
    const resultsContainer = document.getElementById('pdv-search-results');

    if (searchTerm.length === 0) {
        resultsContainer.innerHTML = '';
        return;
    }

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm));

    if (filteredProducts.length > 0) {
        resultsContainer.innerHTML = filteredProducts.map(p => `
                    <div onclick="addPdvProductFromSearch('${p.sku}')" class="p-2 border-b hover:bg-gray-100 cursor-pointer">
                        <p class="font-semibold">${p.name}</p>
                        <p class="text-sm text-gray-500">Estoque: ${p.stock}</p>
                    </div>
                `).join('');
    } else {
        resultsContainer.innerHTML = '<p class="p-2 text-gray-500">Nenhum produto encontrado.</p>';
    }
}

window.addPdvProductFromSearch = function (sku) {
    addToCart(sku);
    document.getElementById('product-search-input').value = '';
    document.getElementById('pdv-search-results').innerHTML = '';
}

function renderInventoryTab() {
    contentInventory.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div class="mb-8">
                            <h3 class="font-semibold text-xl text-gray-700 mb-4">Entrada Rápida de Estoque</h3>
                            <div class="bg-gray-50 p-6 rounded-lg">
                                <label for="inventory-barcode-input" class="block text-sm font-medium text-gray-700">Escanear Código de Barras</label>
                                <div class="flex items-center gap-2 mt-1">
                                    <input type="text" id="inventory-barcode-input" placeholder="Use o leitor de código de barras aqui..." class="block w-full p-3 border-gray-300 rounded-md shadow-sm text-lg">
                                    <button type="button" id="inventory-scan-button" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 whitespace-nowrap">Escanear</button>
                                </div>
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

window.handleInventorySearch = function (event) {
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

window.addProductStockFromSearch = async function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const quantityStr = prompt(`Produto selecionado: ${product.name}
Estoque atual: ${product.stock}

Qual a quantidade a adicionar?`);
    const quantity = parseInt(quantityStr);

    if (!isNaN(quantity) && quantity > 0) {
        await updateProductStock(product.id, quantity);
    } else if (quantityStr !== null) {
        showModal('Erro', 'Quantidade inválida.');
    }

    document.getElementById('inventory-search-input').value = '';
    document.getElementById('inventory-search-results').innerHTML = '';
}

function renderCustomersTab() {
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
                        </div>
                    </div>
                </div>
            `;
    renderDebtorsList();
}

function renderReportsTab() {
    contentReports.innerHTML = `
                <div class="flex flex-wrap items-end gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                    <div>
                        <label for="report-start-date" class="block text-sm font-medium text-gray-700">Data de Início</label>
                        <input type="date" id="report-start-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <div>
                        <label for="report-end-date" class="block text-sm font-medium text-gray-700">Data Final</label>
                        <input type="date" id="report-end-date" class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <button id="filter-reports-button" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Filtrar</button>
                    <button id="clear-filter-button" class="bg-gray-200 text-gray-700 py-2 px-4 rounded-lg">Limpar</button>
                </div>
                <div id="session-reports-container" class="space-y-6">
                    <!-- Reports will be rendered here -->
                </div>
            `;
    displayFilteredReports(closedDays); // Display all reports initially

    document.getElementById('filter-reports-button').addEventListener('click', handleFilterReports);
    document.getElementById('clear-filter-button').addEventListener('click', () => {
        document.getElementById('report-start-date').value = '';
        document.getElementById('report-end-date').value = '';
        displayFilteredReports(closedDays);
    });
}

function handleFilterReports() {
    const startDateInput = document.getElementById('report-start-date').value;
    const endDateInput = document.getElementById('report-end-date').value;

    if (!startDateInput || !endDateInput) {
        showModal("Datas Inválidas", "Por favor, selecione a data de início e a data final para filtrar.");
        return;
    }

    const parsePtBrDate = (dateStr) => {
        const [datePart] = dateStr.split(',');
        const [day, month, year] = datePart.split('/');
        return new Date(year, month - 1, day);
    };

    const startDate = new Date(startDateInput);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);

    const filtered = closedDays.filter(day => {
        const dayDate = parsePtBrDate(day.date);
        return dayDate >= startDate && dayDate <= endDate;
    });

    displayFilteredReports(filtered);
}

function displayFilteredReports(daysToDisplay) {
    const container = document.getElementById('session-reports-container');
    if (!container) return;

    if (daysToDisplay.length === 0) {
        container.innerHTML = `<p id="no-sessions-message" class="text-gray-500 text-center py-8">Nenhum relatório encontrado para o período selecionado.</p>`;
        return;
    }

    let reportsHTML = '';
    daysToDisplay.slice().reverse().forEach(day => {
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
            return (
                `<div class="ml-4 mt-2 p-2 bg-white rounded border">
                <p class="font-semibold">Turno #${shift.id}</p>
                <p class="text-xs text-gray-500">Operadores: ${shift.openedBy} (Abertura) / ${shift.closedBy} (Fecho)</p>
                <p class="text-xs text-gray-500">Período: ${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}</p>
                <p class="text-sm">Vendas no turno: ${formatCurrency(shiftTotal)}</p>
            </div>`
            )
        }).join('');

        let debtPaymentsHTML = allDebtPayments.length > 0 ? allDebtPayments.map(p => (
            `<div class="flex justify-between text-sm"><span>${p.customerName}</span> <span>${formatCurrency(p.amount)} (${p.method})</span></div>`
        )).join('') : '<span>Nenhum recebimento no dia.</span>';

        reportsHTML += (
            `<details class="bg-gray-50 p-4 rounded-lg border">
                <summary class="cursor-pointer">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-lg">Relatório do Dia: ${day.date.split(',')[0]}</p>
                            <p class="text-sm text-gray-600">ID do Dia: #${day.id}</p>
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
        `
        );
    });
    container.innerHTML = reportsHTML;
}

async function renderActivityTab() {
    contentActivities.innerHTML = `
        <div class="flex flex-wrap gap-4 mb-4">
            <h3 class="font-semibold text-xl text-gray-700">Log de Atividades Recentes</h3>
            <input id="activity-search-input" type="text" placeholder="Buscar por texto ou usuário..." class="p-2 border rounded-md flex-1 min-w-[200px]" />
            <button onclick="window.filterActivitiesHoje()" class="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-100">Hoje</button>
            <button onclick="window.clearActivityFilters()" class="bg-gray-50 text-gray-800 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Limpar Filtros</button>
        </div>
        <div id="activities-list-container">Carregando...</div>
    `;

    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
        const q = query(collection(db, "activity_log"), where("usuarioId", "==", uid), orderBy("timestamp", "desc"), limit(300));
        const logSnapshot = await getDocs(q);
        const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const container = document.getElementById('activities-list-container');
        if (logs.length === 0) {
            container.innerHTML = '<p class="text-gray-500">Nenhuma atividade registrada ainda.</p>';
            return;
        }

        // Agrupa por dia
        const logsByDay = {};
        logs.forEach(log => {
            const dia = formatDateTime(log.timestamp).split(' ')[0];
            if (!logsByDay[dia]) logsByDay[dia] = [];
            logsByDay[dia].push(log);
        });
        let html = '';
        Object.keys(logsByDay).forEach(dia => {
            html += `<h4 class="mt-6 mb-2 text-lg font-bold text-gray-700">${dia}</h4>`;
            html += logsByDay[dia].map(log => {
                let detailsText = '';
                switch (log.type) {
                    case 'VENDA_CRIADA':
                        detailsText = `Venda #${log.details.saleId} no valor de ${formatCurrency(log.details.total)} para ${log.details.customerName}.`;
                        break;
                    case 'PRODUTO_ADICIONADO':
                        detailsText = `Novo produto: ${log.details.name} (SKU: ${log.details.sku}) com estoque inicial de ${log.details.stock}.`;
                        break;
                    case 'ESTOQUE_ATUALIZADO':
                        detailsText = `Adicionadas ${log.details.quantityAdded} unidades de "${log.details.productName}". Novo estoque: ${log.details.newStock}.`;
                        break;
                    case 'CLIENTE_ADICIONADO':
                        detailsText = `Novo cliente cadastrado: ${log.details.name}.`;
                        break;
                    case 'CLIENTE_ATUALIZADO':
                        detailsText = `Dados do cliente "${log.details.name}" foram atualizados.`;
                        break;
                    case 'PAGAMENTO_DIVIDA':
                        detailsText = `Recebido ${formatCurrency(log.details.amount)} de ${log.details.customerName}.`;
                        break;
                    case 'PRODUTO_DESFEITO':
                        detailsText = `Ação de adicionar o produto "${log.details.productName}" (SKU: ${log.details.sku}) foi desfeita.`;
                        break;
                    case 'ESTOQUE_DESFEITO':
                        detailsText = `Ação de adicionar ${log.details.quantityReverted} unidades ao estoque de "${log.details.productName}" foi desfeita. Novo estoque: ${log.details.newStock}.`;
                        break;
                    case 'CLIENTE_DESFEITO':
                        detailsText = `Ação de adicionar o cliente "${log.details.customerName}" foi desfeita.`;
                        break;
                    case 'TURNO_FECHADO':
                        detailsText = `Turno #${log.details.shiftId} fechado por ${log.details.closedBy}. Vendas: ${formatCurrency(log.details.totalSales)}.`;
                        break;
                    case 'DIA_FECHADO':
                        detailsText = `Dia de operação fechado. Vendas totais: ${formatCurrency(log.details.totalSales)}. Fundo inicial: ${formatCurrency(log.details.initialCash)}.`;
                        break;
                    default:
                        detailsText = JSON.stringify(log.details);
                }
                const isUndoable = ['PRODUTO_ADICIONADO', 'ESTOQUE_ATUALIZADO', 'CLIENTE_ADICIONADO'].includes(log.type) && !log.undone;
                const logString = btoa(JSON.stringify(log));
                return `
                    <div class="border-b p-3 hover:bg-gray-50 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-800">${log.type.replace(/_/g, ' ')}</p>
                            <p class="text-sm text-gray-600">${detailsText}</p>
                            <p class="text-xs text-gray-400 mt-1">${formatDateTime(log.timestamp)} por ${log.user}</p>
                        </div>
                        <div>
                            ${isUndoable ? `<button onclick="window.handleUndoActivity('${logString}')" class="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-red-200">Desfazer</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        });
        container.innerHTML = html;
        // Filtro por texto
        document.getElementById('activity-search-input').addEventListener('input', function (e) {
            const val = e.target.value.toLowerCase();
            const logs = container.querySelectorAll('div.border-b');
            logs.forEach(log => {
                if (log.textContent.toLowerCase().includes(val)) {
                    log.style.display = '';
                } else {
                    log.style.display = 'none';
                }
            });
        });
        // Filtro rápido para hoje
        window.filterActivitiesHoje = function () {
            const hoje = new Date();
            const yyyy = hoje.getFullYear();
            const mm = String(hoje.getMonth() + 1).padStart(2, '0');
            const dd = String(hoje.getDate()).padStart(2, '0');
            const dataHoje = `${dd}/${mm}/${yyyy}`;
            const logs = container.querySelectorAll('div.border-b');
            logs.forEach(log => {
                if (log.textContent.includes(dataHoje)) {
                    log.style.display = '';
                } else {
                    log.style.display = 'none';
                }
            });
        };
        window.clearActivityFilters = function () {
            document.getElementById('activity-search-input').value = '';
            const logs = container.querySelectorAll('div.border-b');
            logs.forEach(log => log.style.display = '');
        };

    } catch (error) {
        console.error("Erro ao carregar log de atividades:", error);
        document.getElementById('activities-list-container').innerHTML = '<p class="text-red-500">Erro ao carregar atividades.</p>';
    }
}


// NEW: Settings Tab Logic
function renderSettingsTab() {
    if (!settings || !settings.companyInfo) return; // Wait for settings to be loaded

    // Populate company info form
    document.getElementById('store-name').value = settings.companyInfo.name || '';
    document.getElementById('store-address').value = settings.companyInfo.address || '';
    document.getElementById('store-cnpj').value = settings.companyInfo.cnpj || '';
    document.getElementById('store-receipt-message').value = settings.companyInfo.receiptMessage || '';

    // Populate operators list
    const operatorsListEl = document.getElementById('operators-list');
    operatorsListEl.innerHTML = settings.operators.map(op => `
                <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                    <span>${op}</span>
                    <button onclick="handleRemoveOperator('${op}')" class="text-red-500 hover:text-red-700 font-bold">Remover</button>
                </div>
            `).join('');
}

async function handleSaveCompanyInfo(event) {
    event.preventDefault();
    if (!auth.currentUser) return;

    const newCompanyInfo = {
        name: document.getElementById('store-name').value,
        address: document.getElementById('store-address').value,
        cnpj: document.getElementById('store-cnpj').value,
        receiptMessage: document.getElementById('store-receipt-message').value,
    };

    try {
        const settingsRef = doc(db, "settings", auth.currentUser.uid);
        await setDoc(settingsRef, { companyInfo: newCompanyInfo }, { merge: true });
        settings.companyInfo = newCompanyInfo; // Update local state
        showModal('Sucesso', 'Informações da empresa salvas.');
    } catch (error) {
        console.error("Erro ao salvar informações da empresa:", error);
        showModal('Erro', 'Não foi possível salvar as informações.');
    }
}

async function handleAddOperator(event) {
    event.preventDefault();
    if (!auth.currentUser) return;

    const newOperatorName = document.getElementById('new-operator-name').value.trim();
    if (!newOperatorName) return;

    if (settings.operators.includes(newOperatorName)) {
        showModal('Operador Existente', 'Este nome de operador já existe.');
        return;
    }

    const updatedOperators = [...settings.operators, newOperatorName];

    try {
        const settingsRef = doc(db, "settings", auth.currentUser.uid);
        await setDoc(settingsRef, { operators: updatedOperators }, { merge: true });
        settings.operators = updatedOperators; // Update local state
        renderSettingsTab(); // Re-render the list
        renderCashRegisterTab(); // Update dropdowns elsewhere
        document.getElementById('add-operator-form').reset();
    } catch (error) {
        console.error("Erro ao adicionar operador:", error);
        showModal('Erro', 'Não foi possível adicionar o operador.');
    }
}

window.handleRemoveOperator = async function (operatorName) {
    if (!auth.currentUser) return;
    if (!confirm(`Tem certeza que deseja remover o operador "${operatorName}"?`)) return;

    const updatedOperators = settings.operators.filter(op => op !== operatorName);

    try {
        const settingsRef = doc(db, "settings", auth.currentUser.uid);
        await setDoc(settingsRef, { operators: updatedOperators }, { merge: true });
        settings.operators = updatedOperators; // Update local state
        renderSettingsTab(); // Re-render the list
        renderCashRegisterTab(); // Update dropdowns elsewhere
    } catch (error) {
        console.error("Erro ao remover operador:", error);
        showModal('Erro', 'Não foi possível remover o operador.');
    }
}


window.handleUndoActivity = async function (encodedLog) {
    const log = JSON.parse(atob(encodedLog));

    if (!confirm(`Tem certeza que deseja desfazer esta ação?

Tipo: ${log.type.replace(/_/g, ' ')}`)) {
        return;
    }

    try {
        switch (log.type) {
            case 'PRODUTO_ADICIONADO':
                await deleteDoc(doc(db, "products", log.details.productId));
                showModal('Ação Desfeita', `O produto "${log.details.name}" foi apagado.`);
                await logActivity('PRODUTO_DESFEITO', {
                    originalLogId: log.id,
                    productId: log.details.productId,
                    productName: log.details.name,
                    sku: log.details.sku
                }, currentShift ? currentShift.openedBy : 'Sistema');
                break;

            case 'ESTOQUE_ATUALIZADO':
                const productRef = doc(db, "products", log.details.productId);
                const productToUpdate = products.find(p => p.id === log.details.productId);
                if (productToUpdate) {
                    const revertedStock = productToUpdate.stock - log.details.quantityAdded;
                    await updateDoc(productRef, { stock: revertedStock });
                    showModal('Ação Desfeita', `O estoque de "${log.details.productName}" foi revertido para ${revertedStock}.`);
                    await logActivity('ESTOQUE_DESFEITO', {
                        originalLogId: log.id,
                        productId: log.details.productId,
                        productName: log.details.productName,
                        quantityReverted: log.details.quantityAdded,
                        newStock: revertedStock
                    }, currentShift ? currentShift.openedBy : 'Sistema');
                } else {
                    throw new Error('Produto não encontrado para reverter o estoque.');
                }
                break;

            case 'CLIENTE_ADICIONADO':
                await deleteDoc(doc(db, "customers", log.details.customerId));
                showModal('Ação Desfeita', `O cliente "${log.details.name}" foi apagado.`);
                await logActivity('CLIENTE_DESFEITO', {
                    originalLogId: log.id,
                    customerId: log.details.customerId,
                    customerName: log.details.name
                }, currentShift ? currentShift.openedBy : 'Sistema');
                break;

            default:
                showModal('Erro', 'Este tipo de ação não pode ser desfeita.');
                return;
        }

        const logRef = doc(db, "activity_log", log.id);
        await updateDoc(logRef, { undone: true });

        await loadInitialData();
        renderAll();
        changeTab('activities');

    } catch (error) {
        console.error("Erro ao desfazer atividade:", error);
        showModal('Erro ao Desfazer', 'Não foi possível reverter a ação. Verifique o console para mais detalhes.');
    }
}



// --- LÓGICA DE GESTÃO DE CAIXA ---
function updateCashRegisterStatus() {
    tabPdv.disabled = !currentShift;
}

async function updateCurrentDayInFirestore() {
    if (!currentDay || !currentDay.id) return;
    try {
        const dayRef = doc(db, "operating_days", currentDay.id);
        // Explicitly update the shifts array to ensure sales are persisted
        // Use JSON.parse(JSON.stringify()) for a deep copy to ensure Firestore compatibility
        await updateDoc(dayRef, {
            shifts: JSON.parse(JSON.stringify(currentDay.shifts)),
            status: currentDay.status // Add this line
        });
    } catch (error) {
        console.error("Erro ao atualizar o dia no Firestore:", error);
        showModal("Erro de Sincronização", "Não foi possível salvar as alterações do dia. Verifique a conexão.");
    }
}

async function handleOpenDay(event) {
    event.preventDefault();

    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Check if there is already an open day
    const q = query(collection(db, "operating_days"), where("status", "==", "open"), where("usuarioId", "==", uid), limit(1));
    const openDaySnapshot = await getDocs(q);

    if (!openDaySnapshot.empty) {
        showModal('Ação Inválida', 'Já existe um dia aberto. Feche o dia atual antes de abrir um novo.');
        return;
    }

    const initialCash = parseFloat(document.getElementById('initial-cash').value);
    const openedBy = document.getElementById('opening-user').value;
    if (isNaN(initialCash) || initialCash < 0) {
        showModal('Valor Inválido', 'Por favor, insira um valor inicial válido.');
        return;
    }

    const dayData = {
        date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        initialCash,
        shifts: [],
        status: 'open',
        usuarioId: uid
    };

    try {
        const docRef = await addDoc(collection(db, "operating_days"), dayData);
        currentDay = { ...dayData, id: docRef.id };
        await handleOpenShift(null, openedBy);
    } catch (error) {
        console.error("Erro ao abrir o dia:", error);
        showModal("Erro de Base de Dados", "Não foi possível criar o novo dia de operação.");
    }
}

async function handleOpenShift(event, user) {
    if (event) event.preventDefault();
    const openedBy = user || document.getElementById('next-opening-user').value;

    currentShift = {
        id: currentDay.shifts.length + 1,
        startTime: new Date().toISOString(),
        endTime: null,
        openedBy,
        closedBy: null,
        sales: [],
        debtPayments: []
    };
    currentDay.shifts.push(currentShift);

    await updateCurrentDayInFirestore();
    renderCashRegisterTab();
    updateCashRegisterStatus();
    showModal('Turno Aberto!', 'Você já pode iniciar as vendas.');
}

async function handleCloseShift() {
    await loadInitialData(); // Ensure currentDay is up-to-date
    if (!currentShift) return;
    const closedBy = document.getElementById('closing-user').value;

    const shiftInDay = currentDay.shifts.find(s => s.id === currentShift.id);
    if (shiftInDay) {
        shiftInDay.endTime = new Date().toISOString();
        shiftInDay.closedBy = closedBy;
    }

    currentShift = null;

    await updateCurrentDayInFirestore();
    await logActivity('TURNO_FECHADO', {
        shiftId: shiftInDay.id,
        startTime: shiftInDay.startTime,
        endTime: shiftInDay.endTime,
        openedBy: shiftInDay.openedBy,
        closedBy: shiftInDay.closedBy,
        totalSales: shiftInDay.sales.reduce((sum, sale) => sum + sale.total, 0)
    }, closedBy);
    renderCashRegisterTab();
    updateCashRegisterStatus();
    showModal('Turno Fechado', 'O próximo operador pode iniciar um novo turno ou o dia pode ser fechado.');
}

async function handleCloseDay() {
    await loadInitialData(); // Ensure currentDay is up-to-date
    if (!currentDay || currentShift) {
        showModal('Ação Inválida', 'Feche o turno atual antes de fechar o dia.');
        return;
    }
    currentDay.status = 'closed';

    try {
        // Capture data needed for logging before nulling currentDay/currentShift
        const dayToLog = { ...currentDay }; // Create a copy
        const shiftToLog = currentShift ? { ...currentShift } : null; // Create a copy if exists

        await updateCurrentDayInFirestore();
        currentDay = null;
        currentShift = null;
        await loadInitialData();

        await logActivity('DIA_FECHADO', {
            dayId: dayToLog.id,
            date: dayToLog.date,
            initialCash: dayToLog.initialCash,
            totalSales: dayToLog.shifts.flatMap(s => s.sales).reduce((sum, sale) => sum + sale.total, 0),
            totalDebtPayments: dayToLog.shifts.flatMap(s => s.debtPayments).reduce((sum, p) => sum + p.amount, 0)
        }, shiftToLog ? shiftToLog.openedBy : 'Sistema'); // Use 'Sistema' if no shift is active

        renderCashRegisterTab();
        updateCashRegisterStatus();
        renderReportsTab();
        showModal('Dia Fechado', 'O dia de operações foi encerrado e o relatório salvo com sucesso.');
        changeTab('reports');
    } catch (error) {
        console.error("Erro ao fechar o dia:", error);
        showModal("Erro de Base de Dados", `Não foi possível salvar o relatório do dia. Por favor, tente novamente. Detalhes: ${error.message || error}`);
        if (currentDay) { // Only revert status if currentDay is not null
            currentDay.status = 'open';
        }
    }
}

// --- LÓGICA DE CLIENTES E FIADO ---
async function handleAddCustomer(event) {
    event.preventDefault();
    if (!auth.currentUser) return;

    const name = document.getElementById('new-customer-name').value.trim();
    const phone = document.getElementById('new-customer-phone').value.trim();
    const debt = parseFloat(document.getElementById('new-customer-debt').value) || 0;
    if (!name) {
        showModal('Erro', 'O nome do cliente é obrigatório.');
        return;
    }
    const newCustomer = { name, phone, debt, usuarioId: auth.currentUser.uid };
    try {
        const docRef = await addDoc(collection(db, "customers"), newCustomer);
        await logActivity('CLIENTE_ADICIONADO', { customerId: docRef.id, name, phone }, currentShift ? currentShift.openedBy : 'Sistema');
        await loadInitialData();
        renderDebtorsList();
        document.getElementById('add-customer-form').reset();
        showModal('Sucesso!', 'Novo cliente cadastrado.');
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showModal('Erro de Base de Dados', 'Não foi possível guardar o cliente.');
    }
}

function renderDebtorsList() {
    const debtorsListEl = document.getElementById('debtors-list');
    if (!debtorsListEl) return;

    const debtors = customers.filter(c => c.id !== '1'); // Exclui o cliente padrão
    const totalDebt = debtors.reduce((sum, c) => sum + (c.debt || 0), 0);
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
                                <td class="p-3 font-bold ${c.debt > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(c.debt || 0)}</td>
                                <td class="p-3 text-center space-x-2">
                                    <button onclick="openDebtPaymentModal('${c.id}')" class="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">Receber</button>
                                    <button onclick="openEditCustomerModal('${c.id}')" class="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-gray-200">Editar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
}

window.openDebtPaymentModal = function (customerId) {
    if (!currentShift) {
        showModal('Caixa Fechado', 'É necessário abrir um turno para receber pagamentos de dívidas.');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;
    if ((customer.debt || 0) <= 0) {
        showModal('Informação', 'Este cliente não possui dívidas.');
        return;
    }

    document.getElementById('debt-customer-id').value = customer.id;
    document.getElementById('debt-customer-name').textContent = customer.name;
    document.getElementById('debt-customer-current-debt').textContent = formatCurrency(customer.debt || 0);
    document.getElementById('debt-payment-amount').max = customer.debt || 0;
    document.getElementById('debt-payment-amount').value = (customer.debt || 0).toFixed(2);

    debtPaymentModal.classList.remove('hidden');
}

window.closeDebtPaymentModal = function () {
    debtPaymentModal.classList.add('hidden');
}

async function handleConfirmDebtPayment() {
    const customerId = document.getElementById('debt-customer-id').value;
    const customerRef = doc(db, "customers", customerId);

    const amount = parseFloat(document.getElementById('debt-payment-amount').value);
    const method = document.getElementById('debt-payment-method').value;

    const customer = customers.find(c => c.id === customerId);
    if (!customer || isNaN(amount) || amount <= 0 || amount > (customer.debt || 0)) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }

    const newDebt = (customer.debt || 0) - amount;

    try {
        await updateDoc(customerRef, { debt: newDebt });
        if (currentShift) {
            currentShift.debtPayments.push({ customerId, customerName: customer.name, amount, method });
            await updateCurrentDayInFirestore();
        }
        await logActivity('PAGAMENTO_DIVIDA', {
            customerId: customer.id,
            customerName: customer.name,
            amount: amount,
            method: method
        }, currentShift.openedBy);
        await loadInitialData();
        renderDebtorsList();
        closeDebtPaymentModal();
        showModal('Pagamento Recebido', `${formatCurrency(amount)} foram abatidos da dívida de ${customer.name}.`);
    } catch (error) {
        console.error("Erro ao atualizar dívida:", error);
        showModal("Erro de Base de Dados", "Não foi possível atualizar a dívida do cliente.");
    }
}

window.openEditCustomerModal = function (customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('edit-customer-id').value = customer.id;
    document.getElementById('edit-customer-name').value = customer.name;
    document.getElementById('edit-customer-phone').value = customer.phone || '';
    document.getElementById('edit-customer-debt').value = (customer.debt || 0).toFixed(2);

    editCustomerModal.classList.remove('hidden');
}

window.closeEditCustomerModal = function () {
    editCustomerModal.classList.add('hidden');
}

async function handleUpdateCustomer() {
    const customerId = document.getElementById('edit-customer-id').value;
    if (!customerId) {
        showModal('Erro de Cliente', 'A ID do cliente não foi encontrada. Não é possível atualizar.');
        return;
    }
    const customerRef = doc(db, "customers", customerId);

    const name = document.getElementById('edit-customer-name').value.trim();
    const phone = document.getElementById('edit-customer-phone').value.trim();
    const debt = parseFloat(document.getElementById('edit-customer-debt').value) || 0;

    try {
        await updateDoc(customerRef, { name, phone, debt });
        await logActivity('CLIENTE_ATUALIZADO', { customerId, name, phone }, currentShift ? currentShift.openedBy : 'Sistema');
        await loadInitialData();
        renderDebtorsList();
        closeEditCustomerModal();
        showModal('Sucesso', 'Dados do cliente atualizados.');
    } catch (error) {
        console.error("Erro ao atualizar cliente:", error);
        showModal("Erro de Base de Dados", "Não foi possível atualizar os dados do cliente.");
    }
}


// --- LÓGICA DE VENDA E PAGAMENTO ---
export function resetPdv() {
    cart.length = 0; // Modify the array in place
    renderCart();
    const barcodeInput = document.getElementById('barcode-input-field');
    if (barcodeInput) {
        barcodeInput.focus();
    }
}

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
    // Check for scale barcode (starts with '2')
    if (scannedCode.startsWith('2') && scannedCode.length >= 12) { // Assuming 12 digits after '2' for SKU and price
        const skuPart = scannedCode.substring(1, 6); // Digits 1-5 for SKU
        const pricePart = scannedCode.substring(6, 11); // Digits 6-10 for price
        const price = parseFloat(pricePart) / 100; // Assuming last two digits are cents

        const product = products.find(p => p.sku === skuPart);

        if (product) {
            // Create a temporary product object with the scanned price
            const productWithScalePrice = { ...product, price: price };
            addToCart(productWithScalePrice.sku, productWithScalePrice.price); // Pass price to addToCart
        } else {
            showModal('Produto da Balança não encontrado', `Nenhum produto corresponde ao SKU '${skuPart}' do código de balança.`);
        }
    } else {
        // Existing logic for regular barcodes
        const product = products.find(p => p.barcode === scannedCode);
        if (product) {
            addToCart(product.sku);
        } else {
            // Open the new product modal for on-the-fly addition
            openAddProductPdvModal(scannedCode);
        }
    }
}

export function addToCart(sku, scannedPrice = null) { // Added scannedPrice parameter
    const product = products.find(p => p.sku === sku);

    if (!product) {
        console.error(`Produto com SKU "${sku}" não foi encontrado na lista de produtos carregada.`);
        showModal("Erro de Produto", `Não foi possível adicionar o item ao carrinho porque o produto com SKU ${sku} não foi encontrado. Isso pode ser um erro de sincronização. Tente recarregar a página.`);
        return;
    }

    const cartItem = cart.find(item => item.sku === sku);
    const availableStock = product.stock - (cartItem ? cartItem.quantity : 0);
    if (availableStock <= 0) {
        showModal('Estoque Insuficiente', `Não há mais estoque para ${product.name}.`);
        return;
    }
    if (cartItem) {
        cartItem.quantity++;
        if (scannedPrice !== null) { // Update price if provided by scale
            cartItem.price = scannedPrice;
        }
    } else {
        cart.push({ ...product, quantity: 1, price: scannedPrice !== null ? scannedPrice : product.price }); // Use scannedPrice if available
    }
    renderCart();
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const checkoutButton = document.getElementById('checkout-button');
    const cartTotalEl = document.getElementById('cart-total');
    if (!cartItemsEl || !checkoutButton || !cartTotalEl) return;
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center pt-16">Carrinho vazio.</p>';
        checkoutButton.disabled = true;
    } else {
        cartItemsEl.innerHTML = '';
        cart.forEach(item => {
            cartItemsEl.innerHTML += `
                        <div class="flex items-center mb-3 p-2 bg-white rounded-lg shadow-sm">
                            <div class="flex-grow">
                                <p class="font-semibold">${item.name}</p>
                                <p class="text-sm text-gray-500">${formatCurrency(item.price)} x ${item.quantity} = ${formatCurrency(item.price * item.quantity)}</p>
                            </div>
                            <div class="flex items-center">
                                <button onclick="updateCartQuantity('${item.sku}', -1)" class="w-8 h-8 bg-gray-200 rounded-full font-bold text-lg">-</button>
                                <span class="w-12 text-center font-semibold text-lg">${item.quantity}</span>
                                <button onclick="updateCartQuantity('${item.sku}', 1)" class="w-8 h-8 bg-gray-200 rounded-full font-bold text-lg">+</button>
                                <button onclick="removeFromCart('${item.sku}')" class="ml-4 w-8 h-8 bg-red-100 text-red-600 rounded-full font-bold text-lg hover:bg-red-200">X</button>
                            </div>
                        </div>`;
        });
        checkoutButton.disabled = false;
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalEl.textContent = formatCurrency(total);
}

window.updateCartQuantity = function (sku, change) {
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
    if (cartItem.quantity <= 0) {
        const itemIndex = cart.findIndex(item => item.sku === sku);
        if (itemIndex > -1) {
            cart.splice(itemIndex, 1);
        }
    }
    if (cart.length === 0) resetPdv();
    renderCart();
}

window.removeFromCart = function (sku) {
    const itemIndex = cart.findIndex(item => item.sku === sku);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1);
    }
    if (cart.length === 0) resetPdv();
    renderCart();
}

function handleCheckout() {
    if (cart.length === 0) return;
    saleInProgress = {
        items: JSON.parse(JSON.stringify(cart)),
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        payments: [],
        customerId: '1',
    };
    selectedPaymentMethod = 'Dinheiro';
    renderPaymentModal();
    paymentModal.classList.remove('hidden');
    setTimeout(() => paymentModal.querySelector('div').classList.add('scale-100'), 10);
}

function renderPaymentModal() {
    const total = parseFloat(saleInProgress.total.toFixed(2));
    const totalPaid = parseFloat(saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const change = totalPaid > total ? totalPaid - total : 0;
    const customerId = document.getElementById('payment-modal-customer-select')?.value || saleInProgress.customerId;

    document.getElementById('payment-modal-total').textContent = formatCurrency(total);
    document.getElementById('payment-modal-paid-amount').textContent = formatCurrency(totalPaid);
    document.getElementById('payment-modal-change').textContent = formatCurrency(change);

    const customerSelect = document.getElementById('payment-modal-customer-select');
    const customerOptions = customers.filter(c => c.id !== '1').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    customerSelect.innerHTML = `<option value="1">Consumidor</option>${customerOptions}`;
    customerSelect.value = customerId;

    document.getElementById('payment-modal-cart-summary').innerHTML = saleInProgress.items.map(i => `<div>${i.quantity}x ${i.name}</div>`).join('');
    document.getElementById('payment-modal-payments-list').innerHTML = saleInProgress.payments.map(p => `<div class="flex justify-between bg-white p-1 rounded"><span>${p.method}</span><span class="font-semibold">${formatCurrency(p.amount)}</span></div>`).join('');

    const remainingAmount = total - totalPaid;
    document.getElementById('payment-amount').value = (remainingAmount > 0) ? remainingAmount.toFixed(2).replace('.', ',') : '';

    let saleCanBeConfirmed = false;
    if (selectedPaymentMethod === 'Fiado') {
        saleCanBeConfirmed = customerId !== '1';
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

function handleAddPayment(event) {
    event.preventDefault();
    const amount = parseCurrency(document.getElementById('payment-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }
    saleInProgress.payments.push({ method: selectedPaymentMethod, amount });
    renderPaymentModal();
}

window.closePaymentModal = function () {
    paymentModal.querySelector('div').classList.remove('scale-100');
    setTimeout(() => paymentModal.classList.add('hidden'), 200);
}

window.openDiversosModal = function () {
    diversosModal.classList.remove('hidden');
}

window.closeDiversosModal = function () {
    diversosModal.classList.add('hidden');
}

function addDiversosToCart(itemName, itemPrice) {
    const cartItem = {
        sku: `DIVERSOS-${itemName.toUpperCase()}-${Date.now()}`,
        name: `Diversos - ${itemName}`,
        price: itemPrice,
        quantity: 1,
        stock: Infinity,
        minStock: 0
    };
    cart.push(cartItem);
    renderCart();
    closeDiversosModal();
}

function handleDiversosItemClick(e) {
    if (e.target.classList.contains('diversos-item-btn')) {
        const itemName = e.target.dataset.item;
        const priceStr = prompt(`Digite o valor para "${itemName}":`);
        const price = parseFloat(priceStr);

        if (!isNaN(price) && price > 0) {
            addDiversosToCart(itemName, price);
        } else if (priceStr !== null) {
            showModal('Valor Inválido', 'Por favor, insira um preço válido.');
        }
    }
}

async function confirmSale() {
    const customerId = document.getElementById('payment-modal-customer-select').value;
    saleInProgress.customerId = customerId;

    if (selectedPaymentMethod === 'Fiado') {
        if (customerId === "1") {
            showModal('Ação Inválida', 'Selecione um cliente cadastrado para vendas a fiado.');
            return;
        }
        const customerRef = doc(db, "customers", customerId);
        const customer = customers.find(c => c.id === customerId);
        const newDebt = (customer.debt || 0) + saleInProgress.total;
        await updateDoc(customerRef, {
            debt: newDebt
        });
        saleInProgress.payments = [{
            method: 'Fiado',
            amount: saleInProgress.total
        }];
    }

    // Find the current active shift within currentDay.shifts
    const activeShift = currentDay.shifts.find(s => !s.endTime);
    if (!activeShift) {
        showModal('Erro', 'Nenhum turno ativo encontrado para registrar a venda.');
        return;
    }

    saleInProgress.id = (activeShift.sales.length + 1);
    saleInProgress.date = new Date().toISOString();
    activeShift.sales.push(saleInProgress); // Push to the found active shift

    await updateCurrentDayInFirestore(); // Persist sales immediately

    const lowStockProducts = [];
    // Update stock in Firestore
    for (const cartItem of saleInProgress.items) {
        // --- CORREÇÃO APLICADA AQUI ---
        // Verificamos se o item possui um 'id'. Itens "Diversos" não possuem,
        // então o código dentro deste 'if' será ignorado para eles.
        if (cartItem.id) {
            const productRef = doc(db, "products", cartItem.id);
            const newStock = cartItem.stock - cartItem.quantity;
            await updateDoc(productRef, {
                stock: newStock
            });
            if (newStock <= cartItem.minStock) {
                lowStockProducts.push(cartItem.name);
            }
        }
    }

    const totalPaid = saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0);
    const change = totalPaid > saleInProgress.total ? totalPaid - saleInProgress.total : 0;

    const customer = customers.find(c => c.id === saleInProgress.customerId);
    await logActivity('VENDA_CRIADA', {
        saleId: saleInProgress.id,
        shiftId: currentShift.id,
        total: saleInProgress.total,
        customerName: customer ? customer.name : 'Consumidor',
        items: saleInProgress.items.map(i => `${i.quantity}x ${i.name}`)
    }, currentShift.openedBy);

    await loadInitialData();
    renderAll();
    resetPdv();
    closePaymentModal();

    let warning = '';
    if (lowStockProducts.length > 0) {
        warning = `Atenção: ${lowStockProducts.join(', ')} atingiu/atingiram o estoque mínimo.`;
    }
    renderReceipt(saleInProgress, change, warning);
}

function renderReceipt(saleData, change, warning = '') {
    const ci = settings.companyInfo;
    document.getElementById('receipt-store-name').textContent = ci.name;
    document.getElementById('receipt-store-address').textContent = ci.address;
    document.getElementById('receipt-store-cnpj').textContent = ci.cnpj;
    document.getElementById('receipt-store-message').textContent = ci.receiptMessage;

    document.getElementById('receipt-date').textContent = formatDateTime(saleData.date);
    document.getElementById('receipt-sale-id').textContent = saleData.id;
    document.getElementById('receipt-shift-id').textContent = currentShift.id;

    const customer = customers.find(c => c.id === saleData.customerId);
    document.getElementById('receipt-customer').textContent = customer ? customer.name : 'Consumidor';

    const itemsEl = document.getElementById('receipt-items');
    itemsEl.innerHTML = '';
    saleData.items.forEach(item => {
        const itemHTML = `
                    <div>
                        <p>${item.quantity}x ${item.name}</p>
                        <p class="text-right">${formatCurrency(item.price * item.quantity)}</p>
                    </div>
                `;
        itemsEl.innerHTML += itemHTML;
    });

    document.getElementById('receipt-total').textContent = formatCurrency(saleData.total);

    const paymentsEl = document.getElementById('receipt-payments');
    paymentsEl.innerHTML = '';
    saleData.payments.forEach(p => {
        paymentsEl.innerHTML += `<p>${p.method}: <span>${formatCurrency(p.amount)}</span></p>`;
    });

    document.getElementById('receipt-change').textContent = formatCurrency(change);

    const warningArea = document.getElementById('receipt-warning-area');
    const warningMessageEl = document.getElementById('receipt-warning-message');
    if (warning) {
        warningMessageEl.textContent = warning;
        warningArea.classList.remove('hidden');
    } else {
        warningArea.classList.add('hidden');
    }

    receiptModal.classList.remove('hidden');
    receiptModal.querySelector('div').classList.add('scale-100');
}

function printReceipt() {
    window.print();
}

function closeReceiptModal() {
    receiptModal.querySelector('div').classList.remove('scale-100');
    setTimeout(() => receiptModal.classList.add('hidden'), 200);
}

async function handleOpenDrawer(silent = false) {
    // This function sends a request to a local service that you would need to create.
    // This service would be responsible for sending the actual command to the cash drawer.
    try {
        const response = await fetch('http://localhost:9100/open-drawer', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!silent) {
            showModal('Comando Enviado', 'Um comando para abrir a gaveta foi enviado.');
        }
    } catch (error) {
        console.error('Error opening cash drawer:', error);
        // Only show error modal if not in silent mode.
        // The console error is enough for debugging when printing.
        if (!silent) {
            showModal(
                'Erro de Comunicação',
                'Não foi possível comunicar com o serviço local da gaveta.',
                'Verifique se o programa da gaveta está rodando e se a porta está correta (Ex: http://localhost:9100).'
            );
        }
    }
}

// --- OUTRAS LÓGICAS ---
function renderProductList() {
    const productListEl = document.getElementById('product-list');
    if (!productListEl) return;
    productListEl.innerHTML = '';
    products.forEach(product => {
        const productInStock = product.stock > 0;
        const productDiv = document.createElement('div');
        productDiv.className = `border rounded-lg p-3 flex flex-col justify-between ${!productInStock ? 'bg-gray-100 opacity-60' : 'bg-white'}`;

        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `<p class="font-bold">${product.name}</p><p class="text-gray-600">${formatCurrency(product.price)}</p>`;

        const addButton = document.createElement('button');
        addButton.textContent = 'Adicionar ao Carrinho';
        addButton.className = `mt-3 w-full text-sm font-bold py-2 rounded-md ${productInStock ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`;
        addButton.disabled = !productInStock;

        if (productInStock) {
            addButton.addEventListener('click', () => addToCart(product.sku));
        }

        productDiv.appendChild(infoDiv);
        productDiv.appendChild(addButton);
        productListEl.appendChild(productDiv);
    });
}

function renderInventoryManagement() {
    const inventoryManagementTableBodyEl = document.getElementById('inventory-management-table-body');
    if (!inventoryManagementTableBodyEl) return;
    inventoryManagementTableBodyEl.innerHTML = '';

    const sortedProducts = [...products].sort((a, b) => {
        const aIsLow = a.stock <= a.minStock;
        const bIsLow = b.stock <= b.minStock;
        if (aIsLow && !bIsLow) return -1;
        if (!aIsLow && bIsLow) return 1;
        return a.name.localeCompare(b.name);
    });

    sortedProducts.forEach(product => {
        const isLowStock = product.stock <= product.minStock;
        const rowClass = isLowStock ? 'bg-red-50' : '';
        const textClass = isLowStock ? 'text-red-600 font-bold' : '';

        inventoryManagementTableBodyEl.innerHTML += `
                    <tr class="${rowClass}">
                        <td class="p-3">${product.name}</td>
                        <td class="p-3 text-center ${textClass}">${product.stock}</td>
                    </tr>
                `;
    });
}

async function handleAddProduct(event) {
    event.preventDefault();
    if (!auth.currentUser) return;

    const sku = document.getElementById('new-sku').value.trim();
    const barcode = document.getElementById('new-barcode').value.trim();
    // NEW: Barcode validation
    if (barcode !== '') {
        if (!/^\d+$/.test(barcode)) {
            showModal('Erro de Código de Barras', 'O código de barras deve conter apenas números.');
            return;
        }
        if (barcode.length !== 13) {
            showModal('Erro de Código de Barras', 'O código de barras deve ter 13 dígitos (padrão EAN-13).');
            return;
        }
    }
    const name = document.getElementById('new-name').value.trim();
    const price = parseFloat(document.getElementById('new-price').value);
    const stock = parseInt(document.getElementById('new-stock').value);
    const minStock = parseInt(document.getElementById('new-min-stock').value);

    if (!sku || !name || isNaN(price) || isNaN(stock) || isNaN(minStock)) {
        showModal('Erro', 'Preencha todos os campos obrigatórios.');
        return;
    }

    // Verificação de SKU duplicado
    const existingProduct = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
    if (existingProduct) {
        showModal('SKU Duplicado', `O SKU "${sku}" já está sendo utilizado pelo produto "${existingProduct.name}". Por favor, use um código diferente.`);
        return;
    }

    const newProduct = { sku, barcode, name, price, stock, minStock, usuarioId: auth.currentUser.uid };

    try {
        const docRef = await addDoc(collection(db, "products"), newProduct);
        await logActivity('PRODUTO_ADICIONADO', {
            productId: docRef.id,
            sku: newProduct.sku,
            name: newProduct.name,
            price: newProduct.price,
            stock: newProduct.stock
        }, currentShift ? currentShift.openedBy : 'Sistema');
        showModal('Sucesso!', 'Produto adicionado à base de dados.');
        document.getElementById('add-product-form').reset();
        await loadInitialData();
        renderInventoryManagement();
    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        showModal('Erro de Base de Dados', 'Não foi possível guardar o produto.');
    }
}

async function updateProductStock(productId, quantityToAdd) {
    try {
        const productRef = doc(db, "products", productId);
        const product = products.find(p => p.id === productId);
        if (product) {
            const newStock = product.stock + quantityToAdd;
            await updateDoc(productRef, { stock: newStock });
            await logActivity('ESTOQUE_ATUALIZADO', {
                productId: product.id,
                productName: product.name,
                quantityAdded: quantityToAdd,
                newStock
            }, currentShift ? currentShift.openedBy : 'Sistema');
            await loadInitialData();
            renderInventoryManagement();
            showModal('Sucesso', `${quantityToAdd} unidades de ${product.name} adicionadas ao estoque.`);
        }
    } catch (error) {
        console.error("Erro ao atualizar estoque:", error);
        showModal('Erro de Base de Dados', 'Não foi possível atualizar o estoque do produto.');
    }
}

async function handleInventoryBarcode(barcode) {
    if (!barcode || barcode.trim() === '') return;

    const product = products.find(p => p.barcode === barcode.trim());
    if (product) {
        const quantityStr = prompt(`Produto encontrado: ${product.name}
Estoque atual: ${product.stock}

Qual a quantidade a adicionar?`);
        const quantity = parseInt(quantityStr);
        if (!isNaN(quantity) && quantity > 0) {
            await updateProductStock(product.id, quantity);
        } else if (quantityStr !== null) {
            showModal('Erro', 'Quantidade inválida.');
        }
    } else {
        if (confirm(`Produto com código de barras "${barcode}" não encontrado.
Deseja cadastrá-lo agora?`)) {
            changeTab('inventory');
            document.getElementById('new-barcode').value = barcode.trim();
            document.getElementById('new-sku').focus();
        }
    }
}



// --- BARCODE SCANNER LOGIC ---

const scannerModal = document.getElementById('scanner-modal');

// Function to be called on successful scan
function onScanSuccess(decodedText, decodedResult, successCallback) {
    console.log(`Code matched = ${decodedText}`, decodedResult);

    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner.", error);
        });
        html5QrcodeScanner = null;
    }

    scannerModal.classList.add('hidden');

    if (successCallback) {
        successCallback(decodedText);
    }
}

// Function to close the scanner modal manually
window.closeScannerModal = function () {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner.", error);
        });
        html5QrcodeScanner = null;
    }
    scannerModal.classList.add('hidden');
}

// Generic function to start the scanner
function startScanner(successCallback) {
    scannerModal.classList.remove('hidden');

    // The library is loaded globally, so we can use it directly.
    // We create a new instance every time to ensure the camera is requested.
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        videoConstraints: {
            facingMode: "environment"
        }
    };

    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        config,
        /* verbose= */ false
    );

    html5QrcodeScanner.render((decodedText, decodedResult) => onScanSuccess(decodedText, decodedResult, successCallback), (errorMessage) => {
        // console.warn(`Code scan error = ${errorMessage}`);
    });
}

// Specific callback for PDV scan
function onPdvScanSuccess(decodedText) {
    handleBarcodeScan(decodedText);
    const barcodeInput = document.getElementById('barcode-input-field');
    if (barcodeInput) {
        barcodeInput.value = decodedText;
    }
}

// Specific callback for Inventory scan
function onInventoryScanSuccess(decodedText) {
    handleInventoryBarcode(decodedText);
    const inventoryBarcode = document.getElementById('inventory-barcode-input');
    if (inventoryBarcode) {
        inventoryBarcode.value = decodedText;
        inventoryBarcode.focus();
    }
}

// --- END BARCODE SCANNER LOGIC ---

// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Static Listeners (these elements are always in the DOM) ---
    loginForm.addEventListener('submit', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    forgotPasswordLink.addEventListener('click', handleForgotPassword);
    addPaymentForm.addEventListener('submit', handleAddPayment);
    confirmSaleButton.addEventListener('click', confirmSale);

    document.getElementById('update-customer-button')?.addEventListener('click', handleUpdateCustomer);
    document.getElementById('confirm-debt-payment-button')?.addEventListener('click', handleConfirmDebtPayment);
    document.getElementById('print-receipt-button').addEventListener('click', printReceipt);
    document.getElementById('close-receipt-button').addEventListener('click', closeReceiptModal);
    document.getElementById('open-drawer-button').addEventListener('click', handleOpenDrawer);

    // --- Event Delegation for Dynamic Content ---
    document.getElementById('open-day-form')?.addEventListener('submit', handleOpenDay);
    document.getElementById('close-shift-button')?.addEventListener('click', handleCloseShift);
    document.getElementById('open-shift-form')?.addEventListener('submit', handleOpenShift);
    document.getElementById('close-day-button')?.addEventListener('click', handleCloseDay);

    contentPdv.addEventListener('click', function (e) {
        if (e.target.id === 'start-sale-button') startNewSale(e);
        if (e.target.id === 'checkout-button') handleCheckout(e);
        if (e.target.id === 'cancel-sale-button') resetPdv();
        if (e.target.id === 'diversos-button') openDiversosModal();
        if (e.target.id === 'pdv-scan-button') {
            startScanner(onPdvScanSuccess);
        }
    });
    contentPdv.addEventListener('keypress', function (e) {
        if (e.target.id === 'barcode-input-field') handleBarcodeKeypress(e);
    });

    contentInventory.addEventListener('submit', function (e) {
        if (e.target.id === 'add-product-form') handleAddProduct(e);
    });
    contentInventory.addEventListener('click', function (e) {
        if (e.target.id === 'inventory-scan-button') {
            startScanner(onInventoryScanSuccess);
        }
    });
    contentInventory.addEventListener('keypress', function (e) {
        if (e.target.id === 'inventory-barcode-input' && e.key === 'Enter') {
            e.preventDefault();
            handleInventoryBarcode(e.target.value.trim());
            e.target.value = '';
        }
    });

    contentCustomers.addEventListener('submit', function (e) {
        if (e.target.id === 'add-customer-form') handleAddCustomer(e);
    });

    // NEW: Settings event listeners
    contentSettings.addEventListener('submit', function (e) {
        if (e.target.id === 'company-info-form') handleSaveCompanyInfo(e);
        if (e.target.id === 'add-operator-form') handleAddOperator(e);
    });

    paymentModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-method-btn')) {
            selectedPaymentMethod = e.target.dataset.method;
            renderPaymentModal();
        }
    });

    document.getElementById('payment-modal-customer-select').addEventListener('change', renderPaymentModal);

    document.getElementById('diversos-options').addEventListener('click', handleDiversosItemClick);

    debtPaymentModal.addEventListener('click', (e) => {
        if (e.target.id === 'pay-full-debt-button') {
            const customerId = document.getElementById('debt-customer-id').value;
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                document.getElementById('debt-payment-amount').value = (customer.debt || 0).toFixed(2).replace('.', ',');
            }
        }
    });


});