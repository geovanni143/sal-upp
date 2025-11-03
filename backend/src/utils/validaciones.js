export function esEmailUPP(email){
  return typeof email === "string" && /@upp\.edu\.mx$/i.test(email);
}
