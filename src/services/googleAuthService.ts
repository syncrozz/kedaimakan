import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export class GoogleAuthService {
  private static appInitialized = false;

  private static getAuth() {
    if (!isFirebaseConfigured()) {
      throw new Error('Konfigurasi Firebase belum lengkap.');
    }
    if (!this.appInitialized) {
      const app = getApps().length
        ? getApp()
        : initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId,
            appId: firebaseConfig.appId,
            storageBucket: firebaseConfig.storageBucket,
            messagingSenderId: firebaseConfig.messagingSenderId,
          });
      this.appInitialized = true;
      return getAuth(app);
    }
    return getAuth(getApp());
  }

  public static async signIn(): Promise<{ user: User; idToken: string }> {
    const auth = this.getAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken(true);
    return { user: result.user, idToken };
  }

  public static async signOut(): Promise<void> {
    const auth = this.getAuth();
    await signOut(auth);
  }
}
