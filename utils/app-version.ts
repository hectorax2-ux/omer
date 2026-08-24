export function compareAppVersions(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }

  return 0;
}

export function isAppVersionOlder(installedVersion: string, targetVersion: string) {
  return compareAppVersions(installedVersion, targetVersion) < 0;
}

function versionParts(version: string) {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part.replace(/\D.*$/, ""), 10))
    .map((part) => Number.isFinite(part) && part >= 0 ? part : 0);
}
