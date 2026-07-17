export { useAutocomplete } from "./core/use-autocomplete";
export type { AutocompleteApi, UseAutocompleteOptions } from "./core/types";
export { useAutocompleteVirtual } from "./core/use-autocomplete-virtual";
export type {
  AutocompleteVirtualApi,
  UseAutocompleteVirtualOptions,
} from "./core/use-autocomplete-virtual";
import { Popover } from "./floating/floating-primitives";
import { Combobulate as CombobulateBase } from "./primitives/combobulate";
/** Headless Combobulate primitives (base + floating layer). */
export const Combobulate = { ...CombobulateBase, Popover };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./primitives/combobulate";
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
