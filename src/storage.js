// @ts-check
export const SCORE_KEY = "squeek-maze.scores.v1";
/** @typedef {{name: string, score: number, level: number, date: string}} Entry */
/** @returns {Entry[]} */
export function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(SCORE_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (e) =>
          e &&
          typeof e.name === "string" &&
          Number.isSafeInteger(e.score) &&
          e.score >= 0 &&
          Number.isInteger(e.level) &&
          e.level >= 1 &&
          e.level <= 50 &&
          typeof e.date === "string",
      )
      .map((e) => ({
        name: e.name.slice(0, 18),
        score: e.score,
        level: e.level,
        date: e.date,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch {
    return [];
  }
}
/** @param {string} name @param {number} score @param {number} level */
export function saveScore(name, score, level) {
  const entries = [
    ...loadScores(),
    {
      name: name.trim().slice(0, 18),
      score,
      level,
      date: new Date().toISOString(),
    },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  try {
    localStorage.setItem(SCORE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}
