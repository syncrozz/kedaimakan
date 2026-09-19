/**
 * NiagaPOS V2 - Firebase Configuration
 * 
 * Isolated Firebase configuration for NiagaPOS V2.
 * Strictly decoupled from NiagaPOS V1 to ensure 100% data safety.
 */

import firebaseAppletConfig from '../../firebase-applet-config.json';

export interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

// Support Vite client-side environment variables or fallback to isolated config file
const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const env: Record<string, string | undefined> = metaEnv || {};

export const firebaseConfig: FirebaseConfig = {
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || firebaseAppletConfig.projectId || '',
  appId: (env.VITE_FIREBASE_APP_ID as string) || firebaseAppletConfig.appId || '',
  apiKey: (env.VITE_FIREBASE_API_KEY as string) || firebaseAppletConfig.apiKey || '',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseAppletConfig.authDomain || '',
  firestoreDatabaseId: (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || firebaseAppletConfig.firestoreDatabaseId || '',
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseAppletConfig.storageBucket || '',
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseAppletConfig.messagingSenderId || '',
  measurementId: (env.VITE_FIREBASE_MEASUREMENT_ID as string) || firebaseAppletConfig.measurementId || '',
};

/**
 * Validates whether isolated Firebase credentials for NiagaPOS V2 are configured.
 * Strictly verifies that the configuration does NOT point to NiagaPOS V1.
 */
export function isFirebaseConfigured(): boolean {
  if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
    return false;
  }
  // Hard block any accidental usage of NiagaPOS V1 credentials
  if (
    firebaseConfig.projectId === 'gen-lang-client-0739778545' ||
    firebaseConfig.firestoreDatabaseId === 'ai-studio-kedaipapa-83cf9f6a-4d6f-4cdd-8a1c-b5bf36caa265'
  ) {
    console.warn(
      '[NiagaPOS V2 Security] Blocked attempt to connect to NiagaPOS V1 production Firebase. Please provide dedicated NiagaPOS V2 credentials.'
    );
    return false;
  }
  return true;
}
