
import { collection, getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';
import { setProducts, setCustomers, setClosedDays, products } from './state.js';
import { showModal } from './ui.js';
import { renderInventoryManagement } from "./ui.js";

// --- CARREGAMENTO DE DADOS ---
export async function loadInitialData() {
    console.log("A procurar dados na base de dados...");
    try {
        const productsSnapshot = await getDocs(collection(db, "products"));
        setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const customersSnapshot = await getDocs(collection(db, "customers"));
        setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const daysSnapshot = await getDocs(collection(db, "closedDays"));
        setClosedDays(daysSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        console.log("Dados carregados!", { products: products });
    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showModal("Erro de Conexão", "Não foi possível carregar os dados da base de dados. Verifique a sua conexão e as regras de segurança do Firestore.");
    }
}

export async function addProduct(newProduct) {
    try {
        await addDoc(collection(db, "products"), newProduct);
        showModal('Sucesso!', 'Produto adicionado à base de dados.');
        await loadInitialData(); 
        renderInventoryManagement();
    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        showModal('Erro de Base de Dados', 'Não foi possível guardar o produto.');
    }
}

export async function updateProductStock(productId, quantity) {
    const productRef = doc(db, "products", productId);
    try {
        await updateDoc(productRef, {
            stock: quantity
        });
        await loadInitialData();
        renderInventoryManagement();
    } catch (error) {
        console.error("Erro ao atualizar stock:", error);
        showModal('Erro de Base de Dados', 'Não foi possível atualizar o stock do produto.');
    }
}

export async function saveDay(dayObject) {
    try {
        const docRef = await addDoc(collection(db, "days"), dayObject);
        return docRef.id;
    } catch (error) {
        console.error("Erro ao salvar o dia:", error);
        showModal('Erro de Base de Dados', 'Não foi possível salvar o dia.');
    }
}

export async function updateDay(dayId, dayObject) {
    try {
        const dayRef = doc(db, "days", dayId);
        await updateDoc(dayRef, dayObject);
    } catch (error) {
        console.error("Erro ao atualizar o dia:", error);
        showModal('Erro de Base de Dados', 'Não foi possível atualizar o dia.');
    }
}

export async function addCustomer(customerObject) {
    try {
        await addDoc(collection(db, "customers"), customerObject);
        await loadInitialData();
        renderDebtorsList();
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showModal('Erro de Base de Dados', 'Não foi possível adicionar o cliente.');
    }
}

export async function updateCustomer(customerId, customerObject) {
    try {
        const customerRef = doc(db, "customers", customerId);
        await updateDoc(customerRef, customerObject);
        await loadInitialData();
        renderDebtorsList();
    } catch (error) {
        console.error("Erro ao atualizar cliente:", error);
        showModal('Erro de Base de Dados', 'Não foi possível atualizar o cliente.');
    }
}
