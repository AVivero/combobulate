import { createContext, useContext } from "react";
import type { CombobulateStoreInternal } from "./store";

/**
 * Carries the store handle down to the primitives. Typed as the internal
 * variant (not the public `CombobulateStore`) because `List` drives the
 * virtualizer/scroll ref off `_internal`; consumers never touch this context,
 * they hold the public handle returned by `useCombobulate`.
 *
 * Generic over the item type; consumers re-narrow via `useCombobulateContext<T>()`.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic context, narrowed by consumers
const CombobulateContext = createContext<CombobulateStoreInternal<any> | null>(null);

export const CombobulateProvider = CombobulateContext.Provider;

/** Read the combobulate store from context. Throws outside a `<Combobulate>`. */
export function useCombobulateContext<T>(): CombobulateStoreInternal<T> {
  const store = useContext(CombobulateContext);
  if (store === null) {
    throw new Error("Combobulate components must be rendered inside <Combobulate>.");
  }
  return store as CombobulateStoreInternal<T>;
}
