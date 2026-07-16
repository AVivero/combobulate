export { useAutocomplete } from "./core/use-autocomplete";
export type { AutocompleteApi, UseAutocompleteOptions } from "./core/types";
export { useAutocompleteVirtual } from "./core/use-autocomplete-virtual";
export type {
  AutocompleteVirtualApi,
  UseAutocompleteVirtualOptions,
} from "./core/use-autocomplete-virtual";
import { Popover } from "./floating/floating-primitives";
import { Combobulate as CombobulateBase } from "./primitives/combobulate";
import { AggregateCheckbox, Tree, TreeItem } from "./tree/tree-primitives";
/** Headless Combobulate primitives (base + tree layer + floating layer). */
export const Combobulate = { ...CombobulateBase, Tree, TreeItem, AggregateCheckbox, Popover };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./primitives/combobulate";
export type { TreeItemProps, TreeProps, AggregateCheckboxProps } from "./tree/tree-primitives";
export { useTree } from "./tree/use-tree";
export type { TreeApi, TreeRow, TreeCombo, UseTreeOptions } from "./tree/types";
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
export { Autocomplete } from "./presets/autocomplete";
export type { AutocompleteProps } from "./presets/autocomplete";
export { NestedAutocomplete } from "./presets/nested-autocomplete";
export type { NestedAutocompleteProps } from "./presets/nested-autocomplete";
