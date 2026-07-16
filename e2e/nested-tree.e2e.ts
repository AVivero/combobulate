import { expect, test } from "@playwright/test";

test("nested tree exposes role=tree and expandable treeitems", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("nested").getByRole("combobox");
  await input.click();
  await expect(page.getByTestId("nested").getByRole("tree")).toBeVisible();
  const first = page.getByTestId("nested").getByRole("treeitem").first();
  await expect(first).toHaveAttribute("aria-level", "1");
});

test("→/↓ keyboard nav keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("nested").getByRole("combobox");
  await input.click();
  await input.press("ArrowDown"); // active first row
  await input.press("ArrowRight"); // expand first group
  for (let i = 0; i < 20; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // `CSS` is a browser global and is not available in the Node context this
  // test file runs in, and React useId()-namespaced ids contain colons that
  // would need escaping anyway, so use an attribute selector instead of
  // `#${CSS.escape(activeId)}` (see e2e/linear-combobox.e2e.ts for the same
  // pattern).
  await expect(page.locator(`[id="${activeId}"]`)).toHaveCount(1);
});

test("select-all-under-node control reports a mixed state", async ({ page }) => {
  await page.goto("/");
  const nested = page.getByTestId("nested");
  await nested.getByRole("combobox").click();
  await nested.getByRole("combobox").press("ArrowDown");
  await nested.getByRole("combobox").press("ArrowRight"); // expand first group
  // select one leaf, then the group's aggregate should be mixed
  await nested.getByRole("treeitem").nth(1).click();
  const checkbox = nested.getByRole("checkbox").first();
  await expect(checkbox).toHaveAttribute("aria-checked", "mixed");
});
