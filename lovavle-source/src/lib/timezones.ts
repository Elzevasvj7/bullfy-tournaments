export const SUPPORTED_TIMEZONES = [
  { value: "America/Bogota", label: "Bogotá (COT)" },
  { value: "America/Lima", label: "Lima (PET)" },
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
  { value: "America/Caracas", label: "Caracas (VET)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/New_York", label: "Nueva York (EST/EDT)" },
  { value: "America/Chicago", label: "Miami / Chicago (CST/CDT)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Europe/London", label: "Londres (GMT/BST)" },
  { value: "Asia/Dubai", label: "Dubái (GST)" },
] as const;

export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const found = SUPPORTED_TIMEZONES.find((t) => t.value === tz);
    return found ? found.value : "America/Bogota";
  } catch {
    return "America/Bogota";
  }
}

export const REMINDER_OPTIONS = [
  { minutes: 40320, label: "4 semanas antes" },
  { minutes: 30240, label: "3 semanas antes" },
  { minutes: 20160, label: "2 semanas antes" },
  { minutes: 10080, label: "1 semana antes" },
  { minutes: 4320, label: "3 días antes" },
  { minutes: 600, label: "10 horas antes" },
  { minutes: 120, label: "2 horas antes" },
  { minutes: 10, label: "10 minutos antes" },
] as const;

export function parseEmailList(input: string): { valid: string[]; invalid: string[] } {
  const tokens = input.split(/[\s,;\n]+/).map((t) => t.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (re.test(lower)) valid.push(lower);
    else invalid.push(t);
  }
  return { valid, invalid };
}
