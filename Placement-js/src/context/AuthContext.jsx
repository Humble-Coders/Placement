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
  setDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(auth));

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          // Atomic read + lastLogin update: ensures we never read stale role
          // while simultaneously writing, and the write only happens if the
          // document still exists at commit time.
          let resolvedRole = "student";
          await runTransaction(db, async (txn) => {
            const snap = await txn.get(userDocRef);
            if (snap.exists()) {
              resolvedRole = snap.data().role ?? "student";
              txn.update(userDocRef, { lastLogin: serverTimestamp() });
            }
            // If the doc doesn't exist (shouldn't happen in normal flow),
            // we leave resolvedRole as "student" and make no write.
          });
          setRole(resolvedRole);
        } catch {
          // Gracefully degrade: still allow login, default to student role.
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

  // Sign-up is a two-step operation across two separate systems (Firebase Auth
  // and Firestore) so it cannot be wrapped in a single Firestore transaction.
  // Instead we use a compensating rollback: if the Firestore write fails after
  // Auth account creation, we immediately delete the orphaned Auth user so
  // the email address can be reused and no ghost account is left behind.
  const signUp = async (email, password) => {
    if (!auth) throw new Error("Firebase Auth is not configured.");
    if (!email.toLowerCase().endsWith("@thapar.edu")) {
      throw new Error("Only @thapar.edu email addresses are allowed.");
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    try {
      // Send verification email before the Firestore write so the user
      // cannot reach the portal until they click the link.
      await sendEmailVerification(credential.user);

      await setDoc(doc(db, "users", credential.user.uid), {
        email: email.toLowerCase(),
        role: "student",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } catch (err) {
      // Compensating rollback: delete the Auth user so the email is free again
      // and no inconsistency (Auth user without Firestore profile) persists.
      try {
        await credential.user.delete();
      } catch {
        // Best-effort cleanup — ignore secondary failure.
      }
      throw err;
    }

    return credential;
  };

  const resendVerification = async () => {
    if (!auth?.currentUser) throw new Error("No signed-in user.");
    await sendEmailVerification(auth.currentUser);
  };

  const reloadUser = async () => {
    if (!auth?.currentUser) return;
    await reload(auth.currentUser);
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
