import { expect, test } from "@playwright/test";

const THEMED = "/#/themed";

test("themed example: the light/dark toggle flips the theme", async ({ page }) => {
  await page.goto(THEMED);
  const root = page.getByTestId("themed-root");
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /Dark/ }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /Light/ }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
});

// Guards the List className/style passthrough end-to-end: the consumer class (the
// custom-scrollbar hook) must land on the scroll container inside the popover.
test("themed example: List className reaches the scroll container", async ({ page }) => {
  await page.goto(THEMED);
  const input = page.getByRole("combobox", { name: "Airports" });
  await input.click();
  await input.fill("paris");
  await expect(page.locator(".cbl-themed-list")).toBeVisible();
  await expect(page.getByRole("option").first()).toBeVisible();
});
