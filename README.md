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

## Tests de bout en bout (Playwright)
```
npm run test:e2e
```
Lance un vrai build de production puis 4 scenarios (`tests-e2e/`)
contre l'application reelle (Playwright + `_electron`), sans toucher
a Internet ni a `config/providers.json` : navigation valide, blocage
hors liste blanche, restauration d'etat apres redemarrage, navigation
au clavier seul. Aucun raccourci clavier personnalise n'existe dans
l'app - le scenario clavier verifie l'operabilite native des boutons
HTML (Tab + Entree), pas un systeme de raccourcis a construire.

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

Ce fichier reste volontairement en clair, contrairement a `state.enc`
(voir Persistance ci-dessus). Il ne contient que des URL publiques de
fournisseurs IA et leurs listes de domaines autorises, aucune donnee
confidentielle - le chiffrer ferait perdre la possibilite de l'editer
directement a la main, sans benefice de securite reel en echange
(decision prise le 5 septembre 2026, ne pas la reproposer sans
element nouveau justifiant un changement de contenu sensible dans ce
fichier).

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

## Signature de code (obligatoire avant toute distribution)
`build.win.forceCodeSigning` est active dans `package.json` : `npm run
release` echoue explicitement tant qu'aucun certificat valide n'est
configure, plutot que de publier silencieusement un `.exe` non signe
(ce qui s'est produit pour les versions 0.1.0 et 0.1.1).

Etapes une fois le certificat de signature de code obtenu (OV ou IV,
avec jeton materiel certifie FIPS - obligatoire depuis 2023, meme pour
un certificat OV) :

1. Installer le pilote du fournisseur du jeton et brancher le jeton.
   Le certificat s'installe alors automatiquement dans le magasin
   Windows (`Cert:\CurrentUser\My` ou `Cert:\LocalMachine\My`).
2. Retrouver son empreinte SHA1 :
   ```powershell
   Get-ChildItem Cert:\CurrentUser\My | Format-List Subject,Thumbprint
   ```
3. Ajouter dans `package.json`, sous `build.win` :
   ```json
   "certificateSha1": "EMPREINTE_SHA1_ICI"
   ```
4. Relancer `npm run release`. Le jeton materiel demande generalement
   la saisie d'un code PIN au moment de la signature (invite Windows,
   pas dans le terminal).

Ne jamais commiter de fichier `.pfx` ni de mot de passe de certificat
dans ce depot : un certificat sur jeton materiel n'est de toute facon
pas exportable en `.pfx`, c'est precisement l'interet de ce type de
support.