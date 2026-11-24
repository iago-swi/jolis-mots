/** Mélange de Fisher–Yates avec un hasard injecté ; ne modifie pas la liste reçue. */
export function melanger<T>(liste: readonly T[], alea: () => number): T[] {
  const r = [...liste];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [r[i], r[j]] = [r[j] as T, r[i] as T];
  }
  return r;
}
