# Modelisation de menaces (STRIDE) — Orchestrateur

Redige le 5 septembre 2026, sur la base du code effectivement en place
a cette date (voir historique git pour l'evolution). Chaque mitigation
citee renvoie a un fichier reel, pas a une intention. Les risques
residuels sont assumes explicitement, pas dissimules.

Le registre de traitement au sens de la loi burkinabe n°010-2004/AN
(modifiee par la loi n°001-2021/AN, sous controle de la CIL) est un
document distinct de celui-ci, hors perimetre : il exige une reponse
operationnelle que seul l'utilisateur peut donner (quelles donnees
personnelles ou judiciaires transitent reellement par les fournisseurs
IA via cette application, et une declaration CIL est-elle necessaire).
Voir la section "Ce que ce document ne couvre pas" en fin de fichier.

---

## 1. Actifs a proteger

| Actif | Ou | Sensibilite |
|---|---|---|
| `config/providers.json` | poste utilisateur | Faible — URL publiques de fournisseurs IA |
| `state.enc` + `state.key` | `%APPDATA%\orchestrateur\` | Faible — liste des fournisseurs ouverts, pas le contenu des echanges |
| Sessions par fournisseur (cookies, jetons de connexion) | `%APPDATA%\orchestrateur\Partitions\orchestrateur%3A<id>\` | **Elevee** — permet l'usurpation d'une session deja authentifiee (ChatGPT, Claude, etc.) |
| Sauvegardes | `%APPDATA%\orchestrateur\backups\` | Faible — meme contenu que state.enc |
| Journaux | `%APPDATA%\orchestrateur\logs\main.log` | Faible a moyenne — URL de navigation et horodatages, pas le contenu des echanges |
| Jeton GitHub (GH_TOKEN) | poste du mainteneur, jamais dans le depot | **Elevee** — controle total de la publication de mises a jour |
| Cle privee du certificat de signature (a venir) | jeton materiel FIPS externe | **Elevee** — meme portee que GH_TOKEN pour la confiance utilisateur |
| Code source et pipeline de build | depot GitHub public | Moyenne — integrite du logiciel distribue |

## 2. Frontieres de confiance

```
[Contenu distant non fiable]              [Zone de confiance app]           [Zone externe]
 chatgpt.com, claude.ai, etc.                                                GitHub (update, releases)
        |  B2                                     |  B3
        v                                          v
 WebContentsView (sandbox,           <---IPC--->  Main process  <---HTTPS--->  Releases GitHub
 session isolee par fournisseur)        B1          (Electron)
                                          ^
                                          | preload/contextBridge
                                          v
                                   Renderer (UI React,
                                   contextIsolation+sandbox)

                                          |  B4
                                          v
                          safeStorage (DPAPI) + systeme de fichiers Windows
                                          |  B5
                                          v
                              Compte Windows de l'utilisateur (frontiere ultime)
```

- **B1** — Renderer (UI) <-> Main process, via IPC/preload.
- **B2** — Main process <-> contenu web distant non fiable (fournisseurs IA), via WebContentsView.
- **B3** — Poste local <-> GitHub (verification et telechargement des mises a jour, publication des releases).
- **B4** — Main process <-> secrets locaux (safeStorage/DPAPI, fichiers chiffres).
- **B5** — Compte Windows de l'utilisateur <-> tout le reste (frontiere que l'application ne controle pas).

---

## 3. Analyse par frontiere

### B2 — Contenu des fournisseurs IA (la plus grande surface non fiable)

| STRIDE | Menace | Mitigation reelle | Statut |
|---|---|---|---|
| Spoofing | Une page compromise usurpe un autre fournisseur ou l'UI de l'app | Partition de session dediee par fournisseur (`persist:orchestrateur:<id>`, `browserViewManager.ts:54`), navigation limitee par `allowlist` (`allowNavigation`, `src/shared/allowlist.ts`) | Couvert |
| Tampering | La page tente de modifier l'etat de l'app ou d'autres sessions | `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true` par vue (`browserViewManager.ts:63-72`), CSP fusionnee par session (`mergeCsp`, `csp.ts`) | Couvert |
| Repudiation | Aucune action du fournisseur n'est journalisee cote app | N/A — pas d'exigence d'audit sur du contenu tiers non maitrise | Accepte |
| Information Disclosure | **Vol des cookies/jetons de session** en cas d'acces au poste ou de copie du profil Windows | Isolation par partition (empeche la fuite d'un fournisseur vers un autre) mais **aucun chiffrement au repos** de ces donnees, contrairement a `state.enc` | **Risque residuel — non couvert** |
| Denial of Service | Une page figee bloque une vue sans faire planter l'app | Isolation multi-processus Chromium (une vue figee ne bloque pas les autres) ; aucune detection/relance automatique d'une vue non reactive | Partiellement couvert |
| Elevation of Privilege | Une popup ou redirection tente d'echapper au sandbox | `setWindowOpenHandler` revalide systematiquement l'URL contre l'allowlist avant tout `loadURL`, refuse toute fenetre native (`browserViewManager.ts:80-92`) | Couvert |

**Action recommandee** : chiffrer ou au minimum isoler plus strictement le contenu de `Partitions/` n'est pas realiste (ce sont des formats internes Chromium, pas des fichiers applicatifs). La mitigation pragmatique est documentaire : signaler dans le README/runbook qu'un vol du profil Windows expose les sessions IA actives, au meme titre qu'un navigateur classique — ce n'est pas une regression specifique a Orchestrateur, mais ce n'etait pas non plus explicite jusqu'ici.

### B1 — IPC main/renderer

| STRIDE | Menace | Mitigation reelle | Statut |
|---|---|---|---|
| Spoofing | Un renderer compromis emet de faux appels IPC | Renderer ne charge jamais de contenu distant (uniquement `dist/renderer/index.html` local) | Couvert (depend de l'integrite du build) |
| Tampering | Entrees IPC malformees | `safeIpcHandle`/`safeIpcOn` capturent les exceptions (`ipc/utils.ts`), typage TypeScript a la compilation, pas de validation de schema a l'execution | Partiellement couvert |
| Information Disclosure | Une reponse IPC exposerait plus que necessaire | Chaque handler ne retourne que les champs utiles (`id, name, url_home`, jamais d'objet interne complet) | Couvert |
| Denial of Service | Appels IPC repetes en boucle | Aucune limitation de frequence sur les canaux | Non couvert, risque faible |
| Elevation of Privilege | Le renderer atteindrait Node/API systeme directement | `contextBridge.exposeInMainWorld` expose uniquement les fonctions definies dans `preload.ts`, aucune passerelle generique | Couvert |

### B3 — Canal de mise a jour et publication (GitHub)

| STRIDE | Menace | Mitigation reelle | Statut |
|---|---|---|---|
| Spoofing | Publication d'une fausse mise a jour | Necessite le jeton GH_TOKEN ou l'acces au compte GitHub (deja identifie comme incident possible, voir RUNBOOK.md) | Partiellement couvert |
| Tampering | Alteration d'un binaire en transit | HTTPS de bout en bout (github.com, release-assets.githubusercontent.com) | Couvert |
| Repudiation | Publication anonyme | Chaque release est associee au compte GitHub authentifie qui l'a creee | Couvert |
| Information Disclosure | N/A | Depot public, verifie sans donnee sensible dans l'historique | Couvert |
| Denial of Service | GitHub inaccessible | Erreur interceptee et journalisee (`main.ts`, `setupAutoUpdater`), l'app continue de fonctionner sans mise a jour | Couvert |
| Elevation of Privilege | Une mise a jour malveillante s'executerait avec les droits de l'utilisateur courant | Installation `perMachine:false`, memes droits que l'utilisateur deja connecte — pas d'elevation au-dela de ce qu'un attaquant aurait deja obtenu | Couvert (pas d'elevation, mais execution de code reste possible) |

**Risque residuel majeur, verifie sur le code reel d'electron-updater** :
`NsisUpdater.js` ne verifie la signature Authenticode d'une mise a
jour que si `publisherName` est renseigne dans `app-update.yml`, ce
qui n'arrive que si l'application a ete signee au moment du build
(`if (publisherName == null) return null;` — verification simplement
sautee, sans avertissement). **Aucune release publiee a ce jour
(v0.1.0, v0.1.1) n'est signee** (voir README, section Signature de
code) : la verification de signature de la chaine de mise a jour est
donc actuellement inactive. Quiconque controle le jeton de publication
peut aujourd'hui pousser un code arbitraire vers tous les postes
installes, sans aucun garde-fou technique de ce cote. Ce risque se
resorbe automatiquement, sans changement de code, des qu'un
certificat de signature reel sera configure (deja trace comme action
prioritaire).

### B4 — Secrets locaux et chiffrement au repos

| STRIDE | Menace | Mitigation reelle | Statut |
|---|---|---|---|
| Tampering | Suppression/alteration de `state.enc` | Sauvegardes quotidiennes automatiques (`backupStore.ts`), integrite verifiee par tag d'authentification AES-GCM (`crypto.ts`) — une alteration fait echouer le dechiffrement plutot que de renvoyer des donnees fausses | Couvert |
| Information Disclosure | Lecture de `state.enc` sans autorisation | Chiffrement AES-256-GCM avec cle enveloppee par safeStorage/DPAPI (`crypto.ts`) — corrige cette session (voir commit a56a2ff) | Couvert |
| Information Disclosure | Contenu des journaux | URL de navigation et horodatages en clair (`log.ts`), rotation a 5 Mo, pas de contenu d'echange avec un fournisseur | Risque mineur accepte |
| Elevation of Privilege | N/A | La cle depend entierement de la session Windows de l'utilisateur, aucune elevation supplementaire possible via ce canal | Couvert |

### B5 — Compte Windows de l'utilisateur

Frontiere que l'application ne peut pas renforcer elle-meme : toute
personne connectee au meme compte Windows a acces a l'integralite des
donnees d'Orchestrateur (etat, sessions, sauvegardes, journaux). C'est
une hypothese de securite assumee (coherente avec un usage mono-poste,
mono-utilisateur), pas une lacune de l'application — mais elle merite
d'etre dite explicitement : la securite d'Orchestrateur depend
entierement de celle du compte Windows (mot de passe, verrouillage de
session, chiffrement de disque BitLocker si le poste est mobile).

---

## 4. Synthese des risques residuels (par ordre de priorite)

1. **Verification de signature des mises a jour inactive** (B3) — se
   resorbe automatiquement avec l'obtention du certificat de signature
   deja en cours. Aucune action de code necessaire.
2. **Sessions de fournisseurs IA non chiffrees au repos** (B2) — pas
   de correctif technique realiste sans casser le fonctionnement des
   fournisseurs eux-memes ; a documenter clairement pour l'utilisateur
   plutot qu'a "corriger".
3. **Frontiere B5 (compte Windows)** — depend entierement de
   l'hygiene de securite du poste, hors de portee du logiciel.
4. **Absence de validation de schema a l'execution sur les entrees
   IPC** (B1) — risque faible compte tenu du fait que seul le renderer
   local (non attaquable directement) emet ces appels, mais reste un
   axe de durcissement futur si le perimetre du renderer s'etend.

## 5. Ce que ce document ne couvre pas

Le registre de traitement au sens de la loi n°010-2004/AN necessite
une reponse que seul l'utilisateur peut apporter : quelles informations
personnelles ou judiciaires sont effectivement saisies dans les
fournisseurs IA via cette application, et si une declaration aupres de
la CIL est requise a ce titre. Orchestrateur lui-meme ne stocke, ne
transmet ni ne journalise le contenu de ces echanges — il ne fait que
faciliter l'acces a des services tiers dont c'est, eux, la politique de
confidentialite propre qui s'applique. Ce document technique ne se
substitue pas a cette analyse d'usage, qui reste a mener separement.
