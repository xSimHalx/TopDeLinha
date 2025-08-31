
// --- CONFIGURAÇÃO DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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
  alert("Erro de configuração. Verifique as chaves do Firebase no código.");
}

export { db, auth };
