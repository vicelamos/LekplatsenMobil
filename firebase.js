import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import Constants from 'expo-constants';

// Get environment from Expo config
const ENV = Constants.expoConfig?.extra?.appEnv || process.env.APP_ENV || 'development';

// Development configuration
const devConfig = {
  apiKey: Constants.expoConfig?.extra?.devFirebaseApiKey || process.env.DEV_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.devFirebaseAuthDomain || process.env.DEV_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.devFirebaseProjectId || process.env.DEV_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.devFirebaseStorageBucket || process.env.DEV_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.devFirebaseMessagingSenderId || process.env.DEV_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.devFirebaseAppId || process.env.DEV_FIREBASE_APP_ID,
};

// Production configuration
const prodConfig = {
  apiKey: Constants.expoConfig?.extra?.prodFirebaseApiKey || process.env.PROD_FIREBASE_API_KEY || "AIzaSyDc4x-o1UdumBWqgbsz82ZyJRi_wPrH80U",
  authDomain: Constants.expoConfig?.extra?.prodFirebaseAuthDomain || process.env.PROD_FIREBASE_AUTH_DOMAIN || "lekplatsen-907fb.firebaseapp.com",
  projectId: Constants.expoConfig?.extra?.prodFirebaseProjectId || process.env.PROD_FIREBASE_PROJECT_ID || "lekplatsen-907fb",
  storageBucket: Constants.expoConfig?.extra?.prodFirebaseStorageBucket || process.env.PROD_FIREBASE_STORAGE_BUCKET || "lekplatsen-907fb.firebasestorage.app",
  messagingSenderId: Constants.expoConfig?.extra?.prodFirebaseMessagingSenderId || process.env.PROD_FIREBASE_MESSAGING_SENDER_ID || "802816415281",
  appId: Constants.expoConfig?.extra?.prodFirebaseAppId || process.env.PROD_FIREBASE_APP_ID || "1:802816415281:web:0f5eab57a99443b8d46710",
};

// Select config based on environment
const firebaseConfig = ENV === 'production' ? prodConfig : devConfig;

console.log(`🔥 Firebase initialized in ${ENV} mode`);
console.log(`📦 Using project: ${firebaseConfig.projectId}`);

// Initiera Firebase
const app = initializeApp(firebaseConfig);

// Initiera och exportera de tjänster du behöver
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

