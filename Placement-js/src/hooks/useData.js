import { useDataContext } from "../context/DataContext";

/**
 * Thin hook that exposes the real-time data store in the shape that Home and
 * the Search* components already expect: { data, loading, error }.
 *
 * `data` is null while the initial snapshots are loading, then becomes the
 * full { questions, companies, roles, branches } object. Subsequent real-time
 * updates replace `data` with a new object containing the updated arrays —
 * React re-renders only the parts of the tree that actually consumed the
 * changed slice.
 */
export function useData() {
  const { questions, companies, roles, branches, loading, error } = useDataContext();

  const data = loading
    ? null
    : { questions, companies, roles, branches };

  return { data, loading, error };
}
