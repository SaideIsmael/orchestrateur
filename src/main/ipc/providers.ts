import { safeIpcHandle } from './utils';
import type { ProviderDefinition } from '../../shared/providers';
import type { BrowserViewManager } from '../browserViewManager';
import type { OrchestratorState } from '../../shared/state';
import { addOpenedProvider, setLastActiveProvider } from '../../shared/state';

export function registerProvidersIpc(
  getProvidersCache: () => ProviderDefinition[],
  getViewManager: () => BrowserViewManager | null,
  getOrchestratorState: () => OrchestratorState,
  setOrchestratorState: (state: OrchestratorState) => void,
  saveState: (state: OrchestratorState) => void,
  broadcastOpenedProviders: () => void
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
    saveState(finalState);
    broadcastOpenedProviders();

    return { ok: true } as const;
  });
}