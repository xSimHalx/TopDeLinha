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
let settings = {};
let html5QrcodeScanner = null;
let selectedCustomerForPayment = null;
let areDebtsVisible = true; // Controla a visibilidade dos valores de dívida
let selectedCustomerForSale = '1'; // Mantém o cliente selecionado entre as vendas


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
function debounce(func, delay = 400) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => { func.apply(this, args); }, delay);
    };
}
export const formatCurrency = (value) => {
    // Garante que o valor é um número antes de formatar
    if (typeof value !== 'number') {
        value = Number(value) || 0;
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
export const parseCurrency = (value) => {
    if (typeof value !== 'string') {
        return Number(value) || 0;
    }

    // Remove tudo exceto dígitos, pontos e vírgulas
    let cleaned = value.replace(/[^0-9.,]/g, '');

    // Verifica qual é o último separador: ponto ou vírgula
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    // Se a vírgula for o último separador (formato pt-BR: 1.234,56)
    if (lastComma > lastDot) {
        // Remove os pontos (milhares) e troca a vírgula (decimal) por ponto
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Se o ponto for o último separador (formato US: 1,234.56) ou se não houver vírgula
    else if (lastDot > lastComma) {
        // Apenas remove as vírgulas (milhares)
        cleaned = cleaned.replace(/,/g, '');
    }
    // Se não houver separadores, não faz nada.

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

const releaseNotes = [

    {
        version: '1.9.0',
        date: '16/09/2025', // <-- Pode ajustar para a data de hoje
        notes: [
            'Reformulação completa da aba "Clientes" com um design mais limpo e profissional.',
            'Funcionalidades "Adicionar Cliente" e "Recebimento Rápido" foram movidas para janelas (modais) dedicadas para uma melhor experiência de uso (UI/UX).',
            'Implementada barra de pesquisa em tempo real na lista de clientes, permitindo filtrar por nome ou telefone.',
            'Adicionado botão de "olho" (👁️) para mostrar/ocultar todos os valores de dívida na aba Clientes, garantindo maior privacidade.',
            'O extrato do cliente agora mostra os itens detalhados de cada venda a fiado, e não apenas o valor total.',
            'Adicionado botão "+" para registar dívidas manuais a um cliente (ex: dívidas antigas), com registo no histórico.',
            'O recebimento de dívidas (tanto o rápido como o manual da lista) agora calcula o troco para pagamentos em excesso.',
            'Abertura automática da gaveta foi integrada ao receber pagamentos de dívidas em dinheiro.',
            'Geração de um "Comprovativo de Pagamento" específico para dívidas, separado do recibo de venda.',
            'Correção de bug crítico que fazia a página recarregar ao pressionar a tecla "Enter" em certos campos.'
        ]
    }, {

        version: '1.8.0',
        date: '15/09/2025',
        notes: [
            'Adicionado escaneamento de código de barras com a câmera na aba de Estoque (Visão Geral e Entrada Rápida).',
            'Melhoria na pesquisa de produtos na aba de Estoque, agora é possível buscar por código de barras além do nome e SKU.',
            'Correção de bug na validação do código de barras ao adicionar novo produto.',
            'Adicionado função de de editar produto diretamente na tabela de estoque.',
            'Adicionado função de deletar produto diretamente na tabela de estoque.',
            'Adicionado confirmação ao deletar produto.',
            'Melhoria na usabilidade do scanner de código de barras, com foco automático no campo de entrada após cada escaneamento.',
            'tradução de mais elementos da interface para Português (Brasil).',
            'Melhoria na performance geral do sistema.',
            'Correção de bugs menores e melhorias na interface.',
            'Adicionado o valor do produto na aba de estoque (Visão Geral).'

        ]
    }, {
        version: '1.7.0',
        date: '14/09/2025',
        notes: [
            'Melhoria de adicionar item ao estoque',
            'Agora o sistema permite adicionar itens ao estoque através da busca por nome, facilitando a reposição rápida de produtos.',
            'Somente codigo de barras com (8,12,13 ou sem codigo de barras) digitos são aceitos',
            'Validação de SKU, Nome e Código de Barras duplicado ao adicionar novo produto.',
            'Correção de bug na validação do código de barras ao adicionar novo produto.'

        ]
    }, {

        version: '1.6.1',
        date: '13/09/2025',
        notes: [
            'Corrigido bug que impedia o botão "Confirmar Venda" de ser habilitado quando o valor pago era exatamente igual ao total, devido a problemas de arredondamento.'
        ]
    }, {
        version: '1.6.0',
        date: '12/09/2025',
        notes: [
            'Reorganizados os botões na tela de PDV para melhor usabilidade.',
            'Adicionado botão "Escanear" com a câmera no PDV.'
        ]
    }, {
        version: '1.5.0',
        date: '11/09/2025',
        notes: [
            'Adicionado botão [X] para remover itens diretamente do carrinho.',
            'Melhorada a visualização dos itens no carrinho com mais detalhes.',
            'Corrigido bug crítico na venda a fiado que impedia a finalização da venda.',
            'Corrigido um bug que poderia ocorrer ao tentar atualizar um cliente sem um ID válido.',
            'Melhorada a robustez da função de atualização de clientes.',
            'Adicionada opção de pagamento "Fiado" no modal de pagamento.',
            'Corrigido o botão "Diversos" que não estava funcionando corretamente.',
            'Adicionado botão "Diversos" no PDV para adicionar itens não cadastrados com valor customizado.',
            'Corrigido o botão "Cancelar Venda" que não estava funcionando corretamente.',
            'Adicionada validação para o campo de código de barras, exigindo 13 dígitos para o padrão EAN-13, além de verificar se contém apenas números.',
            'Adicionada validação para o campo de código de barras ao adicionar um novo produto, garantindo que contenha apenas números ou seja deixado em branco.'
        ]
    },
    {
        version: '1.4.0',
        date: '10/09/2025',
        notes: [
            'Adicionada opção de pesquisa de produto por nome na aba Frente de Caixa (PDV).',
            'Implementada leitura de códigos de barra de balança (iniciados com \'2\') para extrair SKU e preço.'
        ]
    },
    {
        version: '1.3.0',
        date: '10/09/2025',
        notes: [
            'Limites de historico de atividades aumentado, de 50 para 300'
        ]
    },
    {
        version: '1.2.0',
        date: '10/09/2025',
        notes: [
            'Adicionado filtro de data na aba de relatórios.',
            'Alterada a ordem de exibição do log de atividades para mostrar os itens mais recentes primeiro.'
        ]
    },
    {
        version: '1.1.0',
        date: '10/09/2025',
        notes: [
            'Adicionada seção de "Novidades da Versão" ao Painel.',
            'Corrigido o alerta de estoque baixo no painel para usar o valor mínimo definido por produto.',
            'Adicionado aviso de estoque mínimo no recibo após a venda.'
        ]
    },
    {
        version: '1.0',
        date: '09/09/2025',
        notes: [
            'Lançamento inicial do sistema PDV.',
            'Implementado scanner de código de barras com a câmera, com preferência para a câmera traseira.',
            'Tradução de mais elementos da interface para Português (Brasil).'
        ]
    }
];

function renderReleaseNotes() {
    const container = document.getElementById('release-notes-container');
    if (!container) return;

    container.innerHTML = releaseNotes.map((release, index) => {
        const isLatest = index === 0;

        const cardClasses = isLatest 
            ? 'bg-blue-50 border-blue-200' // Usando a cor azul que sugerimos
            : 'bg-white border-gray-200';
        
        const newBadge = isLatest 
            ? '<span class="ml-2 text-xs font-semibold text-white bg-blue-500 px-2 py-1 rounded-full align-middle">Mais Recente</span>'
            : '';

        return `
            <div class="p-4 rounded-lg shadow-sm border ${cardClasses} transition duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                <h4 class="font-bold text-lg text-gray-800">
                    Versão ${release.version} 
                    <span class="text-sm font-normal text-gray-500">- ${release.date}</span>
                    ${newBadge}
                </h4>
                <ul class="list-disc list-inside mt-2 space-y-1 text-gray-700">
                    ${release.notes.map(note => `<li>${note}</li>`).join('')}
                </ul>
            </div>
        `;
    }).join('');
}

function renderDashboardTab() {
    const totalSalesToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).reduce((sum, sale) => sum + sale.total, 0) : 0; // ORIGINAL: Calcula do DB
    console.log('--- PONTO 3: Total calculado para o painel ---', totalSalesToday);
    const salesCountToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).length : 0; // ORIGINAL: Conta do DB
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
                        <input type="text" id="quick-stock-search" placeholder="Buscar produto..." class="w-full p-2 border rounded-md">
                        <div id="inventory-search-results" class="mt-2 max-h-40 overflow-y-auto"></div>
                    </div>
                </div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4 border-t pt-6">Adicionar Novo Produto (Manual)</h3>
                <form id="add-product-form" class="space-y-4 bg-gray-50 p-6 rounded-lg">
                    <input type="text" id="new-sku" placeholder="Código Interno (SKU)" required class="w-full p-2 border rounded">
                    <input type="text" id="new-barcode" placeholder="Código de Barras (opcional)" class="w-full p-2 border rounded">
                    <input type="text" id="new-name" placeholder="Nome do Produto" required class="w-full p-2 border rounded">
                    <input type="tel" id="new-price" placeholder="Preço (R$)" step="0.01" min="0" required class="w-full p-2 border rounded">
                    <input type="number" id="new-stock" placeholder="Estoque Inicial" min="0" required class="w-full p-2 border rounded">
                    <input type="number" id="new-min-stock" placeholder="Estoque Mínimo" min="0" required class="w-full p-2 border rounded">
                    <button type="submit" class="w-full bg-green-600 text-white font-bold py-2 rounded-lg">Adicionar Produto</button>
                </form>
            </div>
            <div>
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Visão Geral do Estoque</h3>
                <div class="mb-4 flex items-end gap-2">
                    <div class="flex-grow">
                        <label for="inventory-search-input" class="block text-sm font-medium text-gray-700">Pesquisar Produto</label>
                        <input type="text" id="inventory-search-input" placeholder="Nome, SKU ou Cód. de Barras..." class="mt-1 block w-full p-2 border rounded-md">
                    </div>
                    <button id="overview-scan-button" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 h-10 whitespace-nowrap">Escanear</button>
                    </div>
                <div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table class="w-full text-left">
                        <tbody id="inventory-management-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    renderInventoryManagement();

    const quickSearchInput = document.getElementById('quick-stock-search');
    const tableSearchInput = document.getElementById('inventory-search-input');
    const overviewScanButton = document.getElementById('overview-scan-button');

    // Lógica para o novo botão de escanear na Visão Geral
    if (overviewScanButton) {
        overviewScanButton.addEventListener('click', () => {
            startScanner(onOverviewScanSuccess);
        });
    }

    // Lógica de pesquisa da tabela (Visão Geral do Estoque)
    if (tableSearchInput) {
        tableSearchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredProducts = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku.toLowerCase().includes(searchTerm) ||
                p.barcode && p.barcode.toLowerCase().includes(searchTerm) // Adiciona a pesquisa por código de barras
            );
            renderInventoryManagement(filteredProducts);
        }, 300));
    }

    // Lógica de pesquisa da Entrada Rápida
    if (quickSearchInput) {
        quickSearchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            const resultsContainer = document.getElementById('inventory-search-results');

            if (searchTerm.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }
            const filteredProducts = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku.toLowerCase().includes(searchTerm) ||
                p.barcode && p.barcode.toLowerCase().includes(searchTerm) // Adiciona a pesquisa por código de barras
            );
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
        }, 300));
    }
}


window.handleInventorySearch = function (event) {
    const searchTerm = event.target.value.toLowerCase();
    const resultsContainer = document.getElementById('inventory-search-results');

    if (searchTerm.length < 1) {
        resultsContainer.innerHTML = '';
        return;
    }

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm));

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


// --- NOVAS FUNÇÕES DE CONTROLO DOS MODAIS DE CLIENTES ---





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

// Substitua a sua função renderDebtorsList por esta

function renderDebtorsList(customersToRender = customers) { // Aceita uma lista, ou usa a global como padrão
    const debtorsListEl = document.getElementById('debtors-list');
    if (!debtorsListEl) return;

    // O debtors agora é a lista que recebemos para renderizar
    const debtors = customersToRender.filter(c => c.id !== '1');
    const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0); // O total geral não muda

    document.getElementById('total-debt-summary').textContent = areDebtsVisible ? formatCurrency(totalDebt) : 'R$ •••,••';

    if (debtors.length === 0) {
        debtorsListEl.innerHTML = '<p class="text-gray-500 text-center p-4">Nenhum cliente encontrado.</p>';
    } else {
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
                            <td class="p-3 font-bold ${c.debt > 0 ? 'text-red-600' : 'text-green-600'}">
                                ${areDebtsVisible ? formatCurrency(c.debt || 0) : 'R$ •••,••'}
                            </td>
                            <td class="p-3 text-center space-x-2">
                                <button onclick="openManualDebtModal('${c.id}')" class="bg-orange-100 text-orange-800 text-xs font-bold w-7 h-7 rounded-full hover:bg-orange-200" title="Adicionar Dívida Manual">+</button>
                                <button onclick="openDebtStatementModal('${c.id}')" class="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-blue-200">Extrato</button>
                                <button onclick="openDebtPaymentModal('${c.id}')" class="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">Receber</button>
                                <button onclick="openEditCustomerModal('${c.id}')" class="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-gray-200">Editar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    renderDebtVisibilityToggle();
}
// --- FUNÇÕES PARA ADICIONAR DÍVIDA MANUAL ---

function openManualDebtModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('manual-debt-customer-id').value = customer.id;
    document.getElementById('manual-debt-customer-name').textContent = customer.name;
    document.getElementById('manual-debt-modal').classList.remove('hidden');
    document.getElementById('manual-debt-amount').focus();
}

function closeManualDebtModal() {
    document.getElementById('manual-debt-modal').classList.add('hidden');
    document.getElementById('manual-debt-form').reset();
}

async function handleAddManualDebt(event) {
    event.preventDefault();
    const customerId = document.getElementById('manual-debt-customer-id').value;
    const amount = parseCurrency(document.getElementById('manual-debt-amount').value);
    const description = document.getElementById('manual-debt-description').value.trim();

    if (isNaN(amount) || amount <= 0) {
        showModal('Erro', 'Por favor, insira um valor de dívida válido.');
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newDebt = parseFloat((customer.debt + amount).toFixed(2));

    try {
        const customerRef = doc(db, "customers", customerId);
        await updateDoc(customerRef, { debt: newDebt });
        customer.debt = newDebt; // Atualiza localmente

        // Usamos a 'addDebtTransaction' existente, passando o tipo 'sale' para representar um débito
        // e a descrição para o log principal.
        await addDebtTransaction(customerId, 'sale', amount, null, description); // Adicionamos a descrição aqui
        await logActivity('DIVIDA_MANUAL', {
            customerName: customer.name,
            amount: amount,
            description: description || 'Nenhuma'
        }, currentShift ? currentShift.openedBy : 'Sistema');

        closeManualDebtModal();
        showModal('Sucesso', `Dívida de ${formatCurrency(amount)} adicionada para ${customer.name}.`);
        renderDebtorsList();
    } catch (error) {
        console.error("Erro ao adicionar dívida manual:", error);
        showModal('Erro', 'Não foi possível adicionar a dívida.');
    }
}

// --- MODIFICAÇÃO NAS FUNÇÕES DE EXTRATO ---

// Precisamos de modificar 'addDebtTransaction' para aceitar a descrição


// E modificar 'openDebtStatementModal' para mostrar a descrição

// Função para fechar o modal de edição de produto
window.closeEditProductModal = function () {
    const editProductModal = document.getElementById('edit-product-modal');
    if (editProductModal) {
        editProductModal.classList.add('hidden');
    }
}

// Função para abrir o modal de edição de produto e preencher os campos
window.openEditProductModal = function (productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('edit-product-sku').value = product.sku;
    document.getElementById('edit-product-barcode').value = product.barcode || '';
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-price').value = product.price.toFixed(2);
    document.getElementById('edit-product-stock').value = product.stock;
    document.getElementById('edit-product-min-stock').value = product.minStock;

    closeEditCustomerModal(); // Fecha o modal de cliente se estiver aberto
    document.getElementById('edit-product-modal').classList.remove('hidden');
}

// Função para excluir um produto
window.handleDeleteProduct = async function (productId) {
    if (!confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "products", productId));
        await logActivity('PRODUTO_EXCLUIDO', { productId }, currentShift ? currentShift.openedBy : 'Sistema');
        showModal('Sucesso', 'Produto excluído com sucesso.');
        await loadInitialData();
        renderAll();
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        showModal('Erro', 'Não foi possível excluir o produto. Tente novamente.');
    }
}

// --- MODAIS DE CLIENTES E FIADO ---
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

// Versão atualizada para o modal da lista de clientes
async function handleConfirmDebtPayment() {
    const customerId = document.getElementById('debt-customer-id').value;

    // --- MUDANÇA IMPORTANTE AQUI ---
    // Em vez de usar a variável local, buscamos os dados mais recentes do cliente do Firestore
    try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
            showModal('Erro', 'Cliente não encontrado na base de dados.');
            return;
        }

        const customer = { id: customerSnap.id, ...customerSnap.data() }; // Objeto do cliente 100% atualizado

        const amountPaid = parseCurrency(document.getElementById('debt-payment-amount').value);
        const method = document.getElementById('debt-payment-method').value;

        // Chamamos a nossa função central com os dados frescos da base de dados
        await processDebtPayment(customer, amountPaid, method);

        closeDebtPaymentModal();

    } catch (error) {
        console.error("Erro ao buscar cliente ou processar pagamento:", error);
        showModal('Erro', 'Não foi possível completar a operação.');
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

// Função para atualizar os dados do produto
async function handleUpdateProduct(event) {
    event.preventDefault();
    const productId = document.getElementById('edit-product-id').value;
    if (!productId) {
        showModal('Erro', 'ID do produto não encontrado.');
        return;
    }

    const productRef = doc(db, "products", productId);
    const updatedName = document.getElementById('edit-product-name').value.trim();
    const updatedBarcode = document.getElementById('edit-product-barcode').value.trim();
    const updatedPrice = parseCurrency(document.getElementById('edit-product-price').value);
    const updatedStock = parseInt(document.getElementById('edit-product-stock').value);
    const updatedMinStock = parseInt(document.getElementById('edit-product-min-stock').value);

    // Validação de campos
    if (!updatedName || isNaN(updatedPrice) || isNaN(updatedStock) || isNaN(updatedMinStock)) {
        showModal('Erro', 'Preencha todos os campos obrigatórios com valores válidos.');
        return;
    }

    // Validação do código de barras
    if (updatedBarcode !== '') {
        const validLengths = [8, 12, 13];
        if (!/^\d+$/.test(updatedBarcode) || !validLengths.includes(updatedBarcode.length)) {
            showModal('Erro de Código de Barras', 'O código de barras deve conter apenas números e ter 8, 12 ou 13 dígitos.');
            return;
        }
    }

    try {
        await updateDoc(productRef, {
            name: updatedName,
            barcode: updatedBarcode,
            price: updatedPrice,
            stock: updatedStock,
            minStock: updatedMinStock
        });
        await logActivity('PRODUTO_ATUALIZADO', { productId, name: updatedName }, currentShift ? currentShift.openedBy : 'Sistema');
        showModal('Sucesso', 'Produto atualizado com sucesso.');
        closeEditProductModal();
        await loadInitialData();
        renderAll();
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        showModal('Erro', 'Não foi possível salvar as alterações do produto. Tente novamente.');
    }
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
// --- FUNÇÃO AUXILIAR PARA FOCAR NO CÓDIGO DE BARRAS ---
function focusOnBarcode() {
    // Encontra o campo de input do código de barras
    const barcodeInput = document.getElementById('barcode-input-field');

    // Se o campo existir na tela...
    if (barcodeInput) {
        // ...foca o cursor nele
        barcodeInput.focus();
        // (Bônus) seleciona qualquer texto que já esteja lá
        barcodeInput.select();
    }
}

function startNewSale() {
    document.getElementById('pdv-idle-screen')?.classList.add('hidden');
    document.getElementById('pdv-active-sale')?.classList.remove('hidden');
    focusOnBarcode(); // <-- MUDANÇA AQUI
}

// ... (seu código anterior)

function handleBarcodeKeypress(e) {
    if (e.key === 'Enter' && e.target.value.trim()) {
        e.preventDefault();
        handleBarcodeScan(e.target.value.trim());
        e.target.value = '';
    }
}

// --- COLOQUE A NOVA FUNÇÃO AQUI ---
const handleBarcodeAutoDetect = debounce((inputElement) => {
    const code = inputElement.value.trim();
    const validLengths = [8, 12, 13]; // Tamanhos de códigos de barras comuns (EAN-8, UPC-A, EAN-13)

    if (validLengths.includes(code.length)) {
        console.log(`Código com tamanho válido detectado: ${code}. Processando...`);
        handleBarcodeScan(code);
        inputElement.value = ''; // Limpa o campo após o processamento
    }
});
// ------------------------------------


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
    focusOnBarcode(); // <-- Adicionar aqui

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
        customerId: selectedCustomerForSale,
    };
    selectedPaymentMethod = 'Dinheiro';
    renderPaymentModal();
    paymentModal.classList.remove('hidden');
    setTimeout(() => paymentModal.querySelector('div').classList.add('scale-100'), 10);
}

//alteraçao de logica

function renderPaymentModal() {
    const total = parseFloat(saleInProgress.total.toFixed(2));
    const totalPaid = parseFloat(saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const change = totalPaid > total ? totalPaid - total : 0;

    document.getElementById('payment-modal-total').textContent = formatCurrency(total);
    document.getElementById('payment-modal-paid-amount').textContent = formatCurrency(totalPaid);
    document.getElementById('payment-modal-change').textContent = formatCurrency(change);

    const customerSelect = document.getElementById('payment-modal-customer-select');
    const customerOptions = customers.filter(c => c.id !== '1').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    customerSelect.innerHTML = `<option value="1">Consumidor Final</option>${customerOptions}`;
    customerSelect.value = saleInProgress.customerId;

    document.getElementById('payment-modal-cart-summary').innerHTML = saleInProgress.items.map(i => `<div>${i.quantity}x ${i.name}</div>`).join('');
    document.getElementById('payment-modal-payments-list').innerHTML = saleInProgress.payments.map(p => `<div class="flex justify-between bg-white p-1 rounded"><span>${p.method}</span><span class="font-semibold">${formatCurrency(p.amount)}</span></div>`).join('');

    const remainingAmount = total - totalPaid;
    // Preenche o campo com o valor restante (com uma pequena tolerância para evitar bugs de arredondamento)
    document.getElementById('payment-amount').value = (remainingAmount > 0.009) ? remainingAmount.toFixed(2).replace('.', ',') : '';

    // Chama a nova função para cuidar apenas do botão
    updateSaleConfirmationButton();

    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === selectedPaymentMethod) {
            btn.classList.add('active');
        }
    });

    document.getElementById('add-payment-form').style.visibility = selectedPaymentMethod === 'Fiado' ? 'hidden' : 'visible';
}//fim logica


//19/09 - responsável apenas por habilitar ou desabilitar o botão "Confirmar Venda".
function updateSaleConfirmationButton() {
    const total = parseFloat(saleInProgress.total.toFixed(2));
    const totalPaid = parseFloat(saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const customerSelect = document.getElementById('payment-modal-customer-select');
    const confirmSaleButton = document.getElementById('confirm-sale-button');

    let saleCanBeConfirmed = false;
    if (selectedPaymentMethod === 'Fiado') {
        saleCanBeConfirmed = customerSelect.value !== '1';
    } else {
        // Usa uma tolerância para comparações de ponto flutuante
        const amountInInput = parseCurrency(document.getElementById('payment-amount').value) || 0;
        saleCanBeConfirmed = (totalPaid + amountInInput) >= (total - 0.009);
    }
    confirmSaleButton.disabled = !saleCanBeConfirmed;
}

//fim
//limpar campo com valor e adiconar
function handleAddPayment(event) {
    event.preventDefault();
    const amount = parseCurrency(document.getElementById('payment-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }
    saleInProgress.payments.push({ method: selectedPaymentMethod, amount: amount });
    
    // Limpa o campo para que seja preenchido com o novo valor restante
    document.getElementById('payment-amount').value = ''; 
    
    renderPaymentModal();
}
//fim limpar
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
        minStock: 0,
        isDiversos: true // MELHORIA: Adicionamos esta flag para ser explícito
    };
    cart.push(cartItem);
    renderCart();
    closeDiversosModal();
    focusOnBarcode();
}

function handleDiversosItemClick(e) {
    if (e.target.classList.contains('diversos-item-btn')) {
        const itemName = e.target.dataset.item;
        const priceStr = prompt(`Digite o valor para "${itemName}":`);

        // Usamos a nossa nova função de parse robusta aqui
        const price = parseCurrency(priceStr);

        if (!isNaN(price) && price > 0) {
            addDiversosToCart(itemName, price);
        } else if (priceStr !== null) { // Apenas mostra erro se o utilizador não clicou em "Cancelar"
            showModal('Valor Inválido', 'Por favor, insira um preço válido.');
        }
    }
}
/**
 * Confirma e salva a venda em progresso.
 */
async function confirmSale() {
    const confirmButton = document.getElementById('confirm-sale-button');
    confirmButton.disabled = true;
    confirmButton.textContent = 'Processando...';

    try {
        if (saleInProgress.payments.length === 0 && selectedPaymentMethod !== 'Fiado') {
            const amount = parseCurrency(document.getElementById('payment-amount').value);
            if (amount > 0) {
                saleInProgress.payments.push({ method: selectedPaymentMethod, amount: amount });
            }
        }
        
        if (saleInProgress.payments.length === 0 && selectedPaymentMethod === 'Fiado') {
            saleInProgress.payments.push({ method: 'Fiado', amount: saleInProgress.total });
        }

        const saleId = crypto.randomUUID();
        const saleData = {
            ...saleInProgress,
            id: saleId,
            timestamp: new Date().toISOString(),
            shiftId: currentShift.id
        };

        const fiadoPayment = saleInProgress.payments.find(p => p.method === 'Fiado');

        if (fiadoPayment) {
            const customerId = document.getElementById('payment-modal-customer-select').value;
            const customer = customers.find(c => c.id === customerId);

            if (!customerId || customerId === "1") {
                showModal('Ação Inválida', 'Selecione um cliente cadastrado para vendas a fiado.');
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirmar Venda';
                return;
            }

            if (customer) {
                const newDebtAmount = parseFloat((customer.debt + fiadoPayment.amount).toFixed(2));
                const customerRef = doc(db, "customers", customerId);
                await updateDoc(customerRef, { debt: newDebtAmount });
                customer.debt = newDebtAmount;

                // --- ALTERAÇÃO PRINCIPAL AQUI ---
                // Agora passamos 'saleData.items' para guardar os produtos no histórico
                await addDebtTransaction(customerId, 'sale', fiadoPayment.amount, saleId, 'Venda a Fiado', saleData.items);

                saleData.notes = `Venda fiado para o cliente ${customer.name}.`;
            }
        } else {
            const saleTotal = saleInProgress.total;
            const totalPaid = saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0);

            if (totalPaid < saleTotal) {
                showModal('Erro', 'O valor pago é insuficiente.');
                confirmButton.disabled = false;
                confirmButton.textContent = 'Confirmar Venda';
                return;
            }

            if (totalPaid > saleTotal) {
                const change = totalPaid - saleTotal;
                saleData.change = change;
            }
        }

        await setDoc(doc(db, "users", auth.currentUser.uid, "sales", saleId), saleData);

        // ADICIONADO: Adiciona a venda ao total do dia (para atualizar Painel)
        if (currentShift && currentShift.sales) {
            currentShift.sales.push(saleData);
            console.log('--- PONTO 1: Venda adicionada ao turno ---', currentShift.sales.map(s => s.total));
            await updateCurrentDayInFirestore(); // Salva no Firebase
        }

        const customer = customers.find(c => c.id === saleData.customerId);
        await logActivity('VENDA_CRIADA', {
            saleId: saleData.id,
            total: saleData.total,
            customerName: customer ? customer.name : 'Consumidor'
        }, currentShift.openedBy);


        for (const item of saleInProgress.items) {
            const product = products.find(p => p.id === item.id);
            if (product && !item.isDiversos) {
                const newStock = product.stock - item.quantity;
                const productRef = doc(db, "products", product.id);
                await updateDoc(productRef, { stock: newStock });
                product.stock = newStock; // <-- ADICIONE ESTA LINHA
            }
        
        }
        if (fiadoPayment) {
            selectedCustomerForSale = saleData.customerId;
        } else {
            selectedCustomerForSale = '1';
        }

        closePaymentModal();
        renderReceipt(saleData, saleData.change || 0);

    } catch (error) {
        console.error("Erro ao confirmar venda:", error);
        showModal('Erro', 'Não foi possível salvar a venda. Tente novamente.');
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirmar Venda';
    }
}

function renderReceipt(data, change, warning = '') {
    const ci = settings.companyInfo;
    document.getElementById('receipt-store-name').textContent = ci.name;
    document.getElementById('receipt-store-address').textContent = ci.address;
    document.getElementById('receipt-store-cnpj').textContent = ci.cnpj;
    document.getElementById('receipt-store-message').textContent = ci.receiptMessage;
    document.getElementById('receipt-date').textContent = formatDateTime(data.date);
    document.getElementById('receipt-customer').textContent = data.customerName || 'Consumidor';

    const itemsEl = document.getElementById('receipt-items');
    const totalEl = document.getElementById('receipt-total');
    const paymentsEl = document.getElementById('receipt-payments');

    // Nova lógica para diferenciar o tipo de recibo
    if (data.type === 'debtPayment') {
        // --- RECIBO DE PAGAMENTO DE DÍVIDA ---
        document.getElementById('receipt-sale-id').parentElement.style.display = 'none';
        itemsEl.innerHTML = `
            <div><p>COMPROVATIVO DE PAGAMENTO</p></div>
            <div class="my-2 border-t border-dashed"></div>
            <div class="flex justify-between"><p>Dívida Anterior:</p> <p>${formatCurrency(data.previousDebt)}</p></div>
            <div class="flex justify-between"><p>Valor Recebido:</p> <p>${formatCurrency(data.amountPaid)}</p></div>
            <div class="my-2 border-t border-dashed"></div>
            <div class="flex justify-between font-bold"><p>Novo Saldo Devedor:</p> <p>${formatCurrency(data.newDebt)}</p></div>
        `;
        totalEl.textContent = formatCurrency(data.amountPaid);

    } else {
        // --- RECIBO DE VENDA (LÓGICA ANTIGA) ---
        document.getElementById('receipt-sale-id').parentElement.style.display = 'block';
        document.getElementById('receipt-sale-id').textContent = data.id;
        document.getElementById('receipt-shift-id').textContent = currentShift.id;
        itemsEl.innerHTML = data.items.map(item => `
            <div>
                <p>${item.quantity}x ${item.name}</p>
                <p class="text-right">${formatCurrency(item.price * item.quantity)}</p>
            </div>
        `).join('');
        totalEl.textContent = formatCurrency(data.total);
    }

    // Parte comum a ambos os recibos
    paymentsEl.innerHTML = data.payments.filter(p => p.amount > 0).map(p =>
        `<p>${p.method}: <span>${formatCurrency(p.amount)}</span></p>`
    ).join('');

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
// Substitua a sua função antiga por esta versão async

async function closeReceiptModal() {
    // Mantém a sua animação de fecho
    receiptModal.querySelector('div').classList.remove('scale-100');

    setTimeout(async () => {
        receiptModal.classList.add('hidden');

        // 1. Limpa o carrinho do PDV para a próxima venda
        resetPdv();

        // 2. REMOVIDO: A chamada a loadInitialData() era desnecessária e causava o bug.
        // await loadInitialData();
        console.log('--- PONTO 2: Dados antes de redesenhar o painel ---', currentDay.shifts.flatMap(s => s.sales).map(s => s.total));

        // 3. Redesenha todos os componentes da aplicação com os dados locais atualizados
        renderAll();

        // 4. Volta o foco para o campo de código de barras para a próxima venda
        focusOnBarcode();
    }, 200);
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

function renderInventoryManagement(productsToRender = products) {
    console.log('Produtos a renderizar:', productsToRender);
    const inventoryManagementTableBodyEl = document.getElementById('inventory-management-table-body');
    if (!inventoryManagementTableBodyEl) return;

    if (productsToRender.length === 0) {
        inventoryManagementTableBodyEl.innerHTML = `
            <p class="p-4 text-center text-gray-500">Nenhum produto encontrado.</p>
        `;
        return;
    }

    const sortedProducts = [...productsToRender].sort((a, b) => {
        const aIsLow = a.stock <= a.minStock;
        const bIsLow = b.stock <= b.minStock;
        if (aIsLow && !bIsLow) return -1;
        if (!aIsLow && bIsLow) return 1;
        return a.name.localeCompare(b.name);
    });

    inventoryManagementTableBodyEl.innerHTML = `
        <thead class="bg-gray-100">
            <tr>
                <th class="p-3 font-semibold text-gray-600">Produto</th>
                <th class="p-3 font-semibold text-gray-600 text-center">Estoque</th>
                <th class="p-3 font-semibold text-gray-600 text-center">Preço</th>
                <th class="p-3 font-semibold text-gray-600 text-center">Ações</th>
            </tr>
        </thead>
        <tbody>
            ${sortedProducts.map(product => {
        const isLowStock = product.stock <= product.minStock;
        const rowClass = isLowStock ? 'bg-red-50' : '';
        const textClass = isLowStock ? 'text-red-600 font-bold' : '';
        return `
                    <tr class="${rowClass}">
                        <td class="p-3">
                            <p class="font-semibold">${product.name}</p>
                            <p class="text-xs text-gray-500">SKU: ${product.sku} | Cód. Barras: ${product.barcode || 'N/A'}</p>
                        </td>
                        <td class="p-3 text-center ${textClass}">${product.stock}</td>
                        <td class="p-3 text-center">${formatCurrency(product.price)}</td>
                        <td class="p-3 text-center space-x-2">
                            <button onclick="openEditProductModal('${product.id}')" class="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-indigo-200">Editar</button>
                            <button onclick="handleDeleteProduct('${product.id}')" class="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-red-200">Excluir</button>
                        </td>
                    </tr>
                `;
    }).join('')}
        </tbody>
    `;
}

// ====== INÍCIO DO BLOCO DE CÓDIGO CORRETO E ÚNICO PARA A ABA CLIENTES ======

// NOVA FUNÇÃO PARA RENDERIZAR A ABA DE CLIENTES COM O NOVO VISUAL

// ESTA É A VERSÃO CORRETA QUE DEVE PERMANECER NO SEU CÓDIGO
function renderCustomersTab() {
    contentCustomers.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold text-gray-800">Gestão de Clientes</h3>
            <div class="flex gap-4">
                <button onclick="openQuickReceiptModal()" class="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">R$ Recebimento Rápido</button>
                <button onclick="openAddCustomerModal()" class="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">+ Adicionar Novo Cliente</button>
            </div>
        </div>
        
        <div class="mb-4">
            <input type="text" id="customer-list-search-input" placeholder="Pesquisar por nome ou telefone..." class="w-full p-2 border rounded-md">
        </div>

        <div class="flex justify-end items-center mb-4">
             <div class="text-right flex items-center gap-3">
                <div>
                    <p class="text-sm text-gray-500">Total em Dívidas</p>
                    <p id="total-debt-summary" class="font-bold text-lg text-red-600"></p>
                </div>
                <button id="toggle-debt-visibility-btn" class="p-2 rounded-full hover:bg-gray-200" title="Mostrar/Ocultar valores">
                    </button>
            </div>
        </div>
        <div id="debtors-list" class="overflow-x-auto max-h-[55vh] overflow-y-auto"></div>
    `;

    // Adiciona o event listener para o novo campo de pesquisa
    const searchInput = document.getElementById('customer-list-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredCustomers = customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm) ||
                (c.phone && c.phone.includes(searchTerm))
            );
            renderDebtorsList(filteredCustomers); // Chama a renderização com a lista filtrada
        }, 300));
    }

    renderDebtorsList(); // Renderiza a lista completa inicialmente
}

// NOVAS FUNÇÕES DE CONTROLO DOS MODAIS
function openAddCustomerModal() {
    document.getElementById('add-customer-modal').classList.remove('hidden');
    document.getElementById('modal-new-customer-name').focus();
}

function closeAddCustomerModal() {
    document.getElementById('add-customer-modal').classList.add('hidden');
    document.getElementById('modal-add-customer-form').reset();
}

function openQuickReceiptModal() {
    document.getElementById('quick-receipt-modal').classList.remove('hidden');
    document.getElementById('modal-receipts-payment-area').classList.add('hidden');
    document.getElementById('modal-receipts-search-results').innerHTML = '';
    document.getElementById('modal-receipts-customer-search').value = '';
    document.getElementById('modal-receipts-customer-search').focus();
    selectedCustomerForPayment = null;
}

function closeQuickReceiptModal() {
    document.getElementById('quick-receipt-modal').classList.add('hidden');
}

// FUNÇÕES DE LÓGICA ATUALIZADAS
async function handleAddCustomer(event) {
    event.preventDefault();
    const name = document.getElementById('modal-new-customer-name').value.trim();
    const phone = document.getElementById('modal-new-customer-phone').value.trim();
    if (!name) return showModal('Erro', 'O nome do cliente é obrigatório.');

    const newCustomer = { name, phone, debt: 0, usuarioId: auth.currentUser.uid };
    try {
        const docRef = await addDoc(collection(db, "customers"), newCustomer);
        await logActivity('CLIENTE_ADICIONADO', { customerId: docRef.id, name, phone }, currentShift ? currentShift.openedBy : 'Sistema');
        await loadInitialData();
        renderDebtorsList();
        closeAddCustomerModal();
        showModal('Sucesso!', 'Novo cliente cadastrado.');
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showModal('Erro de Base de Dados', 'Não foi possível guardar o cliente.');
    }
}

const handleCustomerSearchForPayment = debounce((searchTerm) => {
    const resultsContainer = document.getElementById('modal-receipts-search-results');
    if (!searchTerm) { resultsContainer.innerHTML = ''; return; }
    const filteredCustomers = customers.filter(c => c.debt > 0 && c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filteredCustomers.length > 0) {
        resultsContainer.innerHTML = filteredCustomers.map(c => `
            <div data-customer-id="${c.id}" class="p-3 border-b hover:bg-gray-100 cursor-pointer customer-search-result">
                <p class="font-semibold">${c.name}</p>
                <p class="text-sm text-red-600">${formatCurrency(c.debt)}</p>
            </div>
        `).join('');
    } else {
        resultsContainer.innerHTML = '<p class="p-3 text-gray-500">Nenhum cliente com dívida encontrado.</p>';
    }
}, 300);

function selectCustomerForPayment(customerId) {
    selectedCustomerForPayment = customers.find(c => c.id === customerId);
    if (!selectedCustomerForPayment) return;
    document.getElementById('modal-receipts-customer-search').value = '';
    document.getElementById('modal-receipts-search-results').innerHTML = '';
    document.getElementById('modal-receipts-payment-area').classList.remove('hidden');
    document.getElementById('modal-receipts-customer-name').textContent = selectedCustomerForPayment.name;
    document.getElementById('modal-receipts-current-debt').textContent = formatCurrency(selectedCustomerForPayment.debt);
    document.getElementById('modal-receipts-payment-amount').value = selectedCustomerForPayment.debt.toFixed(2).replace('.', ',');
    document.getElementById('modal-receipts-payment-amount').focus();
}

// Versão simplificada para o "Recebimento Rápido"
async function handleDebtPaymentFromReceiptsTab() {
    if (!selectedCustomerForPayment) return;

    const amountPaid = parseCurrency(document.getElementById('modal-receipts-payment-amount').value);
    const method = document.getElementById('modal-receipts-payment-method').value;

    await processDebtPayment(selectedCustomerForPayment, amountPaid, method);

    closeQuickReceiptModal();
}

// ====== FIM DO BLOCO ======
async function handleAddProduct(event) {
    event.preventDefault();
    if (!auth.currentUser) return;

    const sku = document.getElementById('new-sku').value.trim();
    const barcode = document.getElementById('new-barcode').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const price = parseCurrency(document.getElementById('new-price').value);
    const stock = parseInt(document.getElementById('new-stock').value);
    const minStock = parseInt(document.getElementById('new-min-stock').value);

    // 1. Validação do formato do código de barras
    if (barcode !== '') {
        const validLengths = [8, 12, 13];
        if (!/^\d+$/.test(barcode)) {
            showModal('Erro de Código de Barras', 'O código de barras deve conter apenas números.');
            return;
        }
        if (!validLengths.includes(barcode.length)) {
            showModal('Erro de Código de Barras', 'O código de barras deve ter 8, 12 ou 13 dígitos (padrões EAN-8, UPC-A ou EAN-13).');
            return;
        }
    }

    // 2. Validação dos campos obrigatórios
    if (!sku || !name || isNaN(price) || isNaN(stock) || isNaN(minStock)) {
        showModal('Erro', 'Preencha todos os campos obrigatórios.');
        return;
    }

    // 3. Verificação de SKU, Nome e Código de Barras duplicado
    const existingProduct = products.find(p => {
        const isSkuDuplicate = p.sku.toLowerCase() === sku.toLowerCase();
        const isNameDuplicate = p.name.toLowerCase() === name.toLowerCase();
        const isBarcodeDuplicate = barcode !== '' && p.barcode === barcode;
        return isSkuDuplicate || isNameDuplicate || isBarcodeDuplicate;
    });

    if (existingProduct) {
        showModal('Produto já existe', `Um produto com este SKU ou Código de Barras já está cadastrado: ${existingProduct.name}.`);
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

// Callback específico para a pesquisa na Visão Geral do Estoque
// Callback específico para a pesquisa na Visão Geral do Estoque
function onOverviewScanSuccess(decodedText) {
    const product = products.find(p => p.barcode === decodedText);
    if (product) {
        showEditOrDeleteModal(product);
    } else {
        showModal('Produto Não Encontrado', `Nenhum produto com o código de barras "${decodedText}" foi encontrado no estoque.`);
    }
}

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



// --- INICIALIZAÇÃO E EVENTOS ---
// --- INICIALIZAÇÃO E EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Listeners Estáticos (sempre na página) ---
    loginForm.addEventListener('submit', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    forgotPasswordLink.addEventListener('click', handleForgotPassword);
    addPaymentForm.addEventListener('submit', handleAddPayment);
    confirmSaleButton.addEventListener('click', confirmSale);
    document.getElementById('update-product-button')?.addEventListener('click', handleUpdateProduct);
    document.getElementById('update-customer-button')?.addEventListener('click', handleUpdateCustomer);
    document.getElementById('confirm-debt-payment-button')?.addEventListener('click', handleConfirmDebtPayment);
    document.getElementById('print-receipt-button').addEventListener('click', printReceipt);
    document.getElementById('close-receipt-button').addEventListener('click', closeReceiptModal);
    document.getElementById('open-drawer-button').addEventListener('click', handleOpenDrawer);

    // --- Listeners para Conteúdo Dinâmico (Dia e Turno) ---
    document.getElementById('open-day-form')?.addEventListener('submit', handleOpenDay);
    document.getElementById('close-shift-button')?.addEventListener('click', handleCloseShift);
    document.getElementById('open-shift-form')?.addEventListener('submit', handleOpenShift);
    document.getElementById('close-day-button')?.addEventListener('click', handleCloseDay);

    // --- Listeners para Abas (usando delegação de eventos onde possível) ---
    contentPdv.addEventListener('click', function (e) {
        if (e.target.id === 'checkout-button') handleCheckout(e);
        if (e.target.id === 'cancel-sale-button') resetPdv();
        if (e.target.id === 'diversos-button') openDiversosModal();
        if (e.target.id === 'pdv-scan-button') startScanner(onPdvScanSuccess);
    });
    contentPdv.addEventListener('input', function (e) {
        if (e.target.id === 'barcode-input-field') handleBarcodeAutoDetect(e.target);
    });

    contentInventory.addEventListener('submit', function (e) {
        if (e.target.id === 'add-product-form') handleAddProduct(e);
    });
    contentInventory.addEventListener('click', function (e) {
        if (e.target.id === 'inventory-scan-button') startScanner(onInventoryScanSuccess);
    });
    contentInventory.addEventListener('keypress', function (e) {
        if (e.target.id === 'inventory-barcode-input' && e.key === 'Enter') {
            e.preventDefault();
            handleInventoryBarcode(e.target.value.trim());
            e.target.value = '';
        }
    });

    contentSettings.addEventListener('submit', function (e) {
        if (e.target.id === 'company-info-form') handleSaveCompanyInfo(e);
        if (e.target.id === 'add-operator-form') handleAddOperator(e);
    });

    // --- Listeners para os Modais ---
    paymentModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-method-btn')) {
            selectedPaymentMethod = e.target.dataset.method;
            if (selectedPaymentMethod === 'Fiado') {
                saleInProgress.payments = [];
            }
            renderPaymentModal();
        }
    });
    document.getElementById('payment-modal-customer-select').addEventListener('change', function() {
        saleInProgress.customerId = this.value;
                renderPaymentModal();

    });
    document.getElementById('payment-amount').addEventListener('input', updateSaleConfirmationButton);
    document.getElementById('diversos-options').addEventListener('click', handleDiversosItemClick);

    // Listeners para os NOVOS modais da aba Clientes
    const addCustomerFormModal = document.getElementById('modal-add-customer-form');
    if (addCustomerFormModal) {
        addCustomerFormModal.addEventListener('submit', handleAddCustomer);
    }
    const quickReceiptModal = document.getElementById('quick-receipt-modal');
    if (quickReceiptModal) {
        const searchResultsEl = quickReceiptModal.querySelector('#modal-receipts-search-results');
        const quickReceiptForm = quickReceiptModal.querySelector('#modal-quick-receipt-form');

        quickReceiptModal.addEventListener('input', (e) => {
            if (e.target.id === 'modal-receipts-customer-search') handleCustomerSearchForPayment(e.target.value);
        });
        quickReceiptModal.addEventListener('click', (e) => {
            if (e.target.id === 'modal-receipts-confirm-payment-button') handleDebtPaymentFromReceiptsTab();
            if (e.target.id === 'modal-receipts-pay-full-debt-button') {
                if (selectedCustomerForPayment) document.getElementById('modal-receipts-payment-amount').value = selectedCustomerForPayment.debt.toFixed(2).replace('.', ',');
            }
        });
        if (searchResultsEl) {
            searchResultsEl.addEventListener('click', (e) => {
                const customerDiv = e.target.closest('.customer-search-result');
                if (customerDiv) selectCustomerForPayment(customerDiv.dataset.customerId);
            });
        }
        if (quickReceiptForm) {
            quickReceiptForm.addEventListener('submit', (e) => {
                e.preventDefault();
                document.getElementById('modal-receipts-confirm-payment-button').click();
            });
        }
    }

    // Listener para o modal antigo de Receber Dívida (da lista)
    // A NOVA VERSÃO CORRIGIDA
    contentCustomers.addEventListener('click', (e) => {
        // Lógica que você já tinha
        if (e.target.id === 'receipts-confirm-payment-button') {
            handleDebtPaymentFromReceiptsTab();
        }
        if (e.target.id === 'receipts-pay-full-debt-button') {
            if (selectedCustomerForPayment) {
                document.getElementById('receipts-payment-amount').value = selectedCustomerForPayment.debt.toFixed(2).replace('.', ',');
            }
        }

        // --- NOVO CÓDIGO ADICIONADO AQUI ---
        // Verifica se o clique foi no botão de visibilidade ou no seu ícone
        if (e.target.closest('#toggle-debt-visibility-btn')) {
            toggleDebtVisibility();
        }
    });
});


// --- FIM DO NOVO CÓDIGO ---

contentSettings.addEventListener('submit', function (e) {
    if (e.target.id === 'company-info-form') handleSaveCompanyInfo(e);
    if (e.target.id === 'add-operator-form') handleAddOperator(e);
});

paymentModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('payment-method-btn')) {
        selectedPaymentMethod = e.target.dataset.method;
        if (selectedPaymentMethod === 'Fiado') {
            saleInProgress.payments = [];
        }
        renderPaymentModal();
    }
});

document.getElementById('payment-modal-customer-select').addEventListener('change', function() {
    saleInProgress.customerId = this.value;
});

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
// NEW: Função para mostrar o modal de escolha Editar/Excluir
function showEditOrDeleteModal(product) {
    const modal = document.getElementById('edit-or-delete-modal');
    document.getElementById('edit-or-delete-modal-message').textContent = `O que deseja fazer com ${product.name}?`;

    // Conecta os botões do modal às funções de edição e exclusão
    const editButton = document.getElementById('edit-product-choice-button');
    const deleteButton = document.getElementById('delete-product-choice-button');

    // Para evitar eventos duplicados, removemos os antigos antes de adicionar os novos
    editButton.onclick = null;
    deleteButton.onclick = null;

    editButton.onclick = () => {
        closeModalById('edit-or-delete-modal');
        openEditProductModal(product.id);
    };

    deleteButton.onclick = () => {
        closeModalById('edit-or-delete-modal');
        handleDeleteProduct(product.id);
    };

    modal.classList.remove('hidden');
}

// NEW: Função auxiliar para fechar qualquer modal por ID
window.closeModalById = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
};

/**
 * Adiciona uma transação (nova dívida ou pagamento) ao histórico de um cliente.
 * @param {string} customerId - O ID do cliente.
 * @param {'sale' | 'payment'} type - O tipo de transação.
 * @param {number} amount - O valor da transação.
 * @param {string} [saleId=null] - O ID da venda (se for uma nova dívida).
 */
async function addDebtTransaction(customerId, type, amount, saleId = null, description = '', items = []) {
    if (!auth.currentUser) return;
    try {
        const debtHistoryRef = collection(db, "users", auth.currentUser.uid, "debt_history");
        // Adicionamos o campo 'items' ao objeto que é salvo na base de dados
        await addDoc(debtHistoryRef, { customerId, type, amount, saleId, date: new Date().toISOString(), description, items });
    } catch (error) {
        console.error("Erro ao salvar transação de dívida:", error);
    }
}
/**
 * Abre o modal com o extrato de dívidas de um cliente.
 * @param {string} customerId - O ID do cliente.
 */
async function openDebtStatementModal(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('statement-customer-name').textContent = customer.name;
    document.getElementById('statement-customer-debt').textContent = formatCurrency(customer.debt);
    const listContainer = document.getElementById('statement-transactions-list');
    listContainer.innerHTML = '<p>A carregar histórico...</p>';

    const user = auth.currentUser;
    if (!user) return;

    try {
        const historyRef = collection(db, "users", user.uid, "debt_history");
        const q = query(historyRef, where("customerId", "==", customerId), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const transactions = querySnapshot.docs.map(doc => doc.data());

        if (transactions.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-500">Nenhum histórico de transação encontrado.</p>';
        } else {
            listContainer.innerHTML = transactions.map(t => {
                const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const isDebit = t.type === 'sale';
                const colorClass = isDebit ? 'text-red-600' : 'text-green-600';

                let label = isDebit ? 'Nova Dívida (Venda)' : 'Pagamento Recebido';
                if (isDebit && !t.saleId) {
                    label = t.description ? `Dívida Manual: ${t.description}` : 'Dívida Manual';
                }

                // --- NOVA LÓGICA PARA MOSTRAR OS ITENS ---
                let itemsHTML = '';
                if (t.items && t.items.length > 0) {
                    itemsHTML = `
                        <ul class="list-disc list-inside text-xs text-gray-600 pl-4 mt-1">
                            ${t.items.map(item => `<li>${item.quantity}x ${item.name} (${formatCurrency(item.price)})</li>`).join('')}
                        </ul>
                    `;
                }

                return `
                    <div class="flex justify-between items-start p-2 rounded-md ${isDebit ? 'bg-red-50' : 'bg-green-50'}">
                        <div>
                            <p class="font-semibold ${colorClass}">${label}</p>
                            ${itemsHTML} 
                            <p class="text-sm text-gray-500 mt-1">${date}</p>
                        </div>
                        <p class="font-bold text-lg ${colorClass} pt-1">${formatCurrency(t.amount)}</p>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error("Erro ao buscar histórico de dívidas:", error);
        listContainer.innerHTML = '<p class="text-red-500">Ocorreu um erro ao carregar o histórico.</p>';
    }
    document.getElementById('debt-statement-modal').classList.remove('hidden');
}

/**
 * Fecha o modal do extrato de dívida.
 */
function closeDebtStatementModal() {
    document.getElementById('debt-statement-modal').classList.add('hidden');
}

// Exponha as funções globais necessárias para o HTML
window.openDebtStatementModal = openDebtStatementModal;
window.closeDebtStatementModal = closeDebtStatementModal;
window.openAddCustomerModal = openAddCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.openQuickReceiptModal = openQuickReceiptModal;
window.closeQuickReceiptModal = closeQuickReceiptModal;
window.showModal = showModal;
window.closeModal = closeModal;
window.openManualDebtModal = openManualDebtModal;
window.closeManualDebtModal = closeManualDebtModal;



/**
 * Função central para processar qualquer pagamento de dívida.
 * Calcula troco, atualiza a base de dados, abre a gaveta e gera o recibo.
 * @param {object} customer - O objeto completo do cliente.
 * @param {number} amountPaid - O valor que o cliente pagou.
 * @param {string} method - A forma de pagamento.
 */
async function processDebtPayment(customer, amountPaid, method) {
    const debt = customer.debt;

    // Validação
    if (isNaN(amountPaid) || amountPaid <= 0) {
        showModal('Erro', 'Valor de pagamento inválido.');
        return;
    }

    const amountToClear = Math.min(amountPaid, debt);
    const newDebt = parseFloat((debt - amountToClear).toFixed(2));
    const change = parseFloat((amountPaid > debt ? amountPaid - debt : 0).toFixed(2));

    try {
        const customerRef = doc(db, "customers", customer.id);
        await updateDoc(customerRef, { debt: newDebt });
        customer.debt = newDebt; // Atualiza o objeto local

        await addDebtTransaction(customer.id, 'payment', amountToClear);
        await logActivity('PAGAMENTO_DIVIDA', { customerId: customer.id, customerName: customer.name, amount: amountToClear, method });

        if (method === 'Dinheiro') {
            await handleOpenDrawer(true);
        }

        const paymentData = {
            type: 'debtPayment',
            customerName: customer.name,
            date: new Date().toISOString(),
            previousDebt: debt,
            amountPaid: amountPaid,
            newDebt: newDebt,
            payments: [{ method: method, amount: amountPaid }],
            change: change
        };

        renderReceipt(paymentData, change);

        await loadInitialData();
        renderAll(); // Re-renderiza tudo para garantir consistência

    } catch (error) {
        console.error("Erro ao processar pagamento de dívida:", error);
        showModal("Erro de Base de Dados", "Não foi possível processar o pagamento.");
    }
}

// Adicione estas duas novas funções ao seu script.js

function renderDebtVisibilityToggle() {
    const toggleBtn = document.getElementById('toggle-debt-visibility-btn');
    if (!toggleBtn) return;

    if (areDebtsVisible) {
        // Ícone de "olho aberto" (SVG)
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    } else {
        // Ícone de "olho fechado" (SVG)
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.673.124 2.458.35M18.825 13.875A10.133 10.133 0 0119.5 12c-1.274-4.057-5.064-7-9.542-7a10.05 10.05 0 00-1.218.068M3.175 3.175l18.85 18.85M9.825 9.825A3 3 0 0012 15a3 3 0 002.175-5.175M15 12a3 3 0 01-3 3" /></svg>`;
    }
}

function toggleDebtVisibility() {
    areDebtsVisible = !areDebtsVisible; // Inverte o valor (true -> false, false -> true)
    renderDebtorsList(); // Re-renderiza a lista para aplicar a mudança
}