import path from "node:path";
export function privateDirectory() {
  // Runtime uploads live on a persistent volume; they must not be traced into builds.
  return path.resolve(/* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_PATH || ".data/uploads");
}
export function privateFile(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return path.join(/* turbopackIgnore: true */ privateDirectory(), key);
}
