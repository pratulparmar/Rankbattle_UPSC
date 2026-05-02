import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Prevent duplicate initialization in Next.js hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// ── Google Sign In ─────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider)
  const idToken = await result.user.getIdToken()
  return idToken
}

// ── Phone Sign In ──────────────────────────────────────────────────────────────
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
  })
}

export async function sendOTP(
  phone: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phone, recaptchaVerifier)
}

export async function verifyOTP(
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<string> {
  const result = await confirmationResult.confirm(otp)
  const idToken = await result.user.getIdToken()
  return idToken
}

// ── Sign Out ───────────────────────────────────────────────────────────────────
export async function firebaseSignOut(): Promise<void> {
  await signOut(auth)
}

export type { FirebaseUser, ConfirmationResult }