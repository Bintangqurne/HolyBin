// services/auth.service.ts
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AdminUser } from "@/types/user";

export async function loginAdmin(
  email: string,
  password: string
): Promise<AdminUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Update last login
  await setDoc(
    doc(db, "admins", user.uid),
    { lastLogin: serverTimestamp() },
    { merge: true }
  );

  // Get admin data
  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) {
    throw new Error("Akun admin tidak ditemukan.");
  }

  return { uid: user.uid, ...adminDoc.data() } as AdminUser;
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getAdminProfile(uid: string): Promise<AdminUser | null> {
  const adminDoc = await getDoc(doc(db, "admins", uid));
  if (!adminDoc.exists()) return null;
  return { uid, ...adminDoc.data() } as AdminUser;
}
