// ? IMPORTAR FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import { 
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ?? IMPORTANTE (te falta esto)
import { 
  getFirestore 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ? CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAgPVgK6BJbxmv7NI2hXN4NdlnyMtfNGKI",
  authDomain: "dava-nails.firebaseapp.com",
  projectId: "dava-nails",
  storageBucket: "dava-nails.firebasestorage.app",
  messagingSenderId: "92839130296",
  appId: "1:92839130296:web:b03bbd0af96cc58186704d"
};

// ? INIT
const app = initializeApp(firebaseConfig);

// ? AUTH
export const auth = getAuth(app);

// ? FIRESTORE (esto faltaba ??)
export const db = getFirestore(app);

// ? PERSISTENCIA
setPersistence(auth, browserLocalPersistence);
