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
  apiKey: Constants.expoConfig?.extra?.prodFirebaseApiKey || process.env.PROD_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.prodFirebaseAuthDomain || process.env.PROD_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.prodFirebaseProjectId || process.env.PROD_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.prodFirebaseStorageBucket || process.env.PROD_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.prodFirebaseMessagingSenderId || process.env.PROD_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.prodFirebaseAppId || process.env.PROD_FIREBASE_APP_ID,
};

// Select config based on environment
const firebaseConfig = ENV === 'production' ? prodConfig : devConfig;

// Validate that all required config fields are present
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
if (missingFields.length > 0) {
  throw new Error(`Firebase-konfiguration saknar fält: ${missingFields.join(', ')}. Kontrollera dina miljövariabler.`);
}

// Initiera Firebase
const app = initializeApp(firebaseConfig);

// Initiera och exportera de tjänster du behöver
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

