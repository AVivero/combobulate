import { expect, test } from "@playwright/test";

// The `world` section (see `examples/playground/src/sections/WorldAirports.tsx`)
// is the last card on the page and wraps a virtualized `Autocomplete`, so it
// doubles as coverage for `flip` when the combobox opens near the bottom of
// the viewport (see the last test below).

test("dropdown floats over content instead of pushing it down", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  const heading = world.getByRole("heading");
  // Scroll the section into view first so the click below doesn't itself
  // trigger a browser auto-scroll-into-view, which would move the heading's
  // viewport-relative bounding box for reasons unrelated to the dropdown.
  await world.getByRole("combobox").scrollIntoViewIfNeeded();
  const before = await heading.boundingBox();
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  const after = await heading.boundingBox();
  // Content did not shift: the heading (part of the section chrome, above the
  // input) stays put whether or not the dropdown is open — it's floated
  // (position/overlay), not laid out in normal flow pushing siblings down.
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
});

test("dropdown closes on outside click", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click(); // outside
  await expect(world.getByRole("listbox")).toBeHidden();
});

test("dropdown closes on Escape", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  await world.getByRole("combobox").press("Escape");
  await expect(world.getByRole("listbox")).toBeHidden();
});

test("single-select closes the dropdown on pick", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("london");
  await world.getByRole("option").first().click();
  await expect(world.getByRole("listbox")).toBeHidden();
});

test("dropdown flips above the input when opened near the viewport bottom", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  const input = world.getByRole("combobox");

  // Scroll so the input sits right at the bottom edge of the viewport,
  // leaving too little room below it for the listbox to open downward —
  // this is what should force `flip` to place the popover above the input
  // instead of below.
  await input.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));

  await input.click();
  await input.fill("a");
  const listbox = world.getByRole("listbox");
  await expect(listbox).toBeVisible();

  const inputBox = await input.boundingBox();
  const listboxBox = await listbox.boundingBox();
  expect(inputBox).toBeTruthy();
  expect(listboxBox).toBeTruthy();
  // Flipped: the listbox renders above the input, not below it.
  expect((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0)).toBeLessThanOrEqual(
    (inputBox?.y ?? 0) + 1, // +1px tolerance for sub-pixel rounding
  );
});
