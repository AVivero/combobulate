import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-async-typeahead--default&viewMode=story";

test("announces loading, then results", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("madr");

  const status = page.getByRole("status");
  await expect(status).toHaveText("Loading…");
  await expect(status).toHaveText(/result/, { timeout: 5_000 });
  expect(await page.getByRole("option").count()).toBeGreaterThan(0);
});
