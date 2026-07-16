import { expect, test } from "@playwright/test";

test("async typeahead resolves a typo via fuzzy matching", async ({ page }) => {
  await page.goto("/");
  const asyncSection = page.getByTestId("async");
  const input = asyncSection.getByRole("combobox");
  await input.click();
  await input.fill("amstrdam"); // typo for Amsterdam
  await expect(asyncSection.getByRole("option", { name: /Amsterdam/ })).toBeVisible();
});

test("async typeahead announces loading then results during simulated latency", async ({
  page,
}) => {
  await page.goto("/");
  const asyncSection = page.getByTestId("async");
  const input = asyncSection.getByRole("combobox");
  const liveRegion = asyncSection.locator('[aria-live="polite"]');
  await input.click();
  await input.fill("london");
  // Simulated fetch latency: the live region announces "Loading…" first...
  await expect(liveRegion).toHaveText("Loading…");
  // ...then, once the simulated response "arrives", the result count.
  await expect(liveRegion).toContainText("result");
  await expect(asyncSection.getByRole("option", { name: /London/ }).first()).toBeVisible();
});
