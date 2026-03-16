// Load environment variables from .env file
require('dotenv').config();

// Dynamic Expo config that supports EAS environment variables
const baseConfig = require('./app.json');

module.exports = ({ config }) => {
  // Deep clone to avoid mutating the cached module
  const finalConfig = JSON.parse(JSON.stringify(baseConfig.expo));

  // Set environment in extra for runtime access
  finalConfig.extra = {
    ...finalConfig.extra,
    appEnv: process.env.APP_ENV || 'development',
    // Dev Firebase config
    devFirebaseApiKey: process.env.DEV_FIREBASE_API_KEY,
    devFirebaseAuthDomain: process.env.DEV_FIREBASE_AUTH_DOMAIN,
    devFirebaseProjectId: process.env.DEV_FIREBASE_PROJECT_ID,
    devFirebaseStorageBucket: process.env.DEV_FIREBASE_STORAGE_BUCKET,
    devFirebaseMessagingSenderId: process.env.DEV_FIREBASE_MESSAGING_SENDER_ID,
    devFirebaseAppId: process.env.DEV_FIREBASE_APP_ID,
    // Prod Firebase config
    prodFirebaseApiKey: process.env.PROD_FIREBASE_API_KEY,
    prodFirebaseAuthDomain: process.env.PROD_FIREBASE_AUTH_DOMAIN,
    prodFirebaseProjectId: process.env.PROD_FIREBASE_PROJECT_ID,
    prodFirebaseStorageBucket: process.env.PROD_FIREBASE_STORAGE_BUCKET,
    prodFirebaseMessagingSenderId: process.env.PROD_FIREBASE_MESSAGING_SENDER_ID,
    prodFirebaseAppId: process.env.PROD_FIREBASE_APP_ID,
  };

  // Use EAS file environment variable for google-services.json if available
  if (process.env.GOOGLE_SERVICES_JSON) {
    finalConfig.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }

  // Use EAS file environment variable for GoogleService-Info.plist if available
  if (process.env.GOOGLE_SERVICE_INFO_PLIST) {
    finalConfig.ios.googleServicesFile = process.env.GOOGLE_SERVICE_INFO_PLIST;
  }

  return finalConfig;
};
