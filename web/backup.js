import { DURATIONS } from "./game.js";

export const BACKUP_FORMAT = "TypeRush.score-backup";
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export function validScore(score) {
  return (
    score &&
    typeof score.id === "string" &&
    /^[\w-]{1,100}$/.test(score.id) &&
    ["speed", "survival"].includes(score.mode) &&
    (score.mode === "speed"
      ? DURATIONS.includes(score.duration)
      : score.duration === 0) &&
    Number.isFinite(score.wpm) &&
    score.wpm >= 0 &&
    score.wpm <= 10000 &&
    Number.isFinite(score.accuracy) &&
    score.accuracy >= 0 &&
    score.accuracy <= 100 &&
    Number.isFinite(score.elapsed) &&
    score.elapsed > 0 &&
    score.elapsed <= 1e7 &&
    (score.mode !== "speed" ||
      Math.abs(score.elapsed - score.duration) < 0.01) &&
    typeof score.createdAt === "string" &&
    Number.isFinite(Date.parse(score.createdAt))
  );
}

export function cleanScore(score) {
  return {
    id: score.id,
    mode: score.mode,
    duration: score.duration,
    wpm: score.wpm,
    accuracy: score.accuracy,
    elapsed: score.elapsed,
    createdAt: score.createdAt,
  };
}

export function rankScores(scores) {
  const groups = new Map();
  for (const score of scores) {
    const key = `${score.mode}:${score.duration}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(score);
  }
  return [...groups.values()].flatMap((group) =>
    group
      .sort(
        (a, b) =>
          (a.mode === "survival" ? b.elapsed - a.elapsed : b.wpm - a.wpm) ||
          b.accuracy - a.accuracy ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .slice(0, 10),
  );
}

export function mergeScores(existing, incoming) {
  const unique = new Map(
    existing.map((score) => [score.id, cleanScore(score)]),
  );
  for (const score of incoming)
    if (!unique.has(score.id)) unique.set(score.id, cleanScore(score));
  return rankScores([...unique.values()]);
}

export function makeBackup(name, scores, now = new Date()) {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      profile: { name },
      scores: scores.map(cleanScore),
    },
    null,
    2,
  );
}

export function parseBackup(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_BACKUP_BYTES
  ) {
    throw new Error("Choose a TypeRush backup smaller than 2 MB.");
  }
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("This file is not a valid JSON backup.");
  }
  if (
    backup?.format !== BACKUP_FORMAT ||
    backup.version !== 1 ||
    typeof backup.profile?.name !== "string" ||
    !backup.profile.name.trim() ||
    backup.profile.name.length > 24 ||
    !Array.isArray(backup.scores) ||
    backup.scores.length > 1000 ||
    !backup.scores.every(validScore)
  ) {
    throw new Error(
      "This is not a supported TypeRush score backup. Your current scores are unchanged.",
    );
  }
  return { name: backup.profile.name, scores: mergeScores([], backup.scores) };
}
