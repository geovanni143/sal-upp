// ESM
export function esEmailUPP(email = "") {
  return /^[\w.\-]+@upp\.edu\.mx$/i.test(email.trim());
}
export function horaMenor(a, b) {
  // "HH:MM:SS" string compare ok
  return a < b;
}
