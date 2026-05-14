const KEY = "hanna-runs:v1";

const DEFAULT = {
  topScores: [], // [{ score, coins, distance, date }]
  totalCoins: 0,
  muted: false,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return { ...DEFAULT };
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function recordRun(state, run) {
  const entry = {
    score: run.score,
    coins: run.coins,
    distance: run.distance,
    date: new Date().toISOString().slice(0, 10),
  };
  state.topScores.push(entry);
  state.topScores.sort((a, b) => b.score - a.score);
  state.topScores = state.topScores.slice(0, 5);
  state.totalCoins += run.coins;
  save(state);
  // Was this entry now in the list AND is it #1?
  return state.topScores[0] === entry;
}
