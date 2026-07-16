import { expect, test } from "@playwright/test";

test("nested tree exposes role=tree and expandable treeitems", async ({ page }) => {
  await page.goto("/");
  const nested = page.getByTestId("nested");
  const input = nested.getByRole("combobox");
  await input.click();
  await expect(nested.getByRole("tree")).toBeVisible();
  const first = nested.getByRole("treeitem").first();
  await expect(first).toHaveAttribute("aria-level", "1");
  // Collapsed by default, but structurally expandable (has a chevron / children).
  await expect(first).toHaveAttribute("aria-expanded", "false");
});

test("→/↓ keyboard nav keeps aria-activedescendant mounted (deep list)", async ({ page }) => {
  await page.goto("/");
  const nested = page.getByTestId("nested");
  const input = nested.getByRole("combobox");
  await input.click();
  await input.press("ArrowDown"); // activate first country (level 1)
  await input.press("ArrowRight"); // expand country -> reveals its cities
  await input.press("ArrowDown"); // activate first city (level 2)
  await input.press("ArrowRight"); // expand city -> reveals its airport(s)
  await input.press("ArrowDown"); // activate first airport (level 3)

  const deepId = await input.getAttribute("aria-activedescendant");
  expect(deepId).toBeTruthy();
  await expect(page.locator(`[id="${deepId}"]`)).toHaveAttribute("aria-level", "3");

  // Keep navigating well past the expanded subtree; the virtualizer must keep
  // scrolling the active row into the DOM as we go.
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

test("city-level select-all-under aggregate reports mixed after selecting one of its airports", async ({
  page,
}) => {
  await page.goto("/");
  const nested = page.getByTestId("nested");
  const input = nested.getByRole("combobox");
  await input.click();
  // New York City has two airports in this dataset (JFK + LGA). Searching for
  // the leaf's IATA code (globally unique) surfaces it alongside its
  // ancestors (United States, New York) without needing to manually expand
  // anything or scroll a 200+ country root list.
  await input.fill("JFK");

  const airport = nested.getByRole("treeitem", { name: /JFK/ });
  await expect(airport).toBeVisible();
  await airport.click();

  const cityRow = nested.getByRole("treeitem", { name: /New York/ });
  const aggregate = cityRow.getByRole("checkbox");
  await expect(aggregate).toHaveAttribute("aria-checked", "mixed");
});
