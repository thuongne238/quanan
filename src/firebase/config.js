import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDZRVdnSK7kjsd5HJBvwpH0VqrGjQNpioQ",
  authDomain: "quanan-296e9.firebaseapp.com",
  databaseURL: "https://quanan-296e9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quanan-296e9",
  storageBucket: "quanan-296e9.firebasestorage.app",
  messagingSenderId: "451613049358",
  appId: "1:451613049358:web:03a2d7cb338b71b21d725f",
  measurementId: "G-PC9VLHPNYR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
