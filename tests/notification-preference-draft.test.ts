import assert from "node:assert/strict";
import test from "node:test";
import { editNotificationPreferenceDraft, notificationPreferenceKey, projectNotificationPreferenceDraft } from "../features/notificationPreferenceDraft";
import type { NotificationPreference } from "../types/notificationSettingsType";

const email: NotificationPreference = { notificationType: "BID_OUTBID", channel: "EMAIL", enabled: true, mandatory: false };
const inApp: NotificationPreference = { ...email, channel: "IN_APP" };
const required: NotificationPreference = { ...email, notificationType: "AUCTION_WON", mandatory: true };
const initial = [email, inApp, required];
const emailKey = notificationPreferenceKey(email);

test("an unsaved preference remains edited when reconnect returns the same server settings", () => {
  const edits = editNotificationPreferenceDraft(initial, {}, emailKey, false);
  const refreshed = initial.map((row) => ({ ...row }));
  const draft = projectNotificationPreferenceDraft(refreshed, edits);
  assert.equal(draft.rows[0].enabled, false);
  assert.deepEqual(draft.changes, [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }]);
  assert.equal(initial[0].enabled, true);
});

test("draft cells follow type and channel while unedited cells adopt background changes", () => {
  const edits = editNotificationPreferenceDraft(initial, {}, emailKey, false);
  const reordered = [required, { ...inApp, enabled: false }, email];
  const draft = projectNotificationPreferenceDraft(reordered, edits);
  assert.deepEqual(draft.rows.map((row) => [notificationPreferenceKey(row), row.enabled]), [
    [notificationPreferenceKey(required), true], [notificationPreferenceKey(inApp), false], [emailKey, false],
  ]);
  assert.deepEqual(draft.changes, [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }]);
});

test("returning a checkbox to its current server setting removes only that local edit", () => {
  const edits = editNotificationPreferenceDraft(initial, { [notificationPreferenceKey(inApp)]: false }, emailKey, false);
  const reverted = editNotificationPreferenceDraft(initial, edits, emailKey, true);
  assert.deepEqual(reverted, { [notificationPreferenceKey(inApp)]: false });
  assert.equal(edits[emailKey], false);
});

test("a background snapshot matching the draft needs no write and preserves that user intent", () => {
  const edits = editNotificationPreferenceDraft(initial, {}, emailKey, false);
  assert.deepEqual(projectNotificationPreferenceDraft([{ ...email, enabled: false }], edits).changes, []);
  const laterSnapshot = projectNotificationPreferenceDraft([email], edits);
  assert.equal(laterSnapshot.rows[0].enabled, false);
  assert.equal(laterSnapshot.changes.length, 1);
});

test("a server-mandated or removed preference cannot be submitted from an older draft", () => {
  const edits = editNotificationPreferenceDraft(initial, {}, emailKey, false);
  const mandated = projectNotificationPreferenceDraft([{ ...email, mandatory: true }, inApp], edits);
  assert.equal(mandated.rows[0].enabled, true);
  assert.deepEqual(mandated.changes, []);
  assert.equal(editNotificationPreferenceDraft([{ ...email, mandatory: true }], edits, emailKey, false), edits);
  assert.equal(editNotificationPreferenceDraft([inApp], edits, emailKey, false), edits);
  assert.deepEqual(projectNotificationPreferenceDraft([inApp], edits).changes, []);
});

test("saved server settings become the clean baseline and later edits use that baseline", () => {
  const saved = [{ ...email, enabled: false }, inApp, required];
  const clean = projectNotificationPreferenceDraft(saved, {});
  assert.equal(clean.rows[0].enabled, false);
  assert.deepEqual(clean.changes, []);
  const editedAgain = editNotificationPreferenceDraft(saved, {}, emailKey, true);
  assert.deepEqual(projectNotificationPreferenceDraft(saved, editedAgain).changes, [
    { notificationType: "BID_OUTBID", channel: "EMAIL", enabled: true },
  ]);
});
