import { expect, test } from "@playwright/test";

test("keyboard nav across measured rows keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("dynamic");
  const input = section.getByRole("combobox");
  await input.click();
  // The "dynamic" section is the third one on the page, so the listbox
  // (which only exists once opened, and only then takes up its full
  // maxHeight) can extend past the default viewport fold. Bring it fully
  // into the browser viewport once so `toBeInViewport()` below reflects
  // the virtualizer's internal scroll position rather than the page's.
  await section.getByRole("listbox").scrollIntoViewIfNeeded();
  for (let i = 0; i < 50; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // `CSS.escape` is a browser global unavailable in Playwright's Node
  // context, and React useId()-namespaced ids contain colons that would
  // need escaping anyway, so use an attribute selector instead (see
  // e2e/linear-combobox.e2e.ts and e2e/nested-tree.e2e.ts for the same
  // pattern).
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
