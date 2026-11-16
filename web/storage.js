import { mergeScores, cleanScore, validScore } from "./backup.js";

const DATABASE = "typerush-player-data";
// App/service-worker versions never change this name or erase player data.
const VERSION = 1;
let database;

export async function openStorage() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const profiles = db.createObjectStore("profiles", { keyPath: "id" });
      profiles.createIndex("nameKey", "nameKey", { unique: true });
      const scores = db.createObjectStore("scores", { keyPath: "key" });
      scores.createIndex("profileId", "profileId");
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other TypeRush tabs and try again."));
  });
  return database;
}

async function read(store, action) {
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readonly");
    const request = action(transaction.objectStore(store));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || new Error("Storage access was interrupted."));
  });
}

export const listProfiles = () => read("profiles", (store) => store.getAll());
export const getProfile = (id) => read("profiles", (store) => store.get(id));
export const getScores = (id) =>
  read("scores", (store) => store.index("profileId").getAll(id));

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 210000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return hex(new Uint8Array(bits));
}

export async function createProfile(name, pin) {
  name = name.trim();
  if (!name || name.length > 24 || /[\u0000-\u001f]/.test(name))
    throw new Error("Use a profile name with 1–24 characters.");
  if (!/^\d{4,12}$/.test(pin))
    throw new Error("Choose a PIN with 4–12 digits.");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const profile = {
    id: crypto.randomUUID(),
    name,
    nameKey: name.toLocaleLowerCase(),
    salt,
    pinHash: await hashPin(pin, salt),
    lastExportAt: null,
    unbacked: 0,
  };
  const db = await openStorage();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("profiles", "readwrite");
    transaction.objectStore("profiles").add(profile);
    transaction.oncomplete = resolve;
    transaction.onerror = () =>
      reject(
        new Error(
          transaction.error?.name === "ConstraintError"
            ? "That profile name already exists. Sign in or choose another name."
            : "Could not save this profile. Check device storage.",
        ),
      );
    transaction.onabort = () =>
      reject(
        new Error("Could not create the profile. That name may already exist."),
      );
  });
  return profile;
}

export async function checkPin(profile, pin) {
  const candidate = await hashPin(pin, profile.salt);
  let difference = candidate.length ^ profile.pinHash.length;
  for (let i = 0; i < candidate.length; i++)
    difference |= candidate.charCodeAt(i) ^ profile.pinHash.charCodeAt(i);
  return difference === 0;
}

export async function addScores(profileId, incoming) {
  if (!incoming.every(validScore))
    throw new Error("These scores could not be saved.");
  const db = await openStorage();
  // Read/merge/write in one transaction to avoid losing a score from another tab.
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles", "scores"], "readwrite");
    const profiles = transaction.objectStore("profiles");
    const scores = transaction.objectStore("scores");
    const profileRequest = profiles.get(profileId);
    let updated;
    profileRequest.onsuccess = () => {
      const profile = profileRequest.result;
      if (!profile) {
        transaction.abort();
        return;
      }
      const request = scores.index("profileId").getAll(profileId);
      request.onsuccess = () => {
        const previous = request.result;
        const merged = mergeScores(previous, incoming);
        const previousIds = new Set(previous.map((score) => score.id));
        const additions = merged.filter(
          (score) => !previousIds.has(score.id),
        ).length;
        previous.forEach((score) => scores.delete(score.key));
        merged.forEach((score) =>
          scores.put({
            ...cleanScore(score),
            profileId,
            key: `${profileId}:${score.id}`,
          }),
        );
        updated = { ...profile, unbacked: profile.unbacked + additions };
        profiles.put(updated);
      };
    };
    transaction.oncomplete = () => resolve(updated);
    transaction.onerror = () =>
      reject(
        new Error(
          "Could not save scores. Device storage may be full. Export a backup and try again.",
        ),
      );
    transaction.onabort = () =>
      reject(
        new Error(
          "Scores were not saved. Reopen your local profile and try again.",
        ),
      );
  });
}

export async function markExported(profileId, exportedIds) {
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles", "scores"], "readwrite");
    const store = transaction.objectStore("profiles");
    const request = store.get(profileId);
    let updated;
    request.onsuccess = () => {
      if (!request.result) {
        transaction.abort();
        return;
      }
      const profile = request.result;
      const scoreRequest = transaction
        .objectStore("scores")
        .index("profileId")
        .getAll(profileId);
      scoreRequest.onsuccess = () => {
        const exported = new Set(exportedIds);
        updated = {
          ...profile,
          lastExportAt: new Date().toISOString(),
          unbacked: scoreRequest.result.filter(
            (score) => !exported.has(score.id),
          ).length,
        };
        store.put(updated);
      };
    };
    transaction.oncomplete = () => resolve(updated);
    transaction.onerror = () =>
      reject(
        new Error(
          "The backup downloaded, but its reminder could not be updated.",
        ),
      );
    transaction.onabort = () =>
      reject(
        new Error(
          "The backup downloaded. Reopen your profile to update its reminder.",
        ),
      );
  });
}
