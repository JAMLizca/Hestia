import { useCallback, useEffect, useState } from "react";

/**
 * Carga en paralelo varios recursos de la API.
 *   const { data, loading, error, reload } = useApiData({ reservas: () => reservasApi.list() })
 * `reload()` vuelve a pedir todo (tras crear, editar o cambiar un estado).
 */
export function useApiData(loaders) {
  // Los cargadores se fijan en el primer render (cada pantalla define los suyos).
  const [initialLoaders] = useState(loaders);

  const [state, setState] = useState({ data: {}, loading: true, error: "" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const entries = Object.entries(initialLoaders);
    Promise.all(entries.map(([, load]) => load()))
      .then((results) => {
        if (!active) return;
        setState({ data: Object.fromEntries(entries.map(([key], i) => [key, results[i]])), loading: false, error: "" });
      })
      .catch((err) => {
        if (active) setState((prev) => ({ ...prev, loading: false, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [version, initialLoaders]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

/** Índice { id: objeto } para cruzar datos (la API devuelve solo ids en las relaciones). */
export function indexById(list = []) {
  return Object.fromEntries(list.map((item) => [item.id, item]));
}
