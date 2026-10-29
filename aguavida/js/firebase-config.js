import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhD2XOZYRpKCp-i9M1WkMomgtMY-E30P8",
  authDomain: "aguavida-814e2.firebaseapp.com",
  projectId: "aguavida-814e2",
  storageBucket: "aguavida-814e2.firebasestorage.app",
  messagingSenderId: "101558571492",
  appId: "1:101558571492:web:4f79ee09f1ef224d4937f1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);