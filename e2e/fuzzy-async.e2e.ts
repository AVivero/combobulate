import { expect, test } from "@playwright/test";

test("fuzzy search returns approximate matches", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("fuzzy").getByRole("combobox");
  await input.click();
  await input.fill("amstrdam"); // typo
  await expect(page.getByTestId("fuzzy").getByRole("option", { name: "Amsterdam" })).toBeVisible();
});

test("async search announces loading then results", async ({ page }) => {
  await page.goto("/");
  const async = page.getByTestId("async");
  const input = async.getByRole("combobox");
  await input.click();
  await input.fill("Result 1");
  await expect(async.getByRole("status")).toHaveText("Loading…");
  await expect(async.getByRole("status")).toContainText("results");
});
