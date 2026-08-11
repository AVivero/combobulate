import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-multi-select--default&viewMode=story";

test("selecting several items adds chips; clicking a chip removes it", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  await page.getByRole("option", { name: /Paris/ }).click();
  await page.getByRole("option", { name: /Berlin/ }).click();

  const chips = page.getByTestId("chips").getByRole("button");
  await expect(chips).toHaveCount(2);

  await chips.first().click();
  await expect(page.getByTestId("chips").getByRole("button")).toHaveCount(1);
});

test("options expose chosen state via aria-checked", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  const paris = page.getByRole("option", { name: /Paris/ });
  await expect(paris).toHaveAttribute("aria-checked", "false");
  await paris.click();
  await expect(page.getByRole("option", { name: /Paris/ })).toHaveAttribute("aria-checked", "true");
});

// aria-selected marks the chosen value in multi-select too (distinct from the
// active highlight), and it survives a close/reopen — the chosen row is still
// flagged when the full list comes back.
test("the chosen option is marked aria-selected after reopening", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await page.getByRole("option", { name: /Paris/ }).click();
  await input.press("Escape"); // close
  await input.click(); // reopen — full list, Paris still chosen
  await expect(page.getByRole("option", { name: /Paris/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
