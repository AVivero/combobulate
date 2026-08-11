import { expect, test } from "@playwright/test";

const BOOKING = "/#/booking";
const SINGLE_CONTROLLED = "/#/single-controlled";

// The flagship controlled behavior, in a real browser. Swapping origin and
// destination exchanges BOTH committed input labels — and does so while each
// field's `items` ALSO change (the dependent lists exclude the other's pick).
// That combined value+items change is exactly what once blanked the committed
// input (items synced after the reflect); this guards the fix.
test("booking: Swap exchanges both committed inputs (controlled)", async ({ page }) => {
  await page.goto(BOOKING);
  const origin = page.getByRole("combobox", { name: "Origin" });
  const destination = page.getByRole("combobox", { name: "Destination" });

  await origin.click();
  await origin.fill("hokitika");
  await page.getByRole("option").first().click();
  const originVal = await origin.inputValue();
  expect(originVal).not.toBe("");

  await destination.click();
  await destination.fill("madrid");
  await page.getByRole("option").first().click();
  const destVal = await destination.inputValue();
  expect(destVal).not.toBe("");
  expect(destVal).not.toBe(originVal);

  await page.getByRole("button", { name: "Swap origin and destination" }).click();

  // Exchanged, and crucially NOT blank — the committed input survives the
  // simultaneous value+items change.
  await expect(origin).toHaveValue(destVal);
  await expect(destination).toHaveValue(originVal);
});

// The dependent list: the origin's pick is filtered out of the destination list
// (you can't fly a route to where you're departing from).
test("booking: the origin's pick is excluded from the destination list", async ({ page }) => {
  await page.goto(BOOKING);
  const origin = page.getByRole("combobox", { name: "Origin" });
  const destination = page.getByRole("combobox", { name: "Destination" });

  await origin.click();
  await origin.fill("hokitika"); // exactly one airport matches: HKK
  await page.getByRole("option").first().click();
  await expect(origin).toHaveValue(/HKK/);

  // HKK is now excluded from the destination list, so searching it finds nothing.
  await destination.click();
  await destination.fill("hokitika");
  await expect(page.getByText("No airports match")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
});

// Controlled single-select: the parent-state readout tracks selection, and the
// parent's Clear / Set buttons drive it from outside the combobox.
test("single controlled: readout tracks selection; Clear and Set drive it from the parent", async ({
  page,
}) => {
  await page.goto(SINGLE_CONTROLLED);
  const input = page.getByRole("combobox", { name: "Airport" });
  const state = page.getByTestId("parent-state");

  await input.click();
  await input.fill("hokitika");
  await page.getByRole("option").first().click();
  await expect(input).toHaveValue(/HKK/);
  await expect(state).toHaveText("HKK");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(input).toHaveValue("");
  await expect(state).toHaveText("—");

  await page.getByRole("button", { name: "Set random" }).click();
  await expect(state).not.toHaveText("—");
  await expect(input).not.toHaveValue("");
});
