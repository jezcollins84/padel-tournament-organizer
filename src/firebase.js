import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCscy3uEe1y1n-2U43G9CgFwU4YNhz9Yk",
  authDomain: "padel-tournament-organiz-9ad55.firebaseapp.com",
  projectId: "padel-tournament-organiz-9ad55",
  storageBucket: "padel-tournament-organiz-9ad55.firebasestorage.app",
  messagingSenderId: "941108670951",
  appId: "1:941108670951:web:ee196058c70ec370cdcd42"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
