/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  reload,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  // If Firebase Auth is not configured, skip the loading phase
  const [loading, setLoading] = useState(() => Boolean(auth));

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setRole(userData.role ?? "student");
            await updateDoc(userDocRef, { lastLogin: serverTimestamp() });
          } else {
            // Shouldn't happen for normal flow but handle gracefully
            setRole("student");
          }
        } catch {
          setRole("student");
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email, password) => {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    if (!email.toLowerCase().endsWith("@thapar.edu")) {
      throw new Error("Only @thapar.edu email addresses are allowed.");
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email, password) => {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    if (!email.toLowerCase().endsWith("@thapar.edu")) {
      throw new Error("Only @thapar.edu email addresses are allowed.");
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email before writing Firestore doc so the user
    // cannot access the portal until they click the link.
    await sendEmailVerification(credential.user);
    await setDoc(doc(db, "users", credential.user.uid), {
      email: email.toLowerCase(),
      role: "student",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
    return credential;
  };

  // Re-send the verification email to the currently signed-in user.
  const resendVerification = async () => {
    if (!auth?.currentUser) throw new Error("No signed-in user.");
    await sendEmailVerification(auth.currentUser);
  };

  // Force-refresh the Firebase Auth token so emailVerified is up to date,
  // then re-trigger onAuthStateChanged by reloading the user object.
  const reloadUser = async () => {
    if (!auth?.currentUser) return;
    await reload(auth.currentUser);
    // Manually push the refreshed user so React re-renders immediately.
    setUser({ ...auth.currentUser });
  };

  const signOut = () => {
    if (!auth) return Promise.resolve();
    return firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut, resendVerification, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
