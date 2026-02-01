import { useEffect, useRef, useState } from 'react';

type ProviderSummary = { id: string; name: string; url_home: string };
type NavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  url: string;
  title: string;
  providerId: string | null;
};

export default function App() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [navState, setNavState] = useState<NavState>({
    canGoBack: false,
    canGoForward: false,
    url: '',
    title: '',
    providerId: null
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const browserRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    window.orchestrator.getProviders().then((list) => {
      if (mounted) {
        setProviders(list);
      }
    });

    window.orchestrator.getNavState().then((state) => {
      if (state) {
        setNavState(state);
      }
    });

    const unsubscribe = window.orchestrator.onNavState((state) => {
      setNavState(state);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!browserRef.current) {
      return;
    }

    const element = browserRef.current;
    const updateBounds = () => {
      const rect = element.getBoundingClientRect();
      window.orchestrator.setBrowserBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);
    window.addEventListener('resize', updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  const handleOpenProvider = async (providerId: string) => {
    const result = await window.orchestrator.openProvider(providerId);
    if ('ok' in result && !result.ok) {
      setErrorMessage(result.error);
    } else {
      setErrorMessage(null);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Orchestrateur</div>
        <div className="status">Session unique</div>
      </header>
      <div className="nav-bar">
        <div className="nav-controls">
          <button
            type="button"
            disabled={!navState.canGoBack}
            onClick={() => window.orchestrator.navigateBack()}
          >
            ←
          </button>
          <button
            type="button"
            disabled={!navState.canGoForward}
            onClick={() => window.orchestrator.navigateForward()}
          >
            →
          </button>
          <button type="button" onClick={() => window.orchestrator.reload()}>
            ⟳
          </button>
        </div>
        <div className="provider-list">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={
                navState.providerId === provider.id ? 'provider active' : 'provider'
              }
              onClick={() => handleOpenProvider(provider.id)}
            >
              {provider.name}
            </button>
          ))}
        </div>
        <div className="nav-url" title={navState.url}>
          {navState.url || 'Aucun site charge'}
        </div>
      </div>
      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      <main className="main">
        <section className="browser-shell">
          <div className="browser-view" ref={browserRef} />
        </section>
        <aside className="orchestrator">
          <h2>Orchestrateur</h2>
          <div className="field">
            <label>Question</label>
            <textarea placeholder="Saisir la question..." rows={6} />
          </div>
          <div className="actions">
            <button type="button">Copier prompt</button>
          </div>
          <div className="field">
            <label>Reponse collee</label>
            <textarea placeholder="Coller la reponse ici..." rows={8} />
          </div>
        </aside>
      </main>
    </div>
  );
}
