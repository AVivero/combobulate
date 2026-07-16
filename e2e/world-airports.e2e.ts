import { expect, test } from "@playwright/test";

test("virtualizes: only a subset of ~3,274 options is mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("world").getByRole("combobox");
  await input.click();
  const optionCount = await page.getByRole("option").count();
  expect(optionCount).toBeGreaterThan(0);
  expect(optionCount).toBeLessThan(100); // ~3,274 airports, only a window mounted
});

test("keyboard nav to a far item keeps aria-activedescendant mounted and in-viewport", async ({
  page,
}) => {
  await page.goto("/");
  const section = page.getByTestId("world");
  const input = section.getByRole("combobox");
  await input.click();
  // "world" is the last card on the page, so its listbox (which only exists
  // once opened, and only then takes up its full maxHeight) can extend past
  // the default viewport fold. Bring it fully into the browser viewport once
  // so `toBeInViewport()` below reflects the virtualizer's own scroll
  // position rather than the page's.
  await section.getByRole("listbox").scrollIntoViewIfNeeded();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // Ids are namespaced with a React useId() prefix (e.g. ":r0:-59") and
  // contain colons, so `CSS.escape` + `#id` selectors are unsafe/unavailable
  // in Playwright's Node context — use an attribute selector instead.
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});

test("rows have variable measured heights from wrapping long names, yet nav stays correct", async ({
  page,
}) => {
  // A narrower viewport shrinks each row's text column enough that even
  // moderately long airport names wrap across multiple lines (at the card's
  // full desktop width there's enough space that only the very longest
  // names in the dataset would).
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto("/");
  const section = page.getByTestId("world");
  const input = section.getByRole("combobox");
  await input.click();
  await section.getByRole("listbox").scrollIntoViewIfNeeded();

  // "brazil" matches ~95 airports of widely varying airport-name length
  // (12 to 90 characters), including the longest name in the whole dataset
  // (Natal / NAT), so navigating through this filtered set passes both
  // ordinary single-line rows and rows that wrap across multiple lines.
  await input.fill("brazil");
  for (let i = 0; i < 50; i++) await input.press("ArrowDown");

  const heights = await section
    .getByRole("option")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(15);

  // Keyboard nav still lands on a real, mounted, in-viewport row even with
  // these variable-height rows measured above and around it.
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
