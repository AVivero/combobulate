import { Combobulate as CombobulateBase } from "./core/primitives";
import { Popover } from "./floating/floating-primitives";

export { useCombobulate } from "./core/use-combobulate";
export type { CombobulateStore, UseCombobulateOptions } from "./core/types";
export type {
  CombobulateEmptyProps,
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./core/primitives";

export { useCombobulateFloating } from "./floating/use-floating";
export type { CombobulateFloating, CombobulateFloatingOptions } from "./floating/types";
export type { PopoverProps } from "./floating/floating-primitives";

/**
 * Headless Combobulate primitives (core + floating layer): the callable root
 * (`<Combobulate store={...}>`) with `.Input`/`.List`/`.Item`/`.Empty`/
 * `.LiveRegion` (core) and `.Popover` (floating) attached. `Object.assign`
 * (not object-spread) is required here — spreading a function copies its own
 * properties onto a plain object, which is no longer callable as a JSX
 * component.
 */
export const Combobulate = Object.assign(CombobulateBase, { Popover });
