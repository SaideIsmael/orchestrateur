const normalizePattern = (pattern: string) => pattern.trim();

const parseDomain = (pattern: string): string | null => {
  const cleaned = pattern.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  if (cleaned.includes('://')) {
    try {
      return new URL(cleaned).hostname;
    } catch {
      return null;
    }
  }

  return cleaned.replace(/^\*\./, '');
};

const isRegexPattern = (pattern: string): boolean => {
  const cleaned = pattern.trim();
  return cleaned.startsWith('regex:') || (cleaned.startsWith('/') && cleaned.endsWith('/') && cleaned.length > 2);
};

const buildRegex = (pattern: string): RegExp | null => {
  const cleaned = pattern.trim();
  if (cleaned.startsWith('regex:')) {
    const body = cleaned.slice('regex:'.length).trim();
    if (!body) {
      return null;
    }
    return new RegExp(body);
  }

  if (cleaned.startsWith('/') && cleaned.endsWith('/') && cleaned.length > 2) {
    const body = cleaned.slice(1, -1);
    return new RegExp(body);
  }

  return null;
};

export const allowNavigation = (targetUrl: string, allowlist: string[]): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();
  const urlString = parsed.toString();

  for (const entry of allowlist) {
    const pattern = normalizePattern(entry);
    if (!pattern) {
      continue;
    }

    if (isRegexPattern(pattern)) {
      const regex = buildRegex(pattern);
      if (regex?.test(urlString)) {
        return true;
      }
      continue;
    }

    const domain = parseDomain(pattern);
    if (!domain) {
      continue;
    }

    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }

  return false;
};