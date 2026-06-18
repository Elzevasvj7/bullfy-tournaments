function readNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const bullfyEnv = {
  apiBaseUrl:
    process.env.BULLFY_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BULLFY_API_BASE_URL ??
    "",
  realtimeUrl:
    process.env.BULLFY_REALTIME_URL ??
    process.env.NEXT_PUBLIC_BULLFY_REALTIME_URL ??
    "",
  requestTimeoutMs: readNumberEnv(
    process.env.BULLFY_REQUEST_TIMEOUT_MS,
    10_000,
  ),
  realtimeReconnectInitialDelayMs: readNumberEnv(
    process.env.BULLFY_REALTIME_RECONNECT_INITIAL_DELAY_MS,
    1_000,
  ),
  realtimeReconnectMaxDelayMs: readNumberEnv(
    process.env.BULLFY_REALTIME_RECONNECT_MAX_DELAY_MS,
    15_000,
  ),
};
