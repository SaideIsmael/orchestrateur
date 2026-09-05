import type { AppHealth } from '../shared/types';

export {};

declare global {
  /**
   * Toute methode invoquee via safeIpcHandle (ipc/utils.ts) peut renvoyer
   * cette forme au lieu de son resultat normal si le gestionnaire cote main
   * a leve une exception - meme quand rien dans l'implementation actuelle
   * ne le fait aujourd'hui. Le type doit refleter ce que le pont peut
   * reellement produire, pas seulement ce que le code produit a ce jour.
   */
  type IpcErrorResult = { ok: false; error: string };

  interface Window {
    orchestrator: {
      ping: () => Promise<string | IpcErrorResult>;
      getHealth: () => Promise<AppHealth | IpcErrorResult>;
      getProviders: () => Promise<
        { id: string; name: string; url_home: string }[] | IpcErrorResult
      >;
      getOpenedProviders: () => Promise<
        { id: string; name: string; url_home: string }[] | IpcErrorResult
      >;
      openProvider: (providerId: string) => Promise<{ ok: true } | IpcErrorResult>;
      setBrowserBounds: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void;
      navigateBack: () => Promise<void | IpcErrorResult>;
      navigateForward: () => Promise<void | IpcErrorResult>;
      reload: () => Promise<void | IpcErrorResult>;
      getPermissiveMode: () => Promise<boolean | undefined | IpcErrorResult>;
      setPermissiveMode: (enabled: boolean) => Promise<boolean | undefined | IpcErrorResult>;
      getNavState: () => Promise<{
        canGoBack: boolean;
        canGoForward: boolean;
        url: string;
        title: string;
        providerId: string | null;
      } | undefined | IpcErrorResult>;
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
