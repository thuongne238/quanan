import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { auth, db } from './config';

// Create a new user without logging out current user (uses secondary app)
export const createUserAccount = async (email, password, userData) => {
  const secondaryApp = initializeApp(auth.app.options, 'Secondary');
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName: userData.displayName || '',
      role: userData.role || 'staff',
    });
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return cred.user.uid;
  } catch (err) {
    try { await deleteApp(secondaryApp); } catch {}
    throw err;
  }
};

export const loginWithEmail = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
  const userData = userDoc.exists() ? userDoc.data() : { role: 'staff' };
  return { ...cred.user, ...userData };
};

export const logout = () => signOut(auth);

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { role: 'staff' };
      callback({ ...user, ...userData });
    } else {
      callback(null);
    }
  });
};
