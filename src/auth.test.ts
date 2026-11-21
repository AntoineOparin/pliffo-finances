import { expect, test } from "bun:test";
import { isAllowed, readSession, signSession } from "./auth";

const secret = "test-secret-at-least-32-characters-long";

test("session round-trips and rejects a wrong secret or garbage", async () => {
  const token = await signSession("a@gmail.com", secret);
  expect(await readSession(token, secret)).toBe("a@gmail.com");
  expect(await readSession(token, "another-secret-of-32-characters-xx")).toBeNull();
  expect(await readSession(token + "x", secret)).toBeNull();
  expect(await readSession(undefined, secret)).toBeNull();
  expect(await readSession(token, "")).toBeNull();
});

test("isAllowed is exact, case-insensitive, and tolerates spaces", () => {
  const list = " Antoine@gmail.com, kiryl@gmail.com ,";
  expect(isAllowed("antoine@gmail.com", list)).toBe(true);
  expect(isAllowed("KIRYL@gmail.com", list)).toBe(true);
  expect(isAllowed("someone@gmail.com", list)).toBe(false);
  expect(isAllowed("", list)).toBe(false);
  expect(isAllowed("a@gmail.com", "")).toBe(false);
});
