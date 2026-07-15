import { createContext, useContext } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";

// biome-ignore lint/suspicious/noExplicitAny: context is generic over item type
const CombobulateContext = createContext<AutocompleteVirtualApi<any> | null>(null);

/** Provider for the Combobulate primitive tree. */
export const CombobulateProvider = CombobulateContext.Provider;

/** Read the active Combobulate api from context. Throws outside a `Root`. */
export function useCombobulateContext<T>(): AutocompleteVirtualApi<T> {
  const ctx = useContext(CombobulateContext);
  if (!ctx) throw new Error("Combobulate primitives must be used within <Combobulate.Root>");
  return ctx;
}
