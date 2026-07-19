export { useCombobulate } from "./core/use-combobulate";
export type { CombobulateApi, UseCombobulateOptions } from "./core/types";
export { defaultFilterItems, defaultGetSearchText, normalizeText } from "./core/item-utils";
import { Combobulate as CombobulateBase } from "./core/primitives";
import { Popover } from "./floating/floating-primitives";
/** Headless Combobulate primitives (core + floating layer). */
export const Combobulate = { ...CombobulateBase, Popover };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./core/primitives";
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
