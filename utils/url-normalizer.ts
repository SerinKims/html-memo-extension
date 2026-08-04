const TRACKING_PARAMETER_NAMES = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
]);

export function isTrackingParameter(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return normalizedName.startsWith('utm_') || TRACKING_PARAMETER_NAMES.has(normalizedName);
}

export function normalizeUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError('올바른 웹페이지 URL을 입력해 주세요.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'file:') {
    throw new TypeError('http, https 또는 file 웹페이지 URL만 사용할 수 있습니다.');
  }

  url.username = '';
  url.password = '';
  url.hash = '';

  if (url.protocol === 'file:') {
    url.search = '';
    return url.toString();
  }

  const retainedParameters = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParameter(name))
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      const nameComparison = leftName.localeCompare(rightName);
      return nameComparison === 0 ? leftValue.localeCompare(rightValue) : nameComparison;
    });

  url.search = '';
  for (const [name, parameterValue] of retainedParameters) {
    url.searchParams.append(name, parameterValue);
  }

  return url.toString();
}

export function createPageKey(value: string): string {
  const normalizedUrl = normalizeUrl(value);
  let hash = 0xcbf29ce484222325n;

  for (const character of normalizedUrl) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `page-${hash.toString(16).padStart(16, '0')}`;
}
