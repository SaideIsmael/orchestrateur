export type OrchestratorState = {
  openedProviders: string[];
  lastActiveProviderId: string | null;
};

export const defaultState: OrchestratorState = {
  openedProviders: [],
  lastActiveProviderId: null
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const sanitizeState = (value: unknown): OrchestratorState => {
  if (!value || typeof value !== 'object') {
    return { ...defaultState };
  }

  const record = value as Record<string, unknown>;
  const openedProvidersRaw = Array.isArray(record.openedProviders)
    ? record.openedProviders
    : [];
  const openedProviders = Array.from(
    new Set(openedProvidersRaw.filter(isNonEmptyString))
  );

  const lastActiveProviderId = isNonEmptyString(record.lastActiveProviderId)
    ? record.lastActiveProviderId
    : null;

  return {
    openedProviders,
    lastActiveProviderId
  };
};

export const addOpenedProvider = (
  state: OrchestratorState,
  providerId: string
): OrchestratorState => {
  if (!isNonEmptyString(providerId)) {
    return { ...state };
  }

  if (state.openedProviders.includes(providerId)) {
    return { ...state };
  }

  return {
    ...state,
    openedProviders: [...state.openedProviders, providerId]
  };
};

export const setLastActiveProvider = (
  state: OrchestratorState,
  providerId: string | null
): OrchestratorState => ({
  ...state,
  lastActiveProviderId: isNonEmptyString(providerId) ? providerId : null
});