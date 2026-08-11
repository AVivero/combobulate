/**
 * Lowercase `text` and strip diacritics (e.g. "Málaga" -> "malaga") so search
 * matching is accent-insensitive.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Default accessor for the searchable/display text of an item. Strings are
 * returned as-is; objects expose their `label` field when present.
 */
export function defaultGetSearchText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "label" in item) {
    return String((item as { label: unknown }).label);
  }
  return "";
}

/**
 * Default filter: keep items whose normalized search text contains the
 * normalized query as a substring. An empty (or whitespace-only) query keeps
 * everything.
 */
export function defaultFilterItems<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = normalizeText(query).trim();
  if (q.length === 0) return items;
  return items.filter((item) => normalizeText(getSearchText(item)).includes(q));
}

/**
 * Convert the selected items to the value type expected by `onChange`:
 * the whole array for multi-select, else the first item (or `null` when empty).
 */
export function toChangeValue<T>(items: T[], multiple: boolean): T | T[] | null {
  return multiple ? items : (items[0] ?? null);
}

/**
 * Identity comparison for selection. Uses the caller's `getItemId` accessor
 * when provided so logically-equal items (e.g. objects re-fetched from an
 * API) are recognized as the same selection even across fresh references.
 * Falls back to reference equality, which is correct for string/primitive
 * items and for callers who don't supply `getItemId`.
 */
export function isSameItem<T>(a: T, b: T, getItemId?: (item: T) => string): boolean {
  if (getItemId) return getItemId(a) === getItemId(b);
  return a === b;
}
