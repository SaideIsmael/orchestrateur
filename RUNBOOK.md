# Runbook incident — Orchestrateur

Document destine a l'utilisateur de l'application (ou a toute personne
l'assistant a distance) en cas de probleme reel. Chaque procedure
decrite ici a ete testee sur le code effectivement en place a la date
de redaction (5 septembre 2026), pas redigee de memoire.

## Avant de commencer : ouvrir le journal et le diagnostic integre

Deux outils suffisent a diagnostiquer la plupart des incidents.

### Le journal (fichier texte)

Toujours consultable, meme si l'application ne s'affiche pas :

```
%APPDATA%\orchestrateur\logs\main.log
```

Ouvrir ce chemin dans l'explorateur Windows (copier-coller dans la
barre d'adresse), ou avec le Bloc-notes. Les lignes les plus recentes
sont en bas du fichier.

### Le diagnostic integre (app:health)

Si l'application s'affiche mais se comporte anormalement, un rapport
d'etat detaille est consultable directement :

1. Fermer l'application si elle est ouverte.
2. Ouvrir une invite de commandes (PowerShell) et taper :
   ```powershell
   $env:ORCH_DEVTOOLS = "1"
   & "$env:LOCALAPPDATA\Programs\orchestrateur\Orchestrateur.exe"
   ```
3. Une fenetre supplementaire "DevTools" s'ouvre a cote de
   l'application. Cliquer sur l'onglet "Console" dans cette fenetre.
4. Taper puis valider :
   ```js
   await window.orchestrator.getHealth()
   ```
5. Le resultat affiche indique : version de l'app, temps de
   fonctionnement, validite de `config/providers.json`, sante reelle
   du fichier d'etat chiffre (`state.ok`), et le fournisseur actif.

`state.ok: false` signale un probleme de lecture de l'etat chiffre :
voir l'incident "Les fournisseurs ouverts ont disparu" ci-dessous.

---

## Incident : l'application ne demarre pas / ecran blanc

**Symptomes** : double-clic sur l'icone, rien ne s'affiche, ou une
fenetre vide reste bloquee.

**Diagnostic** :
1. Consulter `main.log` (voir ci-dessus) — chercher une ligne
   `[error]` proche de l'heure du lancement.
2. Verifier que le dossier d'installation existe bien :
   `%LOCALAPPDATA%\Programs\orchestrateur\Orchestrateur.exe`.

**Resolution** :
- Si le fichier `.exe` est absent ou le dossier vide : reinstaller
  via le dernier installeur telecharge depuis
  https://github.com/SaideIsmael/orchestrateur/releases (fichier
  `Orchestrateur-Setup-<version>.exe`).
- Si le journal montre une erreur de chargement du renderer
  (`Failed to load renderer`) : le fichier `dist/renderer/index.html`
  est manquant ou corrompu dans l'installation — reinstaller.

---

## Incident : ecran "Configuration providers.json invalide"

**Symptomes** : l'application affiche un ecran sombre avec ce titre
et une liste d'erreurs, au lieu de l'interface normale.

**Cause reelle** (verifiee dans `src/main/providersStore.ts` et
`src/main/main.ts`) : le fichier `config/providers.json` (a cote de
l'executable) contient une erreur de syntaxe JSON ou un champ
obligatoire manquant (`id`, `name`, `url_home`, `allowlist`).

**Resolution** :
1. L'ecran d'erreur indique le chemin exact du fichier fautif et le
   detail de chaque erreur.
2. Ouvrir ce fichier avec le Bloc-notes, corriger la syntaxe (virgule
   manquante, guillemets non fermes, etc.) ou completer le champ
   manquant.
3. Fermer completement l'application (elle ne se recharge pas toute
   seule) et la relancer.
4. En cas de doute sur le format attendu, voir la section
   "Configuration des providers" du [README](README.md).

---

## Incident : les fournisseurs ouverts ont disparu apres un redemarrage

**Symptomes** : la liste "Opened Providers" est vide alors qu'un ou
plusieurs fournisseurs etaient ouverts avant de fermer l'application.

**Diagnostic** : suivre la procedure `app:health` ci-dessus. Si
`state.ok` vaut `false`, le fichier d'etat chiffre n'a pas pu etre lu
(cle de dechiffrement introuvable ou fichier corrompu — voir
`src/main/crypto.ts`).

**Resolution — restaurer depuis une sauvegarde automatique** :
1. Fermer l'application.
2. Ouvrir `%APPDATA%\orchestrateur\backups\` — un sous-dossier existe
   par jour ou une sauvegarde a ete faite (le nom du dossier est
   l'horodatage, le plus recent en dernier par ordre alphabetique).
3. Choisir le dossier le plus recent utilisable, y copier ses deux
   fichiers `state.enc` et `state.key`.
4. Coller ces deux fichiers dans `%APPDATA%\orchestrateur\` en
   ecrasant les fichiers existants (pas dans le sous-dossier
   `backups`).
5. Relancer l'application.

**Limite a connaitre** : une sauvegarde ne se restaure que sur le
meme compte Windows que celui qui l'a creee (voir README, section
Persistance). Si l'incident survient apres une reinstallation de
Windows ou sur un autre poste, la sauvegarde sera elle aussi
illisible — il n'existe pas de parade a ce jour, seule une
reinitialisation (etat vide) est possible.

---

## Incident : un fournisseur ne s'ouvre pas / "Navigation bloquee"

**Symptomes** : un message "Navigation bloquee (hors liste blanche)"
apparait, la page voulue ne s'affiche pas.

**Cause reelle** : le domaine de la page demandee n'est pas dans la
liste `allowlist` du fournisseur concerne (`config/providers.json`),
c'est un comportement volontaire de securite, pas un bug.

**Resolution** :
- Si le blocage est legitime (site non prevu) : ne rien faire, c'est
  la protection qui fonctionne.
- Si le blocage est une gene reelle (le fournisseur a change de
  domaine, ou redirige legitimement vers un sous-domaine non prevu) :
  ajouter ce domaine a la liste `allowlist` du fournisseur concerne
  dans `config/providers.json`, fermer et relancer l'application.
- Le "mode permissif" (case a cocher dans la barre du haut) autorise
  temporairement toute navigation, avec un avertissement affiche a
  chaque blocage evite. A utiliser avec prudence, a desactiver apres
  usage.

---

## Incident : l'auto-update ne trouve jamais de mise a jour

**Symptomes** : une nouvelle version existe sur GitHub, l'application
installee ne la propose jamais.

**Diagnostic** : consulter `main.log`, chercher
`Verification de mise a jour impossible` ou une `HttpError`.

**Causes reelles deja rencontrees** :
- Le depot GitHub est redevenu prive : `electron-updater` interroge le
  depot sans authentification (aucun jeton n'est embarque dans l'app
  distribuee, volontairement), une 404 systematique en resulte. Le
  depot doit rester public.
- La release existe mais est restee en brouillon ("draft") sur
  GitHub : verifier via `gh release list --repo SaideIsmael/orchestrateur`
  qu'elle apparait bien marquee "Latest", pas absente de la liste.
- Le numero de version dans `package.json` n'a pas ete incremente par
  rapport a la version deja installee : `electron-updater` compare les
  versions semver, une version identique ou inferieure n'est jamais
  proposee.

---

## Incident : `npm run release` echoue

**Symptomes** : la commande de publication d'une nouvelle version
s'arrete en erreur avant ou apres la construction des binaires.

**Causes reelles deja rencontrees, dans l'ordre a verifier** :

1. **"App is not signed and forceCodeSigning is set to true"** —
   aucun certificat de signature de code valide n'est installe. Voir
   la section "Signature de code" du README pour la procedure
   complete une fois le certificat obtenu.
2. **Erreur 401/403 lors de l'upload vers GitHub** — le jeton
   `GH_TOKEN` a expire (duree de vie d'un mois pour un jeton
   classique) ou n'est pas correctement expose dans le terminal en
   cours. Regenerer un jeton (voir README ou historique du projet) et
   refaire `$env:GH_TOKEN = "..."` avant de relancer.
3. **`EPERM: operation not permitted, rename ...\win-unpacked.tmp`**
   — l'indexation Windows ou l'antivirus scanne les fichiers
   fraichement extraits et bloque temporairement leur renommage.
   Supprimer le dossier `release\win-unpacked.tmp` s'il existe, puis
   relancer `npm run release`. Si l'incident se repete souvent,
   exclure le dossier `release\` de l'indexation Windows et de
   l'analyse antivirus en temps reel.
4. **Taille du `.exe` produit anormalement grande** (plus du double
   d'une version precedente) — verifier que `directories.output`
   (actuellement `release`) et `files` dans `package.json` ne se
   chevauchent pas. Ne jamais faire pointer `directories.output` vers
   un dossier egalement liste dans `files`.

---

## Incident : un jeton GitHub (GH_TOKEN) a ete expose par erreur

**Symptomes** : un jeton a ete colle en clair dans un terminal partage,
un historique de commandes, ou tout autre endroit visible par un tiers.

**Resolution immediate, sans attendre de constater un abus** :
1. GitHub → avatar (haut droite) → Settings → Developer settings →
   Personal access tokens → Tokens (classic).
2. Repérer le jeton concerné, cliquer "Delete" (revocation immediate).
3. En generer un nouveau (case "repo" cochee) suivant la meme
   procedure que la premiere fois.
4. Ne jamais coller un jeton directement dans un message ou un canal
   partage ; le definir uniquement via `$env:GH_TOKEN = "..."` dans un
   terminal personnel, juste avant de lancer `npm run release`.

---

## Contacts et references

- Depot et releases : https://github.com/SaideIsmael/orchestrateur
- Configuration technique complete : [README.md](README.md)
- Aucune donnee judiciaire ne transite par ce depot ni par les
  releases : seul le code de l'application y est publie.
