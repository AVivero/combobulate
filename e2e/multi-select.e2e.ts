import { expect, test } from "@playwright/test";

const STORY = "/#/multi-uncontrolled";

test("selecting several airports adds chips; clicking a chip removes it", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  await input.fill("hokitika"); // one match (HKK)
  await page.getByRole("option").first().click();
  await input.fill("ushuaia"); // one match (USH)
  await page.getByRole("option").first().click();

  const chips = page.getByTestId("chips").getByRole("button");
  await expect(chips).toHaveCount(2);

  await chips.first().click();
  await expect(page.getByTestId("chips").getByRole("button")).toHaveCount(1);
});

test("options expose chosen state via aria-checked", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  const option = page.getByRole("option").first();
  await expect(option).toHaveAttribute("aria-checked", "false");
  await option.click();
  await expect(page.getByRole("option").first()).toHaveAttribute("aria-checked", "true");
});

// aria-selected marks the chosen value in multi-select too (distinct from the
// active highlight), and it survives a close/reopen — the chosen row is still
// flagged when it comes back into the filtered list.
test("the chosen option is marked aria-selected after reopening", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("hokitika");
  await page.getByRole("option").first().click();
  await input.press("Escape"); // close
  await input.click(); // reopen
  await input.fill("hokitika"); // filter back to the chosen airport
  await expect(page.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
});
