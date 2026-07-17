import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-world-airports--default&viewMode=story";

test("mounts only a window of the ~3,300 airports", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const count = await page.getByRole("option").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(100);
});

test("options report their absolute position in the full filtered list", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const first = page.getByRole("option").first();
  // cmdk alone cannot know these — it only sees the mounted window.
  await expect(first).toHaveAttribute("aria-posinset", "1");
  const setsize = await first.getAttribute("aria-setsize");
  expect(Number(setsize)).toBeGreaterThan(3000);
});

test("arrow nav to a far row keeps aria-activedescendant mounted and in view", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // Ids can contain colons (React useId), so use an attribute selector.
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
