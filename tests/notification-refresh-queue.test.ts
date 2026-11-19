import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";
import { createNotificationRefreshQueue } from "../features/notificationRefreshQueue";

const deferred = () => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
};
const until = async (condition: () => boolean) => {
  for (let i = 0; i < 300 && !condition(); i++) await delay(10);
  assert.ok(condition(), "Expected notification refresh to finish");
};
const fixture = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const keys = [queryKeys.notification.list(1, { page: 0, size: 10 }), queryKeys.notification.unreadCount(1)];
  const requests = keys.map(() => [] as ReturnType<typeof deferred>[]);
  const observers = keys.map((queryKey, index) => new QueryObserver(client, { queryKey, queryFn: () => {
    const next = deferred(); requests[index].push(next); return next.promise;
  } }));
  const unsubscribe = observers.map((observer) => observer.subscribe(() => {}));
  const states: boolean[] = [];
  let current = true;
  const queue = createNotificationRefreshQueue(client, 1, () => current, (failed) => states.push(failed));
  const cleanup = () => { current = false; queue.stop(); unsubscribe.forEach((off) => off()); client.clear(); };
  return { client, keys, requests, queue, states, cleanup, setCurrent: (value: boolean) => { current = value; } };
};

test("SSE during initial GET starts fresh reads and rejects the late initial snapshot", async () => {
  const f = fixture();
  try {
    assert.deepEqual(f.requests.map((requests) => requests.length), [1, 1]);
    f.queue.request("new");
    await until(() => f.requests.every((requests) => requests.length === 2));
    f.requests.forEach((requests) => requests[0].resolve("old"));
    f.requests.forEach((requests) => requests[1].resolve("new"));
    await until(() => f.states.includes(false));
    f.keys.forEach((key) => assert.equal(f.client.getQueryData(key), "new"));
    f.queue.request("new");
    await delay(20);
    assert.deepEqual(f.requests.map((requests) => requests.length), [2, 2]);
  } finally { f.cleanup(); }
});

test("multiple revisions during refresh coalesce into one follow-up for the latest revision", async () => {
  const f = fixture();
  try {
    f.queue.request("one");
    await until(() => f.requests.every((requests) => requests.length === 2));
    f.queue.request("two"); f.queue.request("three"); f.queue.request("three");
    f.requests.forEach((requests) => requests[1].resolve("one"));
    await until(() => f.requests.every((requests) => requests.length === 3));
    f.requests.forEach((requests) => requests[2].resolve("three"));
    await until(() => f.states.length === 2);
    f.keys.forEach((key) => assert.equal(f.client.getQueryData(key), "three"));
    assert.deepEqual(f.requests.map((requests) => requests.length), [3, 3]);
  } finally { f.cleanup(); }
});

test("a failed read retries the same revision after both requests settle, without another SSE", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let listReads = 0, countReads = 0;
  const slow = deferred();
  const observers = [
    new QueryObserver(client, { queryKey: queryKeys.notification.list(1, { page: 0, size: 10 }), queryFn: async () => {
      if (++listReads === 2) throw new Error("temporary failure");
      return "fresh";
    } }),
    new QueryObserver(client, { queryKey: queryKeys.notification.unreadCount(1), queryFn: () => ++countReads === 2 ? slow.promise : Promise.resolve("fresh") }),
  ];
  const off = observers.map((observer) => observer.subscribe(() => {}));
  const states: boolean[] = [];
  const queue = createNotificationRefreshQueue(client, 1, () => true, (failed) => states.push(failed));
  try {
    await until(() => observers.every((observer) => observer.getCurrentResult().isSuccess));
    queue.request("same");
    await until(() => listReads === 2 && countReads === 2);
    await delay(30);
    assert.equal(states.length, 0);
    slow.resolve("fresh");
    await until(() => states.includes(false));
    assert.deepEqual(states, [true, false]);
    assert.equal(listReads, 3); assert.equal(countReads, 3);
  } finally { queue.stop(); off.forEach((unsubscribe) => unsubscribe()); client.clear(); }
});

test("logout during cancellation prevents new private reads", async () => {
  const f = fixture();
  try {
    f.queue.request("new");
    f.setCurrent(false); f.queue.stop();
    f.requests.forEach((requests) => requests[0].resolve("old"));
    await delay(30);
    assert.deepEqual(f.requests.map((requests) => requests.length), [1, 1]);
    assert.deepEqual(f.states, []);
  } finally { f.cleanup(); }
});
