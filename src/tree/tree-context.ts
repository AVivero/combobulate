import { createContext, useContext } from "react";
import type { TreeApi } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: context is generic over item type
const TreeContext = createContext<TreeApi<any> | null>(null);

/** Provider for the tree primitive subtree. */
export const TreeProvider = TreeContext.Provider;

/** Read the active tree api from context. Throws outside `<Combobulate.Tree>`. */
export function useTreeContext<T>(): TreeApi<T> {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("Tree primitives must be used within <Combobulate.Tree>");
  return ctx;
}
