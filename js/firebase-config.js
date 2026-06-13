
// Importar Firebase correctamente
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Configuración de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyAgPVgK6BJbxmv7NI2hXN4NdlnyMtfNGKI",
  authDomain: "dava-nails.firebaseapp.com",
  projectId: "dava-nails",
  storageBucket: "dava-nails.firebasestorage.app",
  messagingSenderId: "92839130296",
  appId: "1:92839130296:web:b03bbd0af96cc58186704d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ? CLAVE: mantener sesión SIEMPRE
setPersistence(auth, browserLocalPersistence);



