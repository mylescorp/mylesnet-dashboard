import assert from "node:assert/strict";
import test from "node:test";
import { toUserFacingError, userFacingMessage } from "./user-facing-error.ts";

test("never returns an untrusted technical message to the UI", () => {
  const technical = new Error("[CONVEX Q(tenantControl:getCurrentWorkspace)] Server Error /apps/web/secret.ts");
  const translated = toUserFacingError(technical);
  assert.equal(translated.message.includes("CONVEX"), false);
  assert.equal(translated.message.includes("secret.ts"), false);
  assert.equal(translated.category, "unexpected");
});

test("maps authorization failures to safe product language", () => {
  const translated = toUserFacingError(new Error("Unauthorized: platform access required"));
  assert.equal(translated.category, "permission");
  assert.match(translated.message, /permission/i);
  assert.equal(translated.message.includes("platform access required"), false);
});

test("honours a safe caller fallback without echoing a provider response", () => {
  const message = userFacingMessage(new Error("provider response: token=secret"), "The payment could not be completed. Please try again.");
  assert.equal(message, "The payment could not be completed. Please try again.");
});

test("translates provider-specific failures without revealing the provider", () => {
  const translated = toUserFacingError(new Error("M-Pesa callback rejected a request"));
  assert.equal(translated.category, "provider");
  assert.equal(translated.message.includes("M-Pesa"), false);
});
