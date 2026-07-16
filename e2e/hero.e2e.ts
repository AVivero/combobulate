import { expect, test } from "@playwright/test";

test("hero selects an origin airport and swaps", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("hero");
  const from = hero.getByRole("combobox").first();
  await from.click();
  await from.fill("new york");
  await hero.getByRole("option").first().click();
  await expect(from).toHaveValue(/New York|JFK|LGA|EWR/);
  // swap moves the origin value into the destination field
  const origin = await from.inputValue();
  await hero.getByRole("button", { name: /swap/i }).click();
  await expect(hero.getByRole("combobox").nth(1)).toHaveValue(origin);
});
