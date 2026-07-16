import { expect, test } from "@playwright/test";

test("multi-select renders a chip per selection and removing one drops the count", async ({
  page,
}) => {
  await page.goto("/");
  const multi = page.getByTestId("multi");
  const input = multi.getByRole("combobox");

  // Select two distinct airports by their (globally unique) IATA codes.
  await input.click();
  await input.fill("LHR");
  await multi.getByRole("option", { name: /LHR/ }).click();
  await input.fill("CDG");
  await multi.getByRole("option", { name: /CDG/ }).click();

  await expect(multi.getByRole("button", { name: "Remove LHR" })).toBeVisible();
  await expect(multi.getByRole("button", { name: "Remove CDG" })).toBeVisible();
  await expect(multi.getByText("2 selected")).toBeVisible();

  // Removing one chip drops just that selection, not the other.
  await multi.getByRole("button", { name: "Remove LHR" }).click();
  await expect(multi.getByRole("button", { name: "Remove LHR" })).toHaveCount(0);
  await expect(multi.getByRole("button", { name: "Remove CDG" })).toBeVisible();
  await expect(multi.getByText("1 selected")).toBeVisible();
});
