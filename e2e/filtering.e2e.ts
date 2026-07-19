import { expect, test } from "@playwright/test";

// Default "includes" filtering: substring match, so "ber" finds only Berlin.
test("default filter is a plain substring includes match", async ({ page }) => {
  await page.goto("/iframe.html?id=combobulate-basic--default&viewMode=story");
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("ber");
  await expect(page.getByRole("option")).toHaveText(["Berlin"]);
});

// Custom filter (Fuse): typo-tolerant, so a misspelling still finds the city.
test("custom Fuse filter tolerates a typo", async ({ page }) => {
  await page.goto("/iframe.html?id=combobulate-fuzzy-search--default&viewMode=story");
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("amstrdam");
  await expect(page.getByRole("option").first()).toContainText("Amsterdam");
});
