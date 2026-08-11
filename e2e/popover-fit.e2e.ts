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
  await page.goto("/iframe.html?id=combobulate-single-select--default&viewMode=story");
  await page.getByRole("combobox").click();
  await page.waitForSelector('[role="option"]');
  await page.waitForTimeout(120); // let floating-ui settle

  const m = await page.evaluate(() => {
    const panel = document.querySelector(".cbl-panel") as HTMLElement | null;
    const popover = panel?.parentElement as HTMLElement | null;
    let scroller: HTMLElement | null = null;
    for (const el of Array.from(document.querySelectorAll(".cbl-panel div"))) {
      if (getComputedStyle(el).overflowY === "auto") {
        scroller = el as HTMLElement;
        break;
      }
    }
    const pr = popover?.getBoundingClientRect();
    return {
      popoverMaxH: Number.parseFloat(getComputedStyle(popover as Element).maxHeight),
      panelScrollH: panel?.scrollHeight ?? 0,
      popoverClientH: popover?.clientHeight ?? 0,
      scrollerScrolls: (scroller?.scrollHeight ?? 0) > (scroller?.clientHeight ?? 0),
      top: pr?.top ?? -1,
      bottom: pr?.bottom ?? 1e9,
      vh: window.innerHeight,
    };
  });

  expect(m.popoverMaxH).toBeLessThan(240); // precondition: space is tighter than the requested max
  expect(m.panelScrollH).toBeLessThanOrEqual(m.popoverClientH + 1); // content isn't clipped
  expect(m.scrollerScrolls).toBe(true); // it scrolls to fit
  expect(m.top).toBeGreaterThanOrEqual(-1); // within the viewport
  expect(m.bottom).toBeLessThanOrEqual(m.vh + 1);
});
