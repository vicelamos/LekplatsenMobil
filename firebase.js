import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Ersätt detta med din EGEN Firebase-konfiguration!
// Du hittar den i ditt Firebase-projekts inställningar
const firebaseConfig = {
  apiKey: "AIzaSyDc4x-o1UdumBWqgbsz82ZyJRi_wPrH80U",
  authDomain: "lekplatsen-907fb.firebaseapp.com",
  projectId: "lekplatsen-907fb",
  storageBucket: "lekplatsen-907fb.firebasestorage.app",
  messagingSenderId: "802816415281",
  appId: "1:802816415281:web:0f5eab57a99443b8d46710",
};
// Initiera Firebase
const app = initializeApp(firebaseConfig);

// Initiera och exportera de tjänster du behöver
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

