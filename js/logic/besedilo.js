// Slovenska dvojina in množina.

/**
 * Pravilna oblika za število: plural(n, ['živilo', 'živili', 'živila', 'živil']).
 * Oblike: [1, 2, 3–4, 5+] (upošteva 101, 102, 103 ...).
 */
export function plural(n, forms) {
  const m = Math.abs(Math.trunc(n)) % 100;
  if (m === 1) return forms[0];
  if (m === 2) return forms[1];
  if (m === 3 || m === 4) return forms[2];
  return forms[3];
}

/** "3 živila" */
export function count(n, forms) {
  return `${n} ${plural(n, forms)}`;
}

export const ZIVILO = ['živilo', 'živili', 'živila', 'živil'];
export const VNOS = ['vnos', 'vnosa', 'vnose', 'vnosov'];
export const MERITEV = ['meritev', 'meritvi', 'meritve', 'meritev'];
/** mestnik: »v 1 vnosu«, »v 2 vnosih« */
export const VNOS_MESTNIK = ['vnosu', 'vnosih', 'vnosih', 'vnosih'];
