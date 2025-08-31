
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { auth } from './firebase.js';
import { showModal } from './ui.js';
import { loadInitialData } from './database.js';
import { renderAll } from './main.js'; // renderAll será movido para o main

const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');

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

export function initializeAuth() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const logoutButton = document.getElementById('logout-button');

    loginForm.addEventListener('submit', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    forgotPasswordLink.addEventListener('click', handleForgotPassword);

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
}
