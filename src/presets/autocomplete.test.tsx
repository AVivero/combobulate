import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Autocomplete } from "./autocomplete";

const ITEMS = ["Paris", "Madrid", "Berlin"];

// See `stubElementLayout` for why virtualized lists need this under
// happy-dom. Installed for the lifetime of this file's tests only (via
// `beforeAll`/`afterAll`) so no other test file is affected by the stub.
let restoreElementLayout: () => void;

beforeAll(() => {
  restoreElementLayout = stubElementLayout();
});

afterAll(() => {
  restoreElementLayout();
});

// `@testing-library/react`'s built-in auto-cleanup only registers itself
// against a global `afterEach`, which Bun's test runner does not expose
// unless imported. Without it, `render()` calls across tests in this file
// would accumulate in `document.body` and break `screen`-scoped queries.
afterEach(() => {
  cleanup();
});

test("typing filters and clicking selects", async () => {
  const user = userEvent.setup();
  let selected: unknown;
  render(
    <Autocomplete
      items={ITEMS}
      onChange={(v) => {
        selected = v;
      }}
      placeholder="City"
    />,
  );
  const input = screen.getByRole("combobox");
  await user.type(input, "ma");
  const options = screen.getAllByRole("option");
  expect(options.map((o) => o.textContent)).toEqual(["Madrid"]);
  await user.click(options[0] as HTMLElement);
  expect(selected).toBe("Madrid");
});

test("onInputChange fires on every keystroke (for async/remote search)", async () => {
  const user = userEvent.setup();
  const seen: string[] = [];
  render(<Autocomplete items={ITEMS} onInputChange={(v) => seen.push(v)} placeholder="City" />);
  await user.type(screen.getByRole("combobox"), "ma");
  expect(seen).toEqual(["m", "ma"]);
});
