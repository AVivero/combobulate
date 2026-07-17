// Temporary re-export shim. `merge-props` moved to `src/core/merge-props.ts`
// (Task 4). The old base primitives in this directory are dead code that
// Task 7 deletes wholesale — this shim keeps them resolving until then and is
// removed along with the rest of `src/primitives/`.
export * from "../core/merge-props";
