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
 * Resolve a stable id for an item, preferring the caller's `getItemId`
 * accessor and falling back to the item's positional index.
 */
export function resolveItemId<T>(item: T, index: number, getItemId?: (item: T) => string): string {
  return getItemId ? getItemId(item) : String(index);
}

/**
 * Default filter: keep items whose normalized search text contains the
 * normalized query as a substring. An empty query keeps everything.
 */
export function defaultFilterItems<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = normalizeText(query);
  if (q.length === 0) return items;
  return items.filter((item) => normalizeText(getSearchText(item)).includes(q));
}
