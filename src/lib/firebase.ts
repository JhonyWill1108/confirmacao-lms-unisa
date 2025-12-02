import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// IMPORTANT: Replace these with your Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyB2MwHPr-rnaWdxBoi2_c3A-R_C6Sc5pyE",
  authDomain: "sistema-agendamento-lms.firebaseapp.com",
  projectId: "sistema-agendamento-lms",
  storageBucket: "sistema-agendamento-lms.firebasestorage.app",
  messagingSenderId: "803357220077",
  appId: "1:803357220077:web:6a83d4602759915b1dc0e4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
