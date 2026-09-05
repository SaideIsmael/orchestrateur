import { describe, expect, it } from 'vitest';
import { mergeCsp } from '../src/main/csp';

const APP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

describe('mergeCsp', () => {
  it('utilise la politique de l\'application quand le fournisseur n\'en envoie aucune', () => {
    expect(mergeCsp(undefined, APP_POLICY)).toBe(APP_POLICY);
  });

  it('conserve les sources du fournisseur au lieu de les écraser', () => {
    const providerPolicy = "script-src 'self' https://cdn.fournisseur.example";

    const merged = mergeCsp(providerPolicy, APP_POLICY);

    expect(merged).toContain('https://cdn.fournisseur.example');
    expect(merged).toContain("'self'");
  });

  it('conserve une directive présente seulement chez le fournisseur', () => {
    const providerPolicy = "upgrade-insecure-requests";

    const merged = mergeCsp(providerPolicy, APP_POLICY);

    expect(merged).toContain('upgrade-insecure-requests');
  });

  it("un fournisseur ne peut pas desserrer un 'none' fixe par l'application", () => {
    const providerPolicy = "frame-src https://widget.fournisseur.example";

    const merged = mergeCsp(providerPolicy, APP_POLICY);

    const frameSrc = merged
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('frame-src'));

    // frame-src 'none' est un verrou volontaire de l'application (voir
    // browserViewManager.ts) : un fournisseur ne doit jamais pouvoir
    // l'annuler en declarant sa propre valeur pour cette directive.
    expect(frameSrc).toBe("frame-src 'none'");
  });

  it("garde 'none' quand aucune source réelle ne s'y oppose", () => {
    const providerPolicy = "object-src 'none'";

    const merged = mergeCsp(providerPolicy, APP_POLICY);

    const objectSrc = merged
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('object-src'));

    expect(objectSrc).toBe("object-src 'none'");
  });

  it("un fournisseur peut toujours etendre une directive qui n'est pas un verrou strict", () => {
    const providerPolicy = "img-src https://cdn.fournisseur.example";

    const merged = mergeCsp(providerPolicy, APP_POLICY);

    const imgSrc = merged
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('img-src'));

    expect(imgSrc).toContain('https://cdn.fournisseur.example');
    expect(imgSrc).toContain("'self'");
  });
});
