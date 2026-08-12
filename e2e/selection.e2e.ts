import { expect, test } from "@playwright/test";

const SINGLE = "/#/single-uncontrolled";
const MULTI = "/#/multi-uncontrolled";

// Single-select: picking an option should reflect the selection by filling the
// input with the chosen label (as a normal combobox does), not leave it blank.
test("selecting an option fills the input with its label (single-select)", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika"); // exactly one match (HKK)
  await page.getByRole("option").first().click();
  await expect(input).toHaveValue(/HKK/);
});

// Multi-select keeps the input as a search box (chips carry the selection), so
// picking does NOT fill the input — it stays blank for the next search.
test("multi-select does not fill the input; it adds a chip", async ({ page }) => {
  await page.goto(MULTI);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  await page.getByRole("option").first().click();
  // Single-select would replace the input with the chosen label ("… (HKK)");
  // multi-select must NOT — the input stays a search box (here it keeps "hokitika").
  await expect(input).not.toHaveValue(/HKK/);
  await expect(page.getByTestId("chips").getByRole("button")).toHaveCount(1);
});

// After a pick, the input holds the (long) committed label. Reopening must show
// the full list again — not filter by that label and show an empty "no match".
test("reopening after a pick shows the list, not an empty 'no match'", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  await page.getByRole("option").first().click();
  await expect(input).not.toHaveValue(""); // committed label is showing
  await input.click(); // reopen
  expect(await page.getByRole("option").count()).toBeGreaterThan(0);
  await expect(page.getByText("No airports match")).toHaveCount(0);
  // the picked option is visibly marked as chosen
  await expect(page.locator('[role="option"][data-chosen]')).toHaveCount(1);
});

// Clearing the whole input (backspacing it empty) unselects: the input stays
// empty on close instead of reverting to the committed label, and no option is
// marked chosen anymore.
test("clearing the input to empty unselects (does not revert on close)", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  await page.getByRole("option").first().click();
  await expect(input).not.toHaveValue(""); // picked
  await input.click(); // reopen (full list, chosen scrolled into view)
  await expect(page.locator('[role="option"][data-chosen]')).toHaveCount(1);
  await input.fill(""); // backspace the whole thing
  await expect(page.locator('[role="option"][data-chosen]')).toHaveCount(0); // unselected
  await input.press("Escape"); // close
  await expect(input).toHaveValue(""); // stays empty — NOT reverted to the label
});

// The default filter is a normalized substring ("includes") match: a distinctive
// query resolves to exactly one airport. (Diacritic-insensitivity is covered by
// the unit tests.)
test("default filter is a plain substring includes match", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("ushuaia");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Ushuaia");
});

// Enter selects the active option — combobulate delegates Enter to Ariakit, which
// re-dispatches a click to the active row (running `store.select`). Keyboard-only
// users must be able to commit a highlighted option.
test("Enter selects the active option (keyboard-only)", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika"); // exactly one match: HKK
  await input.press("ArrowDown"); // highlight it
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
  await input.press("Enter");
  await expect(input).toHaveValue(/HKK/); // committed
});

// Filtering the active option out of the list must not leave a stale
// `aria-activedescendant` pointing at an unmounted/absent option (an APG
// violation — the reference must always resolve to a rendered option, or be gone).
test("filtering out the active option leaves no stale aria-activedescendant", async ({ page }) => {
  await page.goto(SINGLE);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  await input.press("ArrowDown"); // highlight the match
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
  // Narrow the query so nothing matches — the highlighted option is gone.
  await input.fill("hokitikazzz");
  await expect(page.getByText("No airports match")).toBeVisible();
  // Any lingering activedescendant must resolve to a mounted option (here: none,
  // so it must be cleared) — never a dangling id.
  const active = await input.getAttribute("aria-activedescendant");
  if (active) await expect(page.locator(`[id="${active}"]`)).toHaveCount(1);
});
