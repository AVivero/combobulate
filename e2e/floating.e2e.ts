import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-floating--default&viewMode=story";

test("opens on focus and dismisses on outside click", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option").first()).toBeVisible();

  await page.mouse.click(5, 5);
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("dismisses on Escape", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("closes on select (single-select)", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await page.getByRole("option").first().click();
  await expect(page.getByRole("option")).toHaveCount(0);
});
