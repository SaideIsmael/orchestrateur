import { safeIpcHandle } from './utils';
import type { ProviderDefinition } from '../../shared/providers';
import type { BrowserViewManager } from '../browserViewManager';
import type { OrchestratorState } from '../../shared/state';
import { addOpenedProvider, setLastActiveProvider } from '../../shared/state';
import { logger } from '../log';

export function registerProvidersIpc(
  getProvidersCache: () => ProviderDefinition[],
  getViewManager: () => BrowserViewManager | null,
  getOrchestratorState: () => OrchestratorState,
  setOrchestratorState: (state: OrchestratorState) => void,
  saveState: (state: OrchestratorState) => void,
  broadcastOpenedProviders: () => void,
  notify: (message: string) => void
) {
  safeIpcHandle('providers:list', () =>
    getProvidersCache().map(({ id, name, url_home }) => ({ id, name, url_home }))
  );

  safeIpcHandle('providers:opened', () => {
    const state = getOrchestratorState();
    const cache = getProvidersCache();
    return state.openedProviders
      .map((id) => cache.find((provider) => provider.id === id))
      .filter((provider): provider is ProviderDefinition => Boolean(provider))
      .map(({ id, name, url_home }) => ({ id, name, url_home }));
  });

  safeIpcHandle('provider:open', (_event, providerId: string) => {
    const provider = getProvidersCache().find((item) => item.id === providerId);
    const viewManager = getViewManager();

    if (!provider || !viewManager) {
      return { ok: false, error: 'Provider introuvable.' } as const;
    }

    viewManager.openProvider(provider);

    const newState = addOpenedProvider(getOrchestratorState(), provider.id);
    const finalState = setLastActiveProvider(newState, provider.id);

    setOrchestratorState(finalState);

    // La vue s'est deja ouverte avec succes a ce stade : un echec de
    // persistance ne doit pas etre rapporte comme un echec d'ouverture,
    // mais il ne doit pas non plus disparaitre en silence (voir crypto.ts,
    // encryptState() peut echouer si safeStorage devient indisponible).
    try {
      saveState(finalState);
    } catch (error) {
      logger.state.error('Echec de sauvegarde apres ouverture du provider:', error);
      notify('Fournisseur ouvert, mais son etat n\'a pas pu etre enregistre.');
    }

    broadcastOpenedProviders();

    return { ok: true } as const;
  });
}