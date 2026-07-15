import { expect, test } from "bun:test";
import { VERSION } from "./version";

test("VERSION is a semver-shaped string", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
