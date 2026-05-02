import { getApps, initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Only initialize on the client side
function getFirebaseAuth() {
  if (typeof window === 'undefined') return null
  if (!firebaseConfig.apiKey) return null
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  return getAuth(app)
}

export async function signInWithGoogle(): Promise<string> {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase not available')
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  return result.user.getIdToken()
}

export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase not available')
  return new RecaptchaVerifier(auth, containerId, { size: 'invisible', callback: () => {} })
}

export async function sendOTP(phone: string, recaptchaVerifier: RecaptchaVerifier): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase not available')
  return signInWithPhoneNumber(auth, phone, recaptchaVerifier)
}

export async function verifyOTP(confirmationResult: ConfirmationResult, otp: string): Promise<string> {
  const result = await confirmationResult.confirm(otp)
  return result.user.getIdToken()
}

export async function firebaseSignOut(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth) await signOut(auth)
}

export type { FirebaseUser, ConfirmationResult }
