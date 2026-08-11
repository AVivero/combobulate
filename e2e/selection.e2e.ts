import { expect, test } from "@playwright/test";

const SINGLE = "/iframe.html?id=combobulate-single-select--default&viewMode=story";
const MULTI = "/iframe.html?id=combobulate-multi-select--default&viewMode=story";

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
