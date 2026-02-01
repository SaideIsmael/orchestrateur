export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Orchestrateur</div>
        <div className="status">Session unique</div>
      </header>
      <main className="main">
        <section className="browser-shell">
          <div className="browser-placeholder">
            <h2>Zone Web</h2>
            <p>Le navigateur integre apparaitra ici.</p>
          </div>
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