export {};

declare global {
  interface Window {
    orchestrator: {
      ping: () => Promise<string>;
      getProviders: () => Promise<
        { id: string; name: string; url_home: string }[]
      >;
      getOpenedProviders: () => Promise<
        { id: string; name: string; url_home: string }[]
      >;
      openProvider: (providerId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
      setBrowserBounds: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void;
      navigateBack: () => Promise<void>;
      navigateForward: () => Promise<void>;
      reload: () => Promise<void>;
      getPermissiveMode: () => Promise<boolean | undefined>;
      setPermissiveMode: (enabled: boolean) => Promise<boolean | undefined>;
      getNavState: () => Promise<{
        canGoBack: boolean;
        canGoForward: boolean;
        url: string;
        title: string;
        providerId: string | null;
      } | undefined>;
      onNavState: (
        callback: (state: {
          canGoBack: boolean;
          canGoForward: boolean;
          url: string;
          title: string;
          providerId: string | null;
        }) => void
      ) => () => void;
      onNotification: (
        callback: (payload: { level: 'warning' | 'info'; message: string }) => void
      ) => () => void;
      onOpenedProviders: (
        callback: (providers: { id: string; name: string; url_home: string }[]) => void
      ) => () => void;
    };
  }
}
