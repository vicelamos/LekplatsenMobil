import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email, password, profileData) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    ...profileData,
    email: email.trim().toLowerCase(),
    skapades: serverTimestamp(),
    totalCheckinCount: 0,
    friends: [],
    visitedPlaygroundIds: [],
    profilbildUrl: '',
    trophyProgress: { TOTAL_CHECKINS: 0, UNIQUE_PLAYGROUNDS: 0 },
  });
  return cred;
}

export async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  return signOut(auth);
}

export async function deleteAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error('Ingen inloggad användare');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  // Radera underkollektioner
  const subcollections = ['unlockedTrophies', 'notifications', 'completedChallenges', 'klaradeUtmaningar'];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'users', user.uid, sub));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}
