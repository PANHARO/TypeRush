import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("worker caches the entire app at a project subpath and updates without deleting player data", async () => {
  const source = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const handlers = new Map();
  const cached = [];
  const deleted = [];
  let claimed = false;
  let skipped = false;
  const self = {
    location: { href: "https://example.test/TypeRush/sw.js" },
    addEventListener: (name, handler) => handlers.set(name, handler),
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
    skipWaiting: () => {
      skipped = true;
    },
  };
  vm.runInNewContext(source, {
    URL,
    self,
    caches: {
      open: async () => ({
        addAll: async (urls) => cached.push(...urls),
        match: async () => undefined,
      }),
      keys: async () => [
        "typerush-app-%2FTypeRush%2F-old",
        "unrelated-cache",
        "typerush-app-%2FOtherApp%2F-old",
        "typerush-app-%2FTypeRush%2F-__BUILD_VERSION__",
      ],
      delete: async (key) => {
        deleted.push(key);
      },
    },
    indexedDB: {
      deleteDatabase: () =>
        assert.fail("Player data must never be deleted by an update"),
    },
  });
  let pending;
  handlers.get("install")({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.equal(skipped, false);
  assert.ok(cached.includes("https://example.test/TypeRush/assets/words.txt"));
  assert.ok(cached.includes("https://example.test/TypeRush/storage.js"));
  assert.ok(
    cached.every((url) => url.startsWith("https://example.test/TypeRush/")),
  );
  handlers.get("activate")({
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
  assert.deepEqual(deleted, ["typerush-app-%2FTypeRush%2F-old"]);
  assert.equal(claimed, true);
  handlers.get("message")({ data: { type: "ACTIVATE_UPDATE" } });
  assert.equal(skipped, true);
});
