export function getEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return v;
}

export function getOptionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  get databaseUrl() {
    return getEnv("DATABASE_URL");
  },
  get appPassword() {
    return process.env.APP_PASSWORD ?? "";
  },
  get sessionSecret() {
    return process.env.APP_SESSION_SECRET ?? process.env.APP_PASSWORD ?? "dev-secret";
  },
  get maxUploadBytes() {
    return Number(process.env.MAX_UPLOAD_BYTES ?? 4718592);
  },
  get exportMaxRows() {
    return Number(process.env.EXPORT_MAX_ROWS ?? 20000);
  },
};
