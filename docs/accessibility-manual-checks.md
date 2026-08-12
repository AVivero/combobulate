# Accessibility — manual screen-reader checks

Most of combobulate's a11y is guarded automatically: the WAI-ARIA structure and
the virtualization↔activedescendant bridge are asserted cross-browser in
`e2e/*.e2e.ts`, and the store/primitive behaviors in `src/core/tests/*`. What a
machine **can't** verify is how a real screen reader *speaks* the widget. Run
this checklist against a build (`bun run dev`) before a release, or when touching
`Input`/`Item`/`LiveRegion` in `src/core/primitives.tsx`.

## Test matrix

Cover at least one from each row:

- **NVDA** + Firefox and Chrome (Windows)
- **JAWS** + Chrome (Windows)
- **VoiceOver** + Safari (macOS), and VoiceOver + iOS Safari for touch

## Core script (Single Select route)

1. **Name** — Tab to the input. It announces a *name* and "combobox"/"edit"
   (e.g. "Airport, combobox"). A nameless "combobox, edit" is a bug — check the
   `label`/`aria-label`. (There is a dev-console warning for the missing-name
   case; this verifies the spoken result.)
2. **Expanded state** — typing opens the list; SR says "expanded". Escape closes;
   SR says "collapsed".
3. **Position in set** — arrow through options: each announces its label and
   "N of 3300" (full-list `aria-posinset`/`aria-setsize`), **not** "N of 10"
   (the mounted window). Arrow into the far list (hold ArrowDown, or Ctrl/Cmd+End)
   and confirm the announced position keeps climbing past the initial window.
4. **Jump keys** — Ctrl/Cmd+End announces the true last airport; Ctrl/Cmd+Home the
   first; the announced position matches the visual highlight.
5. **Enter to select** — highlight an option with the arrows and press **Enter**.
   It selects (input fills with the label) and **does not submit an enclosing
   `<form>`**. Try it with the combobox inside a real `<form>` — no accidental
   submit. *(Selection-on-Enter is covered in e2e; the form-submit interaction is
   the SR/browser part to confirm.)*
6. **Reopen on arrow** — after Escape (closed, still focused), press ArrowDown:
   the list reopens and is announced.

## Multi Select route

7. **Selection announcements** — pick an option: the polite live region announces
   "N selected" (a pick/removal doesn't change the input or result count, so this
   is the only feedback). Remove a chip: it announces the change.
8. **`aria-selected` vs `aria-checked`** — ⚠️ **decision point.** Each chosen
   option currently carries **both** `aria-selected="true"` and
   `aria-checked="true"` (`src/core/primitives.tsx`, the `Item` component). The
   listbox is already `aria-multiselectable`, for which `aria-selected` alone is
   the standard convention. Listen for a **double announcement** ("selected,
   checked") on NVDA/JAWS/VoiceOver. If any reader double-speaks it, **remove the
   `aria-checked` line** from `Item` and delete the two assertions that pin it
   (`src/core/tests/primitives.test.tsx` "multi-select marks chosen state with
   aria-checked…" and `e2e/multi-select.e2e.ts` "options expose chosen state via
   aria-checked"). If no reader double-speaks it, leave it.
9. **Chip remove buttons** — each chip announces "Remove <IATA>, button" (it has
   an `aria-label`; the ✕ glyph is `aria-hidden`). After removing a chip, note
   where focus lands — today it falls to `<body>`; consider moving focus to the
   input or the adjacent chip if that feels lossy in testing. *(Example-level
   behavior in `examples/Multi*.tsx`.)*

## Other

10. **Loading / empty** — trigger the async/remote pattern (or an empty result):
    "Loading…" and "No results" are announced politely, and the region is silent
    while the combobox is closed.
11. **Filter churn** — type quickly. Result-count announcements are debounced (you
    should hear the *settled* count, not every intermediate keystroke).
12. **Filtered-out active option** — highlight an option, then keep typing so it
    no longer matches. The SR must not be left pointing at a gone option.
    *(`aria-activedescendant` clearing is covered in e2e; confirm the spoken
    behavior is sane.)*

Record results (reader + browser + version) in the PR when you run this.
