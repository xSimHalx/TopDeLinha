// CORREÇÃO: As importações do Firebase e a lógica principal foram unificadas aqui.
      import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
      import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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
        const contentActivities = document.getElementById('content-activities');
        const tabPdv = document.getElementById('tab-pdv');
        const paymentModal = document.getElementById('payment-modal');
        const confirmSaleButton = document.getElementById('confirm-sale-button');
        const addPaymentForm = document.getElementById('add-payment-form');
        const scannerModal = document.getElementById('scanner-modal');
        const editCustomerModal = document.getElementById('edit-customer-modal');
        const debtPaymentModal = document.getElementById('debt-payment-modal');
        const receiptModal = document.getElementById('receipt-modal');
        
        // --- FUNÇÕES DE RENDERIZAÇÃO E UTILIDADES ---
        const formatCurrency = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formatDateTime = (date) => new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

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
            if (tabName === 'activities') renderActivityTab();
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
            try {
                const productsSnapshot = await getDocs(collection(db, "products"));
                products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const customersSnapshot = await getDocs(collection(db, "customers"));
                customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const daysSnapshot = await getDocs(collection(db, "closedDays"));
                closedDays = daysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            } catch (error) {
                console.error("Erro ao carregar dados iniciais:", error);
                showModal("Erro de Conexão", "Não foi possível carregar os dados da base de dados. Verifique a sua conexão e as regras de segurança do Firestore.");
            }
        }

        // --- LOG DE ATIVIDADES ---
        async function logActivity(type, details, user = 'Sistema') {
            try {
                await addDoc(collection(db, "activity_log"), {
                    timestamp: new Date().toISOString(),
                    type,
                    user,
                    details
                });
            } catch (error) {
                console.error("Erro ao registrar atividade no log:", error);
            }
        }

        // --- RENDERIZAÇÃO ESPECÍFICA DE CADA ABA ---
        function renderDashboardTab() {
            const totalSalesToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).reduce((sum, sale) => sum + sale.total, 0) : 0;
            const salesCountToday = currentDay ? currentDay.shifts.flatMap(s => s.sales).length : 0;
            const lowStockItems = products.filter(p => p.stock <= 2);
            const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);

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
            `;
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
                <h3 class="font-semibold text-xl text-gray-700 mb-4">Histórico de Dias de Operação</h3>
                <div id="session-reports-container" class="space-y-6">
                </div>
            `;
            renderSessionReports();
        }

        async function renderActivityTab() {
            contentActivities.innerHTML = `<h3 class="font-semibold text-xl text-gray-700 mb-4">Log de Atividades Recentes</h3><div id="activities-list-container">Carregando...</div>`;
            
            try {
                const q = query(collection(db, "activity_log"), orderBy("timestamp", "desc"), limit(50));
                const logSnapshot = await getDocs(q);
                const logs = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const container = document.getElementById('activities-list-container');
                if (logs.length === 0) {
                    container.innerHTML = '<p class="text-gray-500">Nenhuma atividade registrada ainda.</p>';
                    return;
                }

                container.innerHTML = logs.map(log => {
                    let detailsText = '';
                    switch(log.type) {
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
                        default:
                            detailsText = JSON.stringify(log.details);
                    }

                    return `
                        <div class="border-b p-3 hover:bg-gray-50">
                            <p class="font-semibold text-gray-800">${log.type.replace(/_/g, ' ')}</p>
                            <p class="text-sm text-gray-600">${detailsText}</p>
                            <p class="text-xs text-gray-400 mt-1">${formatDateTime(log.timestamp)} por ${log.user}</p>
                        </div>
                    `;
                }).join('');

            } catch (error) {
                console.error("Erro ao carregar log de atividades:", error);
                document.getElementById('activities-list-container').innerHTML = '<p class="text-red-500">Erro ao carregar atividades.</p>';
            }
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
        async function handleAddCustomer(event) { 
            event.preventDefault();
            const name = document.getElementById('new-customer-name').value.trim();
            const phone = document.getElementById('new-customer-phone').value.trim();
            const debt = parseFloat(document.getElementById('new-customer-debt').value) || 0;
            if (!name) {
                showModal('Erro', 'O nome do cliente é obrigatório.');
                return;
            }
            const newCustomer = { name, phone, debt };
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
            
            const debtors = customers.filter(c => c.id !== 1); // Exclui o cliente padrão
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
        
        window.openDebtPaymentModal = function(customerId) {
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

        window.closeDebtPaymentModal = function() {
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

        window.openEditCustomerModal = function(customerId) {
            const customer = customers.find(c => c.id === customerId);
            if (!customer) return;

            document.getElementById('edit-customer-id').value = customer.id;
            document.getElementById('edit-customer-name').value = customer.name;
            document.getElementById('edit-customer-phone').value = customer.phone || '';
            document.getElementById('edit-customer-debt').value = (customer.debt || 0).toFixed(2);
            
            editCustomerModal.classList.remove('hidden');
        }

        window.closeEditCustomerModal = function() {
            editCustomerModal.classList.add('hidden');
        }

        async function handleUpdateCustomer() {
            const customerId = document.getElementById('edit-customer-id').value;
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
            const product = products.find(p => p.barcode === scannedCode);
            if (product) {
                addToCart(product.sku);
            } else {
                showModal('Produto não encontrado', `Nenhum produto corresponde ao código '${scannedCode}'.`);
            }
        }

        function addToCart(sku) {
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
            } else {
                cart.push({ ...product, quantity: 1 });
            }
            renderCart();
        }
        
        function renderCart() {
            const cartItemsEl = document.getElementById('cart-items');
            const checkoutButton = document.getElementById('checkout-button');
            const cartTotalEl = document.getElementById('cart-total');
            if(!cartItemsEl || !checkoutButton || !cartTotalEl) return;
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
            selectedPaymentMethod = 'Dinheiro';
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
                saleCanBeConfirmed = customerId !== 1;
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
                await updateDoc(customerRef, { debt: newDebt });
                saleInProgress.payments = [{ method: 'Fiado', amount: saleInProgress.total }];
            }

            saleInProgress.id = (currentShift.sales.length + 1);
            saleInProgress.date = new Date().toISOString();
            currentShift.sales.push(saleInProgress);

            // Update stock in Firestore
            for(const cartItem of saleInProgress.items) {
                const productRef = doc(db, "products", cartItem.id);
                const newStock = cartItem.stock - cartItem.quantity;
                await updateDoc(productRef, { stock: newStock });
            }
            
            const totalPaid = saleInProgress.payments.reduce((sum, p) => sum + p.amount, 0);
            const change = totalPaid > saleInProgress.total ? totalPaid - saleInProgress.total : 0;

            const customer = customers.find(c => c.id === saleInProgress.customerId);
            await logActivity('VENDA_CRIADA', {
                saleId: saleInProgress.id,
                shiftId: currentShift.id,
                total: saleInProgress.total,
                customerName: customer ? customer.name : 'Consumidor Final',
                items: saleInProgress.items.map(i => `${i.quantity}x ${i.name}`)
            }, currentShift.openedBy);

            await loadInitialData();
            renderAll();
            resetPdv();
            closePaymentModal();
            
            renderReceipt(saleInProgress, change);
        }

        function renderReceipt(saleData, change) {
            document.getElementById('receipt-date').textContent = formatDateTime(saleData.date);
            document.getElementById('receipt-sale-id').textContent = saleData.id;
            document.getElementById('receipt-shift-id').textContent = currentShift.id;
            
            const customer = customers.find(c => c.id === saleData.customerId);
            document.getElementById('receipt-customer').textContent = customer ? customer.name : 'Consumidor Final';

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
                addButton.textContent = 'Add';
                addButton.className = `mt-3 w-full text-sm font-bold py-2 rounded-md ${productInStock ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`;
                addButton.disabled = !productInStock;
                
                if(productInStock) {
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

            // Verificação de SKU duplicado
            const existingProduct = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
            if (existingProduct) {
                showModal('SKU Duplicado', `O SKU "${sku}" já está sendo utilizado pelo produto "${existingProduct.name}". Por favor, use um código diferente.`);
                return;
            }

            const newProduct = { sku, barcode, name, price, stock, minStock };

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
                const quantityStr = prompt(`Produto encontrado: ${product.name}
Estoque atual: ${product.stock}

Qual a quantidade a adicionar?`);
                const quantity = parseInt(quantityStr);
                if (!isNaN(quantity) && quantity > 0) {
                    await updateProductStock(product.id, quantity);
                } else if(quantityStr !== null) {
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
                                        <p class="text-sm text-gray-600">Data: ${formatDateTime(day.date)}</p>
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
            // --- Static Listeners (these elements are always in the DOM) ---
            loginForm.addEventListener('submit', handleLogin);
            logoutButton.addEventListener('click', handleLogout);
            forgotPasswordLink.addEventListener('click', handleForgotPassword);
            addPaymentForm.addEventListener('submit', handleAddPayment);
            confirmSaleButton.addEventListener('click', confirmSale);
            document.getElementById('stop-scanner-button')?.addEventListener('click', stopInventoryScan);
            document.getElementById('update-customer-button')?.addEventListener('click', handleUpdateCustomer);
            document.getElementById('confirm-debt-payment-button')?.addEventListener('click', handleConfirmDebtPayment);
            document.getElementById('print-receipt-button').addEventListener('click', printReceipt);
            document.getElementById('close-receipt-button').addEventListener('click', closeReceiptModal);

            // --- Event Delegation for Dynamic Content ---
            document.getElementById('open-day-form')?.addEventListener('submit', handleOpenDay);
            document.getElementById('close-shift-button')?.addEventListener('click', handleCloseShift);
            document.getElementById('open-shift-form')?.addEventListener('submit', handleOpenShift);
            document.getElementById('close-day-button')?.addEventListener('click', handleCloseDay);

            contentPdv.addEventListener('click', function(e) {
                if (e.target.id === 'start-sale-button') startNewSale(e);
                if (e.target.id === 'checkout-button') handleCheckout(e);
            });
            contentPdv.addEventListener('keypress', function(e) {
                if (e.target.id === 'barcode-input-field') handleBarcodeKeypress(e);
            });

            contentInventory.addEventListener('submit', function(e) {
                if (e.target.id === 'add-product-form') handleAddProduct(e);
            });
            contentInventory.addEventListener('click', function(e) {
                if (e.target.id === 'scan-inventory-button') startInventoryScan(e);
            });

            contentCustomers.addEventListener('submit', function(e) {
                if (e.target.id === 'add-customer-form') handleAddCustomer(e);
            });

            paymentModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('payment-method-btn')) {
                    selectedPaymentMethod = e.target.dataset.method;
                    renderPaymentModal();
                }
            });
            
            debtPaymentModal.addEventListener('click', (e) => {
                if (e.target.id === 'pay-full-debt-button') {
                    const customerId = document.getElementById('debt-customer-id').value;
                    const customer = customers.find(c => c.id === customerId);
                    if(customer) {
                        document.getElementById('debt-payment-amount').value = (customer.debt || 0).toFixed(2);
                    }
                }
            });
        });
