export type ProviderDefinition = {
  id: string;
  name: string;
  url_home: string;
  allowlist: string[];
  userAgentOverride?: string;
};

export type ProvidersConfigResult =
  | { ok: true; providers: ProviderDefinition[] }
  | { ok: false; errors: string[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export const parseProvidersJson = (json: string): ProvidersConfigResult => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON invalide: ${(error as Error).message}`]
    };
  }

  const list = Array.isArray(raw)
    ? raw
    : isPlainObject(raw) && Array.isArray(raw.providers)
      ? raw.providers
      : null;

  if (!list) {
    return {
      ok: false,
      errors: ['Le fichier doit contenir un tableau de fournisseurs.']
    };
  }

  const errors: string[] = [];
  const providers: ProviderDefinition[] = [];
  const ids = new Set<string>();

  list.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`Entree ${index + 1}: format invalide.`);
      return;
    }

    const id = entry.id;
    const name = entry.name;
    const url_home = entry.url_home;
    const allowlist = entry.allowlist;
    const userAgentOverride = entry.userAgentOverride;

    if (!isNonEmptyString(id)) {
      errors.push(`Entree ${index + 1}: "id" manquant ou invalide.`);
      return;
    }

    if (ids.has(id)) {
      errors.push(`Entree ${index + 1}: "id" duplique (${id}).`);
      return;
    }

    if (!isNonEmptyString(name)) {
      errors.push(`Entree ${index + 1}: "name" manquant ou invalide.`);
      return;
    }

    if (!isNonEmptyString(url_home) || !isValidUrl(url_home)) {
      errors.push(`Entree ${index + 1}: "url_home" invalide.`);
      return;
    }

    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      errors.push(`Entree ${index + 1}: "allowlist" doit contenir au moins un domaine.`);
      return;
    }

    const allowlistClean = allowlist.filter(isNonEmptyString);
    if (allowlistClean.length !== allowlist.length) {
      errors.push(`Entree ${index + 1}: "allowlist" contient des valeurs invalides.`);
      return;
    }

    if (userAgentOverride !== undefined && !isNonEmptyString(userAgentOverride)) {
      errors.push(`Entree ${index + 1}: "userAgentOverride" invalide.`);
      return;
    }

    ids.add(id);
    providers.push({
      id,
      name,
      url_home,
      allowlist: allowlistClean,
      userAgentOverride: userAgentOverride?.trim()
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, providers };
};