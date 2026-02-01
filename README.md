# Orchestrateur

MVP Electron/TypeScript qui embarque un navigateur unique (BrowserView) pour ouvrir des interfaces LLM (ChatGPT, Claude, Gemini, Perplexity, DeepSeek).

## Prerequis
- Windows 10+
- Node.js 20+

## Installation
```
npm install
```

## Lancer en dev
```
npm run dev
```

## Tests / Qualite
```
npm run lint
npm run typecheck
npm test
```

## Build Windows
```
npm run build
npm run dist
```
- `npm run dist` genere un portable + installateur via electron-builder.
- `npm run pack` genere un dossier non installe (test rapide).

## Configuration des providers
Le fichier est lu au demarrage depuis `config/providers.json`.
- En dev: `./config/providers.json`.
- En build: un dossier `config` a cote du `.exe` est prioritaire (copiable/modifiable).

Format (tableau JSON) :
```
[
  {
    "id": "chatgpt",
    "name": "ChatGPT",
    "url_home": "https://chatgpt.com/",
    "allowlist": ["chatgpt.com", "openai.com"],
    "userAgentOverride": "optionnel"
  }
]
```

## Regle de liste blanche (allowlist)
- Les domaines autorises sont compares au hostname.
- Les sous-domaines sont acceptes automatiquement (ex: `sub.example.com` si `example.com` est present).
- Des regex simples sont possibles via `regex:` (ex: `regex:^https://.+\\.trusted\\.ai/`).
- En mode permissif, tout est autorise mais un avertissement est affiche.

## Persistance
- `state.json` est stocke dans `%APPDATA%\\Orchestrateur\\state.json`.
- Il contient la liste des providers ouverts + le dernier provider actif.

## Securite Electron
- Pas de Node dans le contenu distant.
- `contextIsolation` + `sandbox` actifs.
- Navigation controlee par allowlist.