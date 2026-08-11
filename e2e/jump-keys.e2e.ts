import { type Page, expect, test } from "@playwright/test";

const STORY = "/#/single-uncontrolled";

// Home/End are caret keys now; the jump is on the MODIFIER form (Ctrl/Cmd+End),
// which combobulate owns and drives Ariakit's activeId over the FULL list.
// Resolve the option `aria-activedescendant` currently points at. The far-jump
// bridge scrolls the target into the DOM and commits it active once its row
// mounts, so this can be briefly null right after the press — callers poll it.
const activePosinset = (page: Page) => async () => {
  const input = page.getByRole("combobox");
  const activeId = await input.getAttribute("aria-activedescendant");
  if (!activeId) return null;
  return page.locator(`[id="${activeId}"]`).getAttribute("aria-posinset");
};

test("Ctrl+End highlights the true last airport, not the last mounted row", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  const total = Number(await page.getByRole("option").first().getAttribute("aria-setsize"));
  await input.press("Control+End");

  // Poll: the target row mounts asynchronously. Position equals the full list
  // length, not the window's end.
  await expect.poll(activePosinset(page)).toBe(String(total));
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toBeInViewport();
});

test("Ctrl+Home returns to the true first airport", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.press("Control+End");
  await expect.poll(activePosinset(page)).not.toBe("1"); // reached the far end first
  await input.press("Control+Home");

  await expect.poll(activePosinset(page)).toBe("1");
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toBeInViewport();
});

test("PageDown moves a page at a time and stays mounted", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  // Fresh open: nothing active yet; one PageDown steps a page (10) from the top.
  await input.press("PageDown");

  await expect.poll(activePosinset(page)).toBe("11");
});

// aria-selected marks the CHOSEN value (distinct from the active highlight).
// Single-select: pick, reopen, and the chosen option carries aria-selected.
test("single-select: reopening after a pick marks the chosen option aria-selected", async ({
  page,
}) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika"); // exactly one match (HKK)
  await page.getByRole("option").first().click();
  await expect(input).toHaveValue(/HKK/); // committed label
  await input.click(); // reopen — full list, chosen scrolled into view
  const chosen = page.locator('[role="option"][aria-selected="true"]');
  await expect(chosen).toHaveCount(1);
  await expect(chosen).toContainText("HKK");
});
