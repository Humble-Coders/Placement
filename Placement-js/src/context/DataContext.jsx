/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// ─── Context ─────────────────────────────────────────────────────────────────

const DataContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────────────────────

const COLLECTIONS = ["questions", "companies", "roles", "branches"];

/**
 * DataProvider establishes one persistent onSnapshot listener per collection
 * when it mounts and tears them all down when it unmounts.
 *
 * Read-efficiency strategy
 * ────────────────────────
 * • onSnapshot is connected exactly once per portal session (not per render,
 *   not per component).
 * • After the first snapshot (full read), the Firestore SDK only sends delta
 *   payloads over the wire — only changed documents travel the network.
 * • Internally we keep a Map<id, doc> per collection. docChanges() gives us
 *   only the "added / modified / removed" entries from each snapshot, so we
 *   do O(changed docs) work instead of O(total docs) on every update.
 * • setData is called once per snapshot (one React state update), not once
 *   per changed document.
 * • The Maps live in a ref, not in state, so mutating them doesn't trigger
 *   extra renders — only the final setData() call does.
 */
export function DataProvider({ children }) {
  const [state, setState] = useState({
    questions: [],
    companies: [],
    roles: [],
    branches: [],
    loading: true,
    error: null,
  });

  // One Map per collection for O(1) upsert/delete by document ID.
  const maps = useRef({
    questions: new Map(),
    companies: new Map(),
    roles: new Map(),
    branches: new Map(),
  });

  // How many collections have delivered their first snapshot.
  // We set loading=false only once all four have resolved.
  const fetchedCount = useRef(0);

  useEffect(() => {
    if (!db) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Derive a sorted array from the Map and update only that slice of state.
    const flush = (collName) => {
      const arr = [...maps.current[collName].values()];
      if (collName !== "questions") {
        arr.sort((a, b) => a.name.localeCompare(b.name));
      }
      setState((prev) => ({ ...prev, [collName]: arr }));
    };

    const unsubs = COLLECTIONS.map((collName) => {
      let isFirstSnapshot = true;

      return onSnapshot(
        collection(db, collName),

        // Success handler — fires on connect and on every subsequent change.
        (snapshot) => {
          // Apply only the changed documents (added / modified / removed).
          // On the very first call, all existing docs arrive as "added".
          snapshot.docChanges().forEach(({ type, doc }) => {
            if (type === "removed") {
              maps.current[collName].delete(doc.id);
            } else {
              maps.current[collName].set(doc.id, { id: doc.id, ...doc.data() });
            }
          });

          // Push the updated array into React state.
          flush(collName);

          // Track when all four collections have given us their first snapshot
          // so we can clear the loading flag exactly once.
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            fetchedCount.current += 1;
            if (fetchedCount.current === COLLECTIONS.length) {
              setState((s) => ({ ...s, loading: false }));
            }
          }
        },

        // Error handler — propagates permission or network errors.
        (err) => {
          setState((s) => ({ ...s, error: err.message, loading: false }));
        }
      );
    });

    // Tear down all four listeners when the provider unmounts (sign-out).
    return () => unsubs.forEach((u) => u());
  }, []); // Intentionally empty — listeners are established once per mount.

  return (
    <DataContext.Provider value={state}>
      {children}
    </DataContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useDataContext() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataContext must be used within DataProvider");
  return ctx;
}
