type RuntimeEnv = Record<string, string | undefined>;

/** Vercel functions do not offer durable project or asset storage. */
export function isReadOnlyRuntime(env: RuntimeEnv = process.env) {
  return env.VERCEL === "1" || env.STORECANVAS_READ_ONLY === "1";
}
