import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-world-airports--default&viewMode=story";

test("mounts only a window of the ~3,300 airports", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const count = await page.getByRole("option").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(100);
});

test("options report their absolute position in the full filtered list", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const first = page.getByRole("option").first();
  // A bare virtualizer cannot know these — it only sees the mounted window.
  await expect(first).toHaveAttribute("aria-posinset", "1");
  const setsize = await first.getAttribute("aria-setsize");
  expect(Number(setsize)).toBeGreaterThan(3000);
});

// aria-expanded is Ariakit's now (cmdk hardcoded it true): closed -> "false",
// open -> "true".
test("aria-expanded tracks open state", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await expect(input).toHaveAttribute("aria-expanded", "false"); // closed
  await input.click();
  await expect(input).toHaveAttribute("aria-expanded", "true"); // open
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false"); // closed again
});

// Hold ArrowDown well past the initially-mounted window: the scroll-then-set
// bridge must keep mounting rows on demand so aria-activedescendant always
// resolves to a mounted option, and the reported position increases by exactly
// one each step (strictly monotonic across the virtualization boundary).
test("holding ArrowDown past the mounted window keeps activedescendant mounted and posinset monotonic", async ({
  page,
}) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  for (let expected = 1; expected <= 50; expected++) {
    await input.press("ArrowDown");
    // Poll so the read waits for React to commit the new activeId; the resolved
    // option must be mounted (its id exists) and sit at the expected position.
    await expect
      .poll(async () => {
        const activeId = await input.getAttribute("aria-activedescendant");
        if (!activeId) return null;
        return page.locator(`[id="${activeId}"]`).getAttribute("aria-posinset");
      })
      .toBe(String(expected));
  }
});

test("arrow nav to a far row keeps aria-activedescendant mounted and in view", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // Ids can contain colons (React useId), so use an attribute selector.
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
