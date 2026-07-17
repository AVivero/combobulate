import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-world-airports--default&viewMode=story";

test("End highlights the true last airport, not the last mounted row", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  const total = Number(await page.getByRole("option").first().getAttribute("aria-setsize"));
  await input.press("End");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  // The whole point: position equals the full list length, not the window's end.
  await expect(active).toHaveAttribute("aria-posinset", String(total));
  await expect(active).toBeInViewport();
});

test("Home returns to the true first airport", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.press("End");
  await input.press("Home");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-posinset", "1");
  await expect(active).toBeInViewport();
});

test("PageDown moves a page at a time and stays mounted", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.press("Home");
  await input.press("PageDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-posinset", "11");
});
