import { expect, test } from "@playwright/test";

test("virtualizes: only a subset of options is mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("ten-k").getByRole("combobox");
  await input.click();
  const optionCount = await page.getByRole("option").count();
  expect(optionCount).toBeGreaterThan(0);
  expect(optionCount).toBeLessThan(100); // 10k items, only a window mounted
});

test("keyboard nav to a far item keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("ten-k").getByRole("combobox");
  await input.click();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // The active descendant must be a real, mounted DOM node. Ids are
  // namespaced with a React useId() prefix (e.g. ":r0:-59") and contain
  // colons, so `CSS.escape` + `#id` selectors are unsafe/unavailable here.
  await expect(page.locator(`[id="${activeId}"]`)).toHaveCount(1);
});
