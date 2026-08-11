import { expect, test } from "@playwright/test";

// When the viewport can't fit the list's requested max-height (a tight space —
// the same situation that makes the popover flip above the input), the size
// middleware caps the popover shorter than the list wants. The list must
// SHRINK and scroll rather than the popover clipping its content, and the
// popover must stay within the viewport. (Regression: it used to clip.)
test.use({ viewport: { width: 560, height: 440 } });

test("a popover capped by tight space shrinks-and-scrolls instead of clipping", async ({
  page,
}) => {
  await page.goto("/#/single-uncontrolled");
  await page.getByRole("combobox").click();
  await page.waitForSelector('[role="option"]');
  await page.waitForTimeout(120); // let floating-ui settle

  const m = await page.evaluate(() => {
    const popover = document.querySelector('[data-testid="cbl-popover"]') as HTMLElement | null;
    let scroller: HTMLElement | null = null;
    for (const el of Array.from(popover?.querySelectorAll("div") ?? [])) {
      if (getComputedStyle(el).overflowY === "auto") {
        scroller = el as HTMLElement;
        break;
      }
    }
    const r = popover?.getBoundingClientRect();
    return {
      popoverMaxH: Number.parseFloat(getComputedStyle(popover as Element).maxHeight),
      contentOverflow: (popover?.scrollHeight ?? 0) - (popover?.clientHeight ?? 0),
      scrollerScrolls: (scroller?.scrollHeight ?? 0) > (scroller?.clientHeight ?? 0),
      top: r?.top ?? -1,
      bottom: r?.bottom ?? 1e9,
      vh: window.innerHeight,
    };
  });

  expect(m.popoverMaxH).toBeLessThan(240); // precondition: space is tighter than the requested max
  expect(m.contentOverflow).toBeLessThanOrEqual(1); // content isn't clipped (it fit by shrinking)
  expect(m.scrollerScrolls).toBe(true); // it scrolls to fit
  expect(m.top).toBeGreaterThanOrEqual(-1); // within the viewport
  expect(m.bottom).toBeLessThanOrEqual(m.vh + 1);
});
