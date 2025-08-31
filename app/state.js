
// --- ESTADO DA APLICAÇÃO ---

// Este arquivo centraliza os dados que a aplicação manipula em tempo de execução.

export let products = [];
export let customers = [];
export const users = ['Edson', 'Edna']; // Mantido como constante, pode virar uma coleção no futuro
export let cart = [];
export let closedDays = [];
export let currentDay = null;
export let currentShift = null;
export let saleInProgress = {};
export let selectedPaymentMethod = 'Dinheiro';

// Funções para modificar o estado (setters)
export function setProducts(newProducts) {
    products = newProducts;
}

export function setCustomers(newCustomers) {
    customers = newCustomers;
}

export function setCart(newCart) {
    cart = newCart;
}

export function setClosedDays(newClosedDays) {
    closedDays = newClosedDays;
}

export function setCurrentDay(newCurrentDay) {
    currentDay = newCurrentDay;
}

export function setCurrentShift(newCurrentShift) {
    currentShift = newCurrentShift;
}

export function setSaleInProgress(newSale) {
    saleInProgress = newSale;
}

export function setSelectedPaymentMethod(method) {
    selectedPaymentMethod = method;
}
