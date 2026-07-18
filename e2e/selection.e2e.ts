import { expect, test } from "@playwright/test";

// Single-select: picking an option should reflect the selection by filling the
// input with the chosen label (as a normal combobox does), not leave it blank.
test("selecting an option fills the input with its label (single-select)", async ({ page }) => {
  await page.goto("/iframe.html?id=combobulate-basic--default&viewMode=story");
  const input = page.getByRole("combobox");
  await input.click();
  await page.getByRole("option", { name: "Paris" }).click();
  await expect(input).toHaveValue("Paris");
});

// Multi-select keeps the input as a search box (chips carry the selection), so
// picking does NOT fill the input — it stays blank for the next search.
test("multi-select does not fill the input; it adds a chip", async ({ page }) => {
  await page.goto("/iframe.html?id=combobulate-multi-select--default&viewMode=story");
  const input = page.getByRole("combobox");
  await input.click();
  await page.getByRole("option", { name: "Paris" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("chips").getByRole("button")).toHaveCount(1);
});
