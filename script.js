// CORREÇÃO: As importações do Firebase e a lógica principal foram unificadas aqui.
      import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
      import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
      import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

      // --- CONFIGURAÇÃO DO FIREBASE ---
      // IMPORTANTE: Substitua estas chaves pelas do seu projeto no site do Firebase!
      const firebaseConfig = {
        apiKey: "AIzaSyD0aw5it4FgY7TdCIUrj9cGfGp3c0au10U",
        authDomain: "topdelinhacaixaestoque.firebaseapp.com",
        projectId: "topdelinhacaixaestoque",
        storageBucket: "topdelinhacaixaestoque.firebasestorage.app",
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
        let products = [];
        let customers = [];
        const users = ['Edson', 'Edna'];
        let cart = [];
        let closedDays = [];
        let currentDay = null;
        let currentShift = null;
        let saleInProgress = {};
        let html5QrcodeScanner = null;
        let selectedPaymentMethod = 'Dinheiro';
        let salesChart = null;

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
        const tabPdv = document.getElementById('tab-pdv');
        const paymentModal = document.getElementById('payment-modal');
        const confirmSaleButton = document.getElementById('confirm-sale-button');
        const addPaymentForm = document.getElementById('add-payment-form');
        const scannerModal = document.getElementById('scanner-modal');
        const editCustomerModal = document.getElementById('edit-customer-modal');
        const debtPaymentModal = document.getElementById('debt-payment-modal');
        
        // --- FUNÇÕES DE RENDERIZAÇÃO E UTILIDADES ---
        const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formatDateTime = (date) => date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

        window.showModal = function(title, message, warningMessage = '') {
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
        });


        // --- LÓGICA DAS ABAS ---
        window.changeTab = function(tabName) {
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
        
        // --- RENDERIZAÇÃO GERAL E INICIALIZAÇÃO ---
        function renderAll() {
            renderDashboardTab();
            renderCashRegisterTab();
            renderPdvTab();
            renderInventoryTab();
            renderCustomersTab();
            renderReportsTab();
            updateCashRegisterStatus();
        }

        // --- CARREGAMENTO DE DADOS ---
        async function loadInitialData() {
            console.log("A procurar dados na base de dados...");
            try {
                const productsSnapshot = await getDocs(collection(db, "products"));
                products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const customersSnapshot = await getDocs(collection(db, "customers"));
                customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const daysSnapshot = await getDocs(collection(db, "closedDays"));
                closedDays = daysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                console.log("Dados carregados!", { products, customers, closedDays });
                console.log('Produtos carregados:', products);
            } catch (error) {
                console.error("Erro ao carregar dados iniciais:", error);
                showModal("Erro de Conexão", "Não foi possível carregar os dados da base de dados. Verifique a sua conexão e as regras de segurança do Firestore.");
            }
        }

        // --- RENDERIZAÇÃO ESPECÍFICA DE CADA ABA ---
        function renderDashboardTab() {
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
        
        function renderCashRegisterTab() {
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
            document.getElementById('open-day-form')?.addEventListener('submit', handleOpenDay);
            document.getElementById('close-shift-button')?.addEventListener('click', handleCloseShift);
            document.getElementById('open-shift-form')?.addEventListener('submit', handleOpenShift);
            document.getElementById('close-day-button')?.addEventListener('click', handleCloseDay);
        }

        function renderPdvTab() {
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
                        <h3 class="font-semibold text-xl text-gray-700 mb-4 border-t pt-4">Ou adicione manualmente</h3>
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
            document.getElementById('start-sale-button').addEventListener('click', startNewSale);
            document.getElementById('checkout-button').addEventListener('click', handleCheckout);
            document.getElementById('barcode-input-field').addEventListener('keypress', handleBarcodeKeypress);
            renderProductList();
            renderCart();
        }

        function renderInventoryTab() {
             contentInventory.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div class="mb-8">
                            <h3 class="font-semibold text-xl text-gray-700 mb-4">Entrada Rápida de Estoque</h3>
                            <div class="bg-gray-50 p-6 rounded-lg">
                                <p class="text-gray-600 mb-4 text-center">Use a câmera para escanear o código de barras:</p>
                                <button id="scan-inventory-button" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M3 6h18"></path><path d="M3 10h18"></path><path d="M3 14h18"></path><path d="M3 18h18"></svg>
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
            document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
            document.getElementById('scan-inventory-button').addEventListener('click', startInventoryScan);
            renderInventoryManagement();
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
                           <!-- Lista de devedores será inserida aqui -->
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('add-customer-form').addEventListener('submit', handleAddCustomer);
            renderDebtorsList();
        }
        
        function renderReportsTab() {
            contentReports.innerHTML = `
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Histórico de Dias de Operação</h3>
                <div id="session-reports-container" class="space-y-6">
                </div>
            `;
            renderSessionReports();
        }
        
        // --- LÓGICA DE GESTÃO DE CAIXA ---
        function updateCashRegisterStatus() {
            tabPdv.disabled = !currentShift;
        }
        
        function handleOpenDay(event) {
            event.preventDefault();
            const initialCash = parseFloat(document.getElementById('initial-cash').value);
            const openedBy = document.getElementById('opening-user').value;
            if (isNaN(initialCash) || initialCash < 0) {
                showModal('Valor Inválido', 'Por favor, insira um valor inicial válido.');
                return;
            }
            currentDay = { id: closedDays.length + 1, date: new Date(), initialCash, shifts: [], status: 'open' };
            handleOpenShift(null, openedBy);
        }

        function handleOpenShift(event, user) {
            if(event) event.preventDefault();
            const openedBy = user || document.getElementById('next-opening-user').value;
            currentShift = { id: currentDay.shifts.length + 1, startTime: new Date(), endTime: null, openedBy, closedBy: null, sales: [], debtPayments: [] };
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
            currentShift = null;
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
            closedDays.push(currentDay);
            currentDay = null;
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

        function renderDebtorsList() {
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
        function resetPdv() {
            cart = [];
            renderCart();
            document.getElementById('pdv-idle-screen').classList.remove('hidden');
            document.getElementById('pdv-active-sale').classList.add('hidden');
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
            console.log('Código escaneado:', scannedCode);
            const product = products.find(p => p.barcode === scannedCode);
            console.log('Produto encontrado (handleBarcodeScan):', product);
            if (product) {
                addToCart(product.sku);
            } else {
                showModal('Produto não encontrado', `Nenhum produto corresponde ao código '${scannedCode}'.`);
            }
        }

        function addToCart(sku) {
            console.log('Chamado addToCart com SKU:', sku);
            const product = products.find(p => p.sku === sku);
            console.log('Produto encontrado (addToCart):', product);
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
        
        function renderCart() {
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
            if (cartItem.quantity <= 0) cart = cart.filter(item => item.sku !== sku);
            if (cart.length === 0) resetPdv();
            renderCart();
        }

        function handleCheckout() {
            if (cart.length === 0) return;
            saleInProgress = {
                items: JSON.parse(JSON.stringify(cart)),
                total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                payments: [],
                customerId: 1,
            };
            selectedPaymentMethod = 'Dinheiro'; // Reseta para o padrão
            renderPaymentModal();
            paymentModal.classList.remove('hidden');
            setTimeout(() => paymentModal.querySelector('div').classList.add('scale-100'), 10);
        }
        
        function renderPaymentModal() {
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
        
        window.closePaymentModal = function() {
            paymentModal.querySelector('div').classList.remove('scale-100');
            setTimeout(() => paymentModal.classList.add('hidden'), 200);
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
        function renderProductList() {
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
        
        function renderInventoryManagement() {
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

    try {
        // A "magia" acontece aqui:
        // 1. Dizemos para adicionar um novo "documento" (o nosso produto)...
        // 2. ... na "coleção" (gaveta) chamada "products".
        await addDoc(collection(db, "products"), newProduct);

        showModal('Sucesso!', 'Produto adicionado à base de dados.');
        document.getElementById('add-product-form').reset();
        
        // Recarrega os dados da nuvem para mostrar a lista atualizada
        await loadInitialData(); 
        renderInventoryManagement(); // Redesenha a tabela de stock

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
                    
                    // Update local data and re-render
                    await loadInitialData();
                    renderInventoryManagement();
                    showModal('Sucesso', `${quantityToAdd} unidades de ${product.name} adicionadas ao estoque.`);
                }
            } catch (error) {
                console.error("Erro ao atualizar estoque:", error);
                showModal('Erro de Base de Dados', 'Não foi possível atualizar o estoque do produto.');
            }
        }

        

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

        async function handleInventoryScanResult(barcode) {
            if (!barcode || barcode.trim() === '') return;

            const product = products.find(p => p.barcode === barcode.trim());
            if (product) {
                const quantityStr = prompt(`Produto encontrado: ${product.name}\nEstoque atual: ${product.stock}\n\nQual a quantidade a adicionar?`);
                const quantity = parseInt(quantityStr);
                if (!isNaN(quantity) && quantity > 0) {
                    await updateProductStock(product.id, quantity);
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
        
        function renderSessionReports() {
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

        // --- INICIALIZAÇÃO E EVENTOS ---
        document.addEventListener('DOMContentLoaded', () => {
            loginForm.addEventListener('submit', handleLogin);
            logoutButton.addEventListener('click', handleLogout);
            forgotPasswordLink.addEventListener('click', handleForgotPassword);
            addPaymentForm.addEventListener('submit', handleAddPayment);
            confirmSaleButton.addEventListener('click', confirmSale);
            document.getElementById('stop-scanner-button')?.addEventListener('click', stopInventoryScan);
            document.getElementById('update-customer-button')?.addEventListener('click', handleUpdateCustomer);
            document.getElementById('confirm-debt-payment-button')?.addEventListener('click', handleConfirmDebtPayment);
            paymentModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('payment-method-btn')) {
                    selectedPaymentMethod = e.target.dataset.method;
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

            onAuthStateChanged(auth, user => {
                if (user) {
                    loginScreen.classList.add('hidden');
                    mainApp.classList.remove('hidden');
                    mainApp.classList.add('flex');
                    renderAll();
                } else {
                    loginScreen.classList.remove('hidden');
                    mainApp.classList.add('hidden');
                    mainApp.classList.remove('flex');
                }
            });
        });