import { expect, test } from "@playwright/test";

// Default "includes" filtering: substring match, so "ber" finds only Berlin.
test("default filter is a plain substring includes match", async ({ page }) => {
  await page.goto("/iframe.html?id=combobulate-basic--default&viewMode=story");
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("ber");
  await expect(page.getByRole("option")).toHaveText(["Berlin"]);
});
