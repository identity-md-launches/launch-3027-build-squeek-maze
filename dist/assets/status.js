// @ts-check
export const STATUS_URL = "https://api.squeekchain.com/v1/status";
/** @typedef {{state: 'running'|'sleeping'|'unavailable'|'checking', rpm: number}} WheelStatus */
/** The current API reports fresh wheel measurements, not a top-level running boolean.
 * @param {unknown} body @param {number} [now] @returns {WheelStatus} */
export function parseStatus(body, now = Date.now()) {
  if (!body || typeof body !== "object" || !("measurement" in body))
    return { state: "unavailable", rpm: 0 };
  const m =
    /** @type {{freshness?: string, observedAt?: string, staleAfterSeconds?: number, rpmMilli?: number}} */ (
      body.measurement
    );
  if (
    !m ||
    m.freshness !== "online" ||
    typeof m.observedAt !== "string" ||
    typeof m.rpmMilli !== "number" ||
    !Number.isFinite(m.rpmMilli) ||
    m.rpmMilli < 0
  )
    return { state: "unavailable", rpm: 0 };
  const age = now - Date.parse(m.observedAt);
  const ttl =
    typeof m.staleAfterSeconds === "number" && m.staleAfterSeconds > 0
      ? Math.min(120, m.staleAfterSeconds)
      : 30;
  if (!Number.isFinite(age) || age < -30000 || age > ttl * 1000)
    return { state: "unavailable", rpm: 0 };
  return {
    state: m.rpmMilli > 0 ? "running" : "sleeping",
    rpm: m.rpmMilli / 1000,
  };
}
/** @param {(status: WheelStatus) => void} onStatus */
export function watchStatus(onStatus) {
  let stopped = false;
  let busy = false;
  let controller = new AbortController();
  async function poll() {
    if (stopped || busy) return;
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(STATUS_URL, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Status unavailable");
      const status = parseStatus(await response.json());
      if (!stopped) onStatus(status);
    } catch {
      if (!stopped) onStatus({ state: "unavailable", rpm: 0 });
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }
  void poll();
  const timer = setInterval(poll, 10000);
  return () => {
    stopped = true;
    clearInterval(timer);
    controller.abort();
  };
}
