/** Splits "1.2.3" into numbers; missing or non-numeric parts count as 0. */
function parts(version: string) {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

/** Negative when `a` is older than `b`, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string) {
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** True when the installed build is older than the oldest one the server supports. */
export function isUnsupported(current: string, minSupported: string) {
  return compareVersions(current, minSupported) < 0;
}

/** True when a newer build than the installed one has been published. */
export function updateAvailable(current: string, latest: string) {
  return compareVersions(current, latest) < 0;
}
