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

const isHardDeny = (sources: string[]) => sources.length === 1 && sources[0] === "'none'";

/**
 * Fusionne la CSP de l'application avec celle déjà envoyée par le fournisseur,
 * directive par directive, au lieu de l'écraser. Sans cette fusion, un
 * fournisseur chargeant ses propres scripts/polices/images depuis un domaine
 * externe voit sa page cassée par la politique restrictive de l'application.
 *
 * Exception volontaire : une directive que l'application fixe a 'none' seul
 * (interdiction stricte, ex. object-src, frame-src) est un plancher de
 * securite non negociable. Le fournisseur ne peut jamais la desserrer en
 * envoyant sa propre valeur pour cette meme directive - sans cette exception,
 * l'union normale laisserait n'importe quel contenu tiers annuler un verrou
 * que l'application a pose intentionnellement (revue de code du 5 septembre
 * 2026, confirme par tests/csp.test.ts).
 */
export function mergeCsp(existingPolicy: string | undefined, ourPolicy: string): string {
  const ours = parseCsp(ourPolicy);

  if (!existingPolicy) {
    return ourPolicy;
  }

  const merged = parseCsp(existingPolicy);

  for (const [name, ourSources] of ours) {
    if (isHardDeny(ourSources)) {
      merged.set(name, ourSources);
      continue;
    }

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
