import {
  signInWithPopup,
  signInWithRedirect,
  type AuthError,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/cancelled-popup-request',
]);

export const getGoogleSignInErrorMessage = (error: unknown): string => {
  const code = (error as Partial<AuthError>)?.code;

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'This browser address is not allowed in Firebase Auth. Use http://localhost:5173 or add the current domain in Firebase.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before login finished.';
    case 'auth/network-request-failed':
      return 'Google sign-in could not reach Firebase. Check your internet connection and try again.';
    default:
      return 'Google sign-in failed. Check the browser console for details.';
  }
};

export const signInWithGoogle = async (): Promise<void> => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code = (error as Partial<AuthError>)?.code;

    if (code && POPUP_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    throw error;
  }
};
