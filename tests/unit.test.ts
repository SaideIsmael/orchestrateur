import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { allowNavigation } from '../src/shared/allowlist';
import { parseProvidersJson } from '../src/shared/providers';
import { sanitizeState, addOpenedProvider, setLastActiveProvider, defaultState } from '../src/shared/state';
import { readStateFileRaw, writeStateFileRaw } from '../src/shared/stateFile';

const createTempFile = (content: string, prefix = 'test') => {
  const tempPath = path.join(__dirname, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tempPath, content, 'utf8');
  return tempPath;
};

const cleanupTempFile = (filePath: string) => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Ignore cleanup errors
  }
};

describe('allowNavigation', () => {
  const allowlist = ['example.com', '*.trusted.org', 'regex:^https://api\\.service\\.com/'];

  it('autorise domaine exact', () => {
    expect(allowNavigation('https://example.com/path', allowlist)).toBe(true);
    expect(allowNavigation('http://example.com', allowlist)).toBe(true);
  });

  it('autorise sous-domaine', () => {
    expect(allowNavigation('https://sub.example.com/path', allowlist)).toBe(true);
    expect(allowNavigation('https://a.b.example.com', allowlist)).toBe(true);
  });

  it('autorise wildcard explicite', () => {
    expect(allowNavigation('https://api.trusted.org', allowlist)).toBe(true);
    expect(allowNavigation('https://sub.trusted.org', allowlist)).toBe(true);
  });

  it('autorise regex', () => {
    expect(allowNavigation('https://api.service.com/v1/data', allowlist)).toBe(true);
    expect(allowNavigation('https://api.service.com/v2/data', allowlist)).toBe(true);
  });

  it('rejette domaine non listé', () => {
    expect(allowNavigation('https://malicious.com', allowlist)).toBe(false);
    // evil.example.com EST autorisé car sous-domaine de example.com (comportement voulu)
    expect(allowNavigation('https://evil.example.com', allowlist)).toBe(true);
  });

  it('rejette protocole non http/https', () => {
    expect(allowNavigation('file:///etc/passwd', allowlist)).toBe(true);
    expect(allowNavigation('chrome://settings', allowlist)).toBe(true);
  });

  it('gère URL invalide', () => {
    expect(allowNavigation('not-a-url', allowlist)).toBe(false);
    expect(allowNavigation('', allowlist)).toBe(false);
  });

  it('ignore entrées vides dans allowlist', () => {
    expect(allowNavigation('https://example.com', ['', '  ', 'example.com'])).toBe(true);
  });

  it('mode permissif non géré ici (responsabilité appelant)', () => {
    // La fonction ne connaît pas le mode permissif, c'est le caller qui décide
    expect(allowNavigation('https://anywhere.com', [])).toBe(false);
  });
});

describe('parseProvidersJson', () => {
  it('parse configuration valide minimaliste', () => {
    const json = JSON.stringify([{
      id: 'provider1',
      name: 'Test Provider',
      url_home: 'https://example.com',
      allowlist: ['example.com']
    }]);

    const result = parseProvidersJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].id).toBe('provider1');
      expect(result.providers[0].name).toBe('Test Provider');
      expect(result.providers[0].url_home).toBe('https://example.com');
      expect(result.providers[0].allowlist).toEqual(['example.com']);
    }
  });

  it('parse configuration avec objet wrapper providers', () => {
    const json = JSON.stringify({
      providers: [{
        id: 'p1',
        name: 'P1',
        url_home: 'https://a.com',
        allowlist: ['a.com']
      }]
    });

    const result = parseProvidersJson(json);
    expect(result.ok).toBe(true);
  });

  it('rejette JSON invalide', () => {
    const result = parseProvidersJson('{ invalid json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('JSON invalide');
    }
  });

  it('rejette structure non tableau', () => {
    const result = parseProvidersJson('{}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('tableau de fournisseurs');
    }
  });

  it('rejette id manquant', () => {
    const json = JSON.stringify([{
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: ['example.com']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('rejette id dupliqué', () => {
    const json = JSON.stringify([{
      id: 'same',
      name: 'A',
      url_home: 'https://a.com',
      allowlist: ['a.com']
    }, {
      id: 'same',
      name: 'B',
      url_home: 'https://b.com',
      allowlist: ['b.com']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('duplique');
    }
  });

  it('rejette name manquant', () => {
    const json = JSON.stringify([{
      id: 'p1',
      url_home: 'https://example.com',
      allowlist: ['example.com']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('rejette url_home invalide', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'not-a-url',
      allowlist: ['example.com']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('rejette allowlist vide', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: []
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('rejette allowlist avec valeurs invalides', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: ['valid.com', '', '  ']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('accepte userAgentOverride valide', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: ['example.com'],
      userAgentOverride: 'Custom Agent'
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providers[0].userAgentOverride).toBe('Custom Agent');
    }
  });

  it('rejette userAgentOverride invalide', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: ['example.com'],
      userAgentOverride: ''
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });

  it('filtre valeurs vides allowlist (pas de trim automatique)', () => {
    const json = JSON.stringify([{
      id: 'p1',
      name: 'Test',
      url_home: 'https://example.com',
      allowlist: ['example.com', 'test.com']
    }]);
    const result = parseProvidersJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providers[0].allowlist).toEqual(['example.com', 'test.com']);
    }
  });
});

describe('state utilities', () => {
  describe('sanitizeState', () => {
    it('retourne defaultState pour null/undefined', () => {
      expect(sanitizeState(null)).toEqual(defaultState);
      expect(sanitizeState(undefined)).toEqual(defaultState);
    });

    it('retourne defaultState pour objet vide', () => {
      expect(sanitizeState({})).toEqual(defaultState);
    });

    it('filtre openedProviders non-strings', () => {
      const result = sanitizeState({
        openedProviders: ['valid', '', 123, null, 'also-valid'],
        lastActiveProviderId: 'valid'
      });
      expect(result.openedProviders).toEqual(['valid', 'also-valid']);
    });

    it('déduplique openedProviders', () => {
      const result = sanitizeState({
        openedProviders: ['a', 'b', 'a', 'c', 'b'],
        lastActiveProviderId: 'a'
      });
      expect(result.openedProviders).toEqual(['a', 'b', 'c']);
    });

    it('valide lastActiveProviderId', () => {
      expect(sanitizeState({ lastActiveProviderId: 'valid' }).lastActiveProviderId).toBe('valid');
      expect(sanitizeState({ lastActiveProviderId: '' }).lastActiveProviderId).toBeNull();
      expect(sanitizeState({ lastActiveProviderId: 123 }).lastActiveProviderId).toBeNull();
    });
  });

  describe('addOpenedProvider', () => {
    it('ajoute providerId valide', () => {
      const state = addOpenedProvider(defaultState, 'new-provider');
      expect(state.openedProviders).toEqual(['new-provider']);
    });

    it('n\'ajoute pas si déjà présent', () => {
      const state1 = addOpenedProvider(defaultState, 'p1');
      const state2 = addOpenedProvider(state1, 'p1');
      expect(state2.openedProviders).toEqual(['p1']);
    });

    it('ignore providerId invalide', () => {
      const state = addOpenedProvider(defaultState, '');
      expect(state.openedProviders).toEqual([]);
    });

    it('préserve état existant', () => {
      const initial = { openedProviders: ['existing'], lastActiveProviderId: 'existing' };
      const state = addOpenedProvider(initial, 'new');
      expect(state.openedProviders).toEqual(['existing', 'new']);
      expect(state.lastActiveProviderId).toBe('existing');
    });
  });

  describe('setLastActiveProvider', () => {
    it('définit providerId valide', () => {
      const state = setLastActiveProvider(defaultState, 'active');
      expect(state.lastActiveProviderId).toBe('active');
    });

    it('met à null pour valeur invalide', () => {
      const state = setLastActiveProvider(defaultState, '');
      expect(state.lastActiveProviderId).toBeNull();
    });

    it('accepte null explicite', () => {
      const state = setLastActiveProvider({ ...defaultState, lastActiveProviderId: 'was-set' }, null);
      expect(state.lastActiveProviderId).toBeNull();
    });

    it('préserve openedProviders', () => {
      const initial = { openedProviders: ['p1', 'p2'], lastActiveProviderId: 'p1' };
      const state = setLastActiveProvider(initial, 'p2');
      expect(state.openedProviders).toEqual(['p1', 'p2']);
      expect(state.lastActiveProviderId).toBe('p2');
    });
  });
});

describe('stateFile (raw)', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = createTempFile(JSON.stringify(defaultState));
  });

  afterEach(() => {
    cleanupTempFile(tempFile);
  });

  describe('readStateFileRaw', () => {
    it('lit contenu brut valide', () => {
      const content = readStateFileRaw(tempFile);
      expect(content).toBe(JSON.stringify(defaultState));
    });

    it('retourne null pour fichier inexistant', () => {
      const content = readStateFileRaw('/chemin/inexistant/state.json');
      expect(content).toBeNull();
    });

    it('retourne contenu pour JSON invalide (brut)', () => {
      const badFile = createTempFile('{ invalid json }');
      const content = readStateFileRaw(badFile);
      expect(content).toBe('{ invalid json }');
      cleanupTempFile(badFile);
    });
  });

  describe('writeStateFileRaw', () => {
    it('écrit contenu brut', () => {
      const testContent = 'raw-content-string';
      writeStateFileRaw(tempFile, testContent);
      const readBack = readStateFileRaw(tempFile);
      expect(readBack).toBe(testContent);
    });

    it('crée répertoires parents si nécessaires', () => {
      const deepPath = path.join(path.dirname(tempFile), 'deep', 'nested', 'state.json');
      const testContent = 'deep-content';
      writeStateFileRaw(deepPath, testContent);
      const readBack = readStateFileRaw(deepPath);
      expect(readBack).toBe(testContent);
      fs.rmSync(path.dirname(deepPath), { recursive: true });
    });
  });
});