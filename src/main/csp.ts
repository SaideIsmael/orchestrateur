function parseCsp(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();

  policy.split(';').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return;
    }

    const [name, ...sources] = trimmed.split(/\s+/);
    directives.set(name.toLowerCase(), sources);
  });

  return directives;
}

/**
 * Fusionne la CSP de l'application avec celle déjà envoyée par le fournisseur,
 * directive par directive, au lieu de l'écraser. Sans cette fusion, un
 * fournisseur chargeant ses propres scripts/polices/images depuis un domaine
 * externe voit sa page cassée par la politique restrictive de l'application.
 */
export function mergeCsp(existingPolicy: string | undefined, ourPolicy: string): string {
  const ours = parseCsp(ourPolicy);

  if (!existingPolicy) {
    return ourPolicy;
  }

  const merged = parseCsp(existingPolicy);

  for (const [name, ourSources] of ours) {
    const theirSources = merged.get(name);
    if (!theirSources) {
      merged.set(name, ourSources);
      continue;
    }

    const combined = new Set([...theirSources, ...ourSources]);
    if (combined.size > 1) {
      combined.delete("'none'");
    }
    merged.set(name, [...combined]);
  }

  return [...merged.entries()]
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}
