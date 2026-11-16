import { Game, DURATIONS } from "./game.js";
import { makeBackup, parseBackup, MAX_BACKUP_BYTES } from "./backup.js";
import {
  openStorage,
  listProfiles,
  getProfile,
  getScores,
  createProfile,
  checkPin,
  addScores,
  markExported,
} from "./storage.js";

const $ = (id) => document.getElementById(id);
const SESSION_KEY = "typerush-session-v1";
const SETTINGS_KEY = "typerush-settings-v1";
let words = [];
let game;
let mode = "speed";
let duration = 30;
let profile = null;
let storageAvailable = false;
let roundHandled = false;
let roundProfileId = null;
let composing = false;
let pendingImport = null;
let deferredInstall = null;
let registration;
let offlineReady = false;
let reloadAvailable = false;
let requestedUpdate = false;
let toastTimer;
let scoreRenderRevision = 0;

function message(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 6500);
}
function storageWarning(text) {
  $("storage-warning").textContent = text;
  $("storage-warning").hidden = false;
}
function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    message(
      "Your browser could not remember this preference. Profiles and scores use separate storage.",
    );
  }
}
function showDialog(id) {
  if (!$(id).open) $(id).showModal();
}
function setProfileTab(create) {
  $("signin-form").hidden = create;
  $("create-form").hidden = !create;
  $("signin-tab").classList.toggle("active", !create);
  $("create-tab").classList.toggle("active", create);
  $("signin-tab").setAttribute("aria-pressed", String(!create));
  $("create-tab").setAttribute("aria-pressed", String(create));
  $("profile-message").textContent = "";
}

function resetRound(focus = false) {
  if (!words.length) return;
  game = new Game(words, mode, duration);
  roundHandled = false;
  roundProfileId = null;
  $("typing-input").value = "";
  $("typing-input").disabled = false;
  $("result").hidden = true;
  $("duration-row").hidden = mode !== "speed";
  $("survival-rules").hidden = mode !== "survival";
  for (const item of ["speed", "survival"]) {
    $(`${item}-mode`).classList.toggle("active", mode === item);
    $(`${item}-mode`).setAttribute("aria-pressed", String(mode === item));
  }
  document.querySelectorAll(".duration").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.duration) === duration,
    );
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.duration) === duration),
    );
  });
  $("switch-mode").querySelector("span").textContent =
    mode === "speed" ? "Try Survival Mode" : "Try Speed Test";
  $("switch-mode")
    .querySelector("use")
    .setAttribute("href", mode === "speed" ? "#survival" : "#speed");
  $("game-status").textContent =
    mode === "speed"
      ? "Your first letter starts the clock. Space or Enter submits a word."
      : "Your first letter starts the clock. Correct word: +2s. Mistake: −1s.";
  renderRound(true);
  if (focus) $("typing-input").focus({ preventScroll: true });
}

function renderWords() {
  const fragment = document.createDocumentFragment();
  for (const item of game.completed) {
    const span = document.createElement("span");
    span.className = `word ${item.correct ? "complete" : "wrong"}`;
    span.textContent = item.word;
    fragment.append(span);
  }
  const current = document.createElement("span");
  current.className = "word current";
  [...game.target].forEach((character, index) => {
    const span = document.createElement("span");
    span.className = "letter";
    if (index < game.input.length)
      span.classList.add(character === game.input[index] ? "correct" : "wrong");
    else if (index === game.input.length) span.classList.add("cursor");
    span.textContent = character;
    current.append(span);
  });
  if (game.input.length > game.target.length) {
    const extra = document.createElement("span");
    extra.className = "letter wrong";
    extra.textContent = game.input.slice(game.target.length);
    current.append(extra);
  }
  fragment.append(current);
  for (let index = 1; index < 12; index++) {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = game.words[(game.index + index) % game.words.length];
    fragment.append(span);
  }
  $("words").replaceChildren(fragment);
  // Keep the current word visible after submitted history wraps on narrow screens.
  $("words").scrollTop = Math.max(
    0,
    current.offsetTop - $("words").firstElementChild.offsetTop,
  );
  const currentDescription = `Current word: ${game.target}`;
  if ($("current-word").textContent !== currentDescription)
    $("current-word").textContent = currentDescription;
  document
    .querySelector(".input-wrap")
    .classList.toggle("incorrect", !game.target.startsWith(game.input));
}
function renderRound(updateWords = false) {
  if (!game) return;
  $("wpm").textContent = Math.round(game.wpm);
  $("accuracy").textContent = Math.round(game.accuracy);
  $("time-left").textContent = Math.ceil(game.remaining);
  const max = mode === "survival" ? 30 : duration;
  $("progress-fill").style.width = `${(100 * game.remaining) / max}%`;
  $("time-progress").setAttribute("aria-valuemax", max);
  $("time-progress").setAttribute("aria-valuenow", game.remaining.toFixed(1));
  $("progress-label").textContent = `${Math.ceil(game.remaining)}s / ${max}s`;
  $("round-state").textContent = game.finished
    ? "ROUND COMPLETE"
    : game.running
      ? "FIND YOUR FLOW"
      : "READY WHEN YOU ARE";
  $("profile-button").disabled = game.running;
  $("score-action").disabled = game.running && !profile;
  $("update-button").disabled = game.running;
  if (updateWords) renderWords();
  if (game.finished && !roundHandled) void finishRound();
}

async function finishRound() {
  roundHandled = true;
  const finishedGame = game;
  $("typing-input").disabled = true;
  $("game-status").textContent =
    "Nice work. Restart when you’re ready for another round.";
  $("result").hidden = false;
  $("result-heading").textContent =
    mode === "survival"
      ? `SURVIVED ${game.elapsed.toFixed(1)} SECONDS`
      : `${duration}-SECOND TEST COMPLETE`;
  $("result-summary").textContent =
    `${Math.round(game.wpm)} WPM · ${Math.round(game.accuracy)}% accuracy`;
  $("result-profile").hidden = !!profile;
  if (!profile || profile.id !== roundProfileId) {
    $("save-status").textContent =
      "Guest round. Sign in before your next round to save high scores.";
    return;
  }
  $("save-status").textContent = "Saving your score…";
  const result = {
    ...game.result(),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const ownerId = profile.id;
  try {
    const updated = await addScores(ownerId, [result]);
    if (profile?.id === ownerId) profile = updated;
    const scores = await getScores(ownerId);
    if (game === finishedGame)
      $("save-status").textContent = scores.some(
        (score) => score.id === result.id,
      )
        ? "Saved to your local high scores. Remember to export a backup."
        : "Round complete. Your top 10 high scores are unchanged.";
    await renderProfileStrip();
  } catch (error) {
    if (game === finishedGame)
      $("save-status").textContent = `Score not saved. ${error.message}`;
  }
}

function handleInput() {
  if (!game || composing || game.finished) return;
  if (!game.running && $("typing-input").value.trim())
    roundProfileId = profile?.id || null;
  const submitted = game.type($("typing-input").value, Date.now());
  $("typing-input").value = game.input;
  if (submitted.length && !game.finished) {
    const correct = submitted.at(-1);
    $("game-status").textContent =
      mode === "survival"
        ? correct
          ? "Correct! +2 seconds. Keep your rhythm."
          : "Mistake. −1 second. Try the next word."
        : correct
          ? "Correct. Keep your rhythm."
          : "Word submitted with a mistake. Keep practicing.";
  }
  renderRound(true);
}

async function renderProfileStrip() {
  const owner = profile;
  $("profile-label").textContent = owner ? owner.name : "Local profile";
  $("score-action").textContent = owner
    ? "View high scores ↗"
    : "Create a profile ↗";
  $("backup-reminder").hidden = true;
  if (!owner) {
    $("score-heading").textContent = "Your next personal best starts here.";
    $("score-description").textContent =
      "Play freely as a guest. Use a local profile to keep your high scores.";
    return;
  }
  $("score-heading").textContent = `Keep going, ${owner.name}.`;
  $("score-description").textContent = "Loading your local high scores…";
  const scores = await getScores(owner.id);
  if (profile?.id !== owner.id) return;
  const speed = scores.filter((score) => score.mode === "speed");
  const survival = scores.filter((score) => score.mode === "survival");
  const best = [];
  if (speed.length)
    best.push(
      `${Math.round(Math.max(...speed.map((score) => score.wpm)))} WPM best speed`,
    );
  if (survival.length)
    best.push(
      `${Math.max(...survival.map((score) => score.elapsed)).toFixed(1)}s best survival`,
    );
  $("score-description").textContent = best.length
    ? best.join(" · ")
    : "Finish a round to save your first personal best.";
  $("backup-reminder").hidden = !owner.unbacked;
  $("backup-reminder-text").textContent =
    `${owner.unbacked} new high score${owner.unbacked === 1 ? "" : "s"} since your last export. Save a backup outside the app.`;
}

async function openProfile(create = false) {
  if (game?.running) {
    message("Finish or restart this round before changing profiles.");
    return;
  }
  if (!storageAvailable) {
    message(
      "Local profiles are unavailable because browser storage could not be opened. Guest play still works.",
    );
    return;
  }
  $("profile-message").textContent = "";
  $("signed-in-view").hidden = !profile;
  $("signed-out-view").hidden = !!profile;
  if (profile) $("signed-in-name").textContent = profile.name;
  else {
    try {
      const profiles = (await listProfiles()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      $("profile-select").replaceChildren(
        ...profiles.map((item) => new Option(item.name, item.id)),
      );
      $("no-profiles").hidden = profiles.length > 0;
      $("signin-form").querySelector("button[type=submit]").disabled =
        !profiles.length;
      setProfileTab(create || !profiles.length);
    } catch (error) {
      message(error.message);
      return;
    }
  }
  showDialog("profile-dialog");
}
async function signIn(newProfile) {
  profile = newProfile;
  writeLocal(SESSION_KEY, profile.id);
  $("profile-dialog").close();
  await renderProfileStrip();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  message(
    `Welcome, ${profile.name}. Completed rounds can now save high scores on this device.`,
  );
}
async function submitProfile(event, create) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  $("profile-message").textContent = "";
  try {
    if (create) {
      if ($("create-pin").value !== $("confirm-pin").value)
        throw new Error("Your PINs do not match. Try again.");
      await signIn(
        await createProfile($("create-name").value, $("create-pin").value),
      );
    } else {
      const selected = await getProfile($("profile-select").value);
      if (!selected || !(await checkPin(selected, $("signin-pin").value)))
        throw new Error("That PIN does not match this profile.");
      await signIn(selected);
    }
  } catch (error) {
    $("profile-message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function openScores() {
  if (!profile) {
    await openProfile();
    return;
  }
  $("score-mode").value = mode;
  $("score-duration").value = String(duration);
  $("backup-message").textContent = "";
  $("import-preview").hidden = true;
  pendingImport = null;
  showDialog("scores-dialog");
  await renderScores();
}
async function renderScores() {
  if (!profile) return;
  const revision = ++scoreRenderRevision;
  const owner = profile;
  $("scores-subtitle").textContent =
    `${owner.name} · Saved on this device · Top 10 per category`;
  const scoreMode = $("score-mode").value;
  const scoreDuration = Number($("score-duration").value);
  $("score-duration").hidden = scoreMode !== "speed";
  $("score-list").textContent = "Loading your scores…";
  $("export-button").disabled = true;
  $("export-info").textContent = "";
  const all = await getScores(owner.id);
  if (profile?.id !== owner.id || revision !== scoreRenderRevision) return;
  const scores = all
    .filter(
      (score) =>
        score.mode === scoreMode &&
        (scoreMode === "survival" || score.duration === scoreDuration),
    )
    .sort(
      (a, b) =>
        (scoreMode === "survival" ? b.elapsed - a.elapsed : b.wpm - a.wpm) ||
        b.accuracy - a.accuracy,
    );
  $("score-list").replaceChildren();
  if (!scores.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent =
      "A fresh start. Finish a round in this category to set your first score.";
    $("score-list").append(empty);
  } else {
    const table = document.createElement("table");
    table.className = "score-table";
    const head = table.createTHead().insertRow();
    [
      "#",
      scoreMode === "survival" ? "Survived" : "WPM",
      "Accuracy",
      "Date",
    ].forEach((title) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = title;
      head.append(cell);
    });
    const body = table.createTBody();
    scores.forEach((score, index) => {
      const row = body.insertRow();
      [
        index + 1,
        scoreMode === "survival"
          ? `${score.elapsed.toFixed(1)}s`
          : score.wpm.toFixed(1),
        `${score.accuracy.toFixed(1)}%`,
        new Date(score.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      ].forEach((value) => {
        row.insertCell().textContent = value;
      });
      row.title = new Date(score.createdAt).toLocaleString();
    });
    $("score-list").append(table);
  }
  $("export-button").disabled = all.length === 0;
  $("export-info").textContent = owner.lastExportAt
    ? `Last export: ${new Date(owner.lastExportAt).toLocaleString()}`
    : "No backup exported yet.";
}
async function exportBackup() {
  if (!profile) return;
  const owner = profile;
  try {
    const scores = await getScores(owner.id);
    if (!scores.length) {
      message("Finish a round to create your first score backup.");
      return;
    }
    const blob = new Blob([makeBackup(owner.name, scores)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TypeRush-${owner.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const updated = await markExported(
      owner.id,
      scores.map((score) => score.id),
    );
    if (profile?.id === owner.id) profile = updated;
    await renderProfileStrip();
    if ($("scores-dialog").open) await renderScores();
    message(
      "Backup download started. Keep the JSON file in Files, Downloads, or your own cloud drive.",
    );
  } catch (error) {
    message(error.message);
  }
}
async function readBackup(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || !profile) return;
  $("backup-message").textContent = "";
  $("import-preview").hidden = true;
  pendingImport = null;
  try {
    if (file.size > MAX_BACKUP_BYTES)
      throw new Error("Choose a TypeRush backup smaller than 2 MB.");
    const data = parseBackup(await file.text());
    pendingImport = { data, profileId: profile.id };
    $("import-preview-text").textContent =
      `Merge ${data.scores.length} high score${data.scores.length === 1 ? "" : "s"} from “${data.name}” into “${profile.name}”? Existing bests are kept; duplicates are skipped.`;
    $("import-preview").hidden = false;
  } catch (error) {
    $("backup-message").textContent = error.message;
  }
}

function renderConnection() {
  $("connection").classList.toggle("ready", offlineReady);
  $("connection").querySelector("span").textContent = offlineReady
    ? navigator.onLine
      ? "Offline ready"
      : "Playing offline"
    : navigator.onLine
      ? "Preparing offline play"
      : "Offline setup incomplete";
}
function offerUpdate() {
  reloadAvailable = true;
  $("update-banner").hidden = false;
}
async function setupOffline() {
  if (!("serviceWorker" in navigator)) {
    $("connection").querySelector("span").textContent = "Online play";
    $("install-state").textContent =
      "This browser does not support offline setup. Try Safari, Chrome, or Edge.";
    return;
  }
  let previouslyControlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    offlineReady = true;
    renderConnection();
    if (requestedUpdate && !game?.running) location.reload();
    else if (previouslyControlled) offerUpdate();
    previouslyControlled = true;
  });
  try {
    registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none",
    });
    if (registration.waiting) offerUpdate();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (worker)
        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            offerUpdate();
        });
    });
    await navigator.serviceWorker.ready;
    offlineReady = true;
    renderConnection();
  } catch {
    $("connection").querySelector("span").textContent = "Online play";
    $("install-state").textContent =
      "Offline setup did not finish. Reopen TypeRush with internet access and try again.";
  }
}

document
  .querySelectorAll(".close-dialog")
  .forEach((button) =>
    button.addEventListener("click", () => button.closest("dialog").close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  }),
);
$("profile-dialog").addEventListener("close", () => {
  $("signin-form").reset();
  $("create-form").reset();
});
$("speed-mode").addEventListener("click", () => {
  mode = "speed";
  resetRound();
});
$("survival-mode").addEventListener("click", () => {
  mode = "survival";
  resetRound();
});
$("switch-mode").addEventListener("click", () => {
  mode = mode === "speed" ? "survival" : "speed";
  resetRound();
});
document.querySelectorAll(".duration").forEach((button) =>
  button.addEventListener("click", () => {
    const selected = Number(button.dataset.duration);
    if (DURATIONS.includes(selected)) {
      duration = selected;
      resetRound();
    }
  }),
);
$("restart-button").addEventListener("click", () => resetRound(true));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    resetRound(true);
  }
});
$("typing-input").addEventListener("input", handleInput);
$("typing-input").addEventListener("compositionstart", () => {
  composing = true;
});
$("typing-input").addEventListener("compositionend", () => {
  composing = false;
  handleInput();
});
$("typing-input").addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !composing &&
    !event.isComposing &&
    !game?.finished
  ) {
    event.preventDefault();
    $("typing-input").value += " ";
    handleInput();
  }
});
for (const eventName of ["paste", "drop"])
  $("typing-input").addEventListener(eventName, (event) => {
    event.preventDefault();
    message("Type the words yourself to keep practice scores meaningful.");
  });
$("typing-input").addEventListener("beforeinput", (event) => {
  if (["insertFromPaste", "insertFromDrop"].includes(event.inputType))
    event.preventDefault();
});
$("profile-button").addEventListener("click", () => void openProfile());
$("result-profile").addEventListener("click", () => void openProfile(true));
$("score-action").addEventListener(
  "click",
  () => void (profile ? openScores() : openProfile(true)),
);
$("signin-tab").addEventListener("click", () => setProfileTab(false));
$("create-tab").addEventListener("click", () => setProfileTab(true));
$("signin-form").addEventListener(
  "submit",
  (event) => void submitProfile(event, false),
);
$("create-form").addEventListener(
  "submit",
  (event) => void submitProfile(event, true),
);
$("sign-out").addEventListener("click", async () => {
  profile = null;
  writeLocal(SESSION_KEY, null);
  $("profile-dialog").close();
  await renderProfileStrip();
  message("Signed out. You can keep playing as a guest.");
});
$("scores-button").addEventListener(
  "click",
  () => void openScores().catch((error) => message(error.message)),
);
for (const id of ["score-mode", "score-duration"])
  $(id).addEventListener(
    "change",
    () => void renderScores().catch((error) => message(error.message)),
  );
$("export-button").addEventListener("click", () => void exportBackup());
$("backup-reminder-button").addEventListener(
  "click",
  () => void exportBackup(),
);
$("import-button").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", readBackup);
$("cancel-import").addEventListener("click", () => {
  pendingImport = null;
  $("import-preview").hidden = true;
});
$("confirm-import").addEventListener("click", async () => {
  if (!pendingImport || pendingImport.profileId !== profile?.id) return;
  $("confirm-import").disabled = true;
  try {
    profile = await addScores(profile.id, pendingImport.data.scores);
    pendingImport = null;
    $("import-preview").hidden = true;
    $("backup-message").textContent =
      "Backup restored. Your best scores are merged without duplicates.";
    await renderScores();
    await renderProfileStrip();
  } catch (error) {
    $("backup-message").textContent = error.message;
  } finally {
    $("confirm-import").disabled = false;
  }
});
for (const id of ["settings-button", "help-button"])
  $(id).addEventListener("click", () => showDialog("settings-dialog"));
$("large-text").checked = readLocal(SETTINGS_KEY) === "large";
$("words").classList.toggle("large", $("large-text").checked);
$("large-text").addEventListener("change", () => {
  $("words").classList.toggle("large", $("large-text").checked);
  writeLocal(SETTINGS_KEY, $("large-text").checked ? "large" : "normal");
});
$("install-button").addEventListener("click", () => {
  $("native-install").hidden = !deferredInstall;
  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone)
    $("install-state").textContent =
      "TypeRush is already open as an installed web app on this device.";
  showDialog("install-dialog");
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  $("native-install").hidden = false;
});
$("native-install-button").addEventListener("click", async () => {
  if (!deferredInstall) return;
  await deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("native-install").hidden = true;
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  $("install-label").textContent = "Installed";
  message("TypeRush is installed. Your next round is one tap away.");
});
for (const name of ["online", "offline"])
  window.addEventListener(name, renderConnection);
$("update-button").addEventListener("click", () => {
  if (game?.running || !reloadAvailable) return;
  if (registration?.waiting) {
    requestedUpdate = true;
    registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
  } else location.reload();
});
window.addEventListener("storage", async (event) => {
  if (event.key !== SESSION_KEY) return;
  try {
    profile = event.newValue
      ? (await getProfile(event.newValue)) || null
      : null;
    await renderProfileStrip();
    if ($("scores-dialog").open) $("scores-dialog").close();
    if ($("profile-dialog").open) $("profile-dialog").close();
  } catch {
    profile = null;
  }
});
setInterval(() => {
  if (game?.running) {
    game.advance(Date.now());
    renderRound();
  }
}, 100);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && game?.running) {
    game.advance(Date.now());
    renderRound();
  }
});

await Promise.all([
  (async () => {
    try {
      const response = await fetch("./assets/words.txt");
      if (!response.ok) throw new Error("Practice word list unavailable.");
      words = (await response.text())
        .trim()
        .split(/\s+/)
        .filter((word) => /^[a-z]+$/.test(word));
      if (!words.length) throw new Error("No practice words found.");
      resetRound();
    } catch {
      $("game-status").textContent =
        "Practice words could not load. Reconnect and reload TypeRush.";
    }
  })(),
  (async () => {
    try {
      await openStorage();
      storageAvailable = true;
      const id = readLocal(SESSION_KEY);
      if (id) profile = (await getProfile(id)) || null;
      await renderProfileStrip();
    } catch {
      storageWarning(
        "Local score storage is unavailable. Guest practice works, but scores cannot be saved. Check your browser’s storage settings.",
      );
    }
  })(),
]);
void setupOffline();
