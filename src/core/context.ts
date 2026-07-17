import { createContext, useContext } from "react";
import type { CombobulateApi } from "./types";

// The context is generic over the item type; consumers re-narrow via
// useCombobulateContext<T>().
// biome-ignore lint/suspicious/noExplicitAny: generic context, narrowed by consumers
const CombobulateContext = createContext<CombobulateApi<any> | null>(null);

export const CombobulateProvider = CombobulateContext.Provider;

/** Read the combobulate api from context. Throws outside a `Combobulate.Root`. */
export function useCombobulateContext<T>(): CombobulateApi<T> {
  const api = useContext(CombobulateContext);
  if (api === null) {
    throw new Error("Combobulate components must be rendered inside <Combobulate.Root>.");
  }
  return api as CombobulateApi<T>;
}
