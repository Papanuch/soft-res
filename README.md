# Soft - Res

Application de bureau pour gérer le réseau d'avocats externes (71 avocats, 7 cantons romands) : trouver le bon avocat pour un dossier, rédiger le courrier de mandat, suivre les mandats et contrôler les conflits d'intérêts.

Successeur de l'ancien « Soft Réseau » en HTML. Tout tourne sur le PC, dans une vraie fenêtre Windows, et les données sont dans une base SQLite locale.

## Ce que ça fait

| Page | Rôle |
|---|---|
| **Accueil** | Vue d'ensemble (spécialités, cantons, villes), favoris, consultés récemment, mandats en cours, et une demande libre à l'assistant. |
| **Annuaire** | Recherche instantanée et filtres (spécialité, canton, tarif max, « près de » un NPA ou une ville avec rayon en km, FSA, favoris). Une phrase comme « bail Lausanne 20 km max 280 FSA » est convertie en filtres avec Entrée. Les tris disponibles comprennent « À qui le tour ? », qui fait tourner les mandats. La carte est toujours visible. |
| **Fiche avocat** | Coordonnées, note personnelle, historique des mandats avec évaluation, modification ou retrait. |
| **Courrier de mandat** | Modèle Orion rempli automatiquement. Il peut être réécrit par Claude, puis copié, imprimé ou enregistré comme mandat. Une alerte s'affiche si l'assuré ou la partie adverse apparaît déjà dans un mandat. |
| **Carte** | Carte de Suisse romande cliquable, avec les statistiques par canton. |
| **Assistant** | Vous décrivez le dossier en français. Claude propose les avocats les plus adaptés avec un argument pour chacun et contrôle les conflits. Sans clé API, ce sont des critères guidés (règles locales). |
| **Mandats** | Liste de tous les mandats, recherche, statut et évaluation modifiables en un clic. |
| **Conflits** | Recherche tolérante aux fautes d'un nom dans tous les mandats. Elle ignore « SA », « Sàrl », « Me » et autres titres ou formes juridiques. |
| **Données** | Sauvegarde et restauration (y compris l'export de l'ancien Soft Réseau), export CSV, signature des courriers. |

**Raccourcis clavier :**

| Touche | Action |
|---|---|
| `Ctrl K` | Palette de recherche (avocats, pages) |
| `/` | Aller à la recherche |
| `H` | Accueil |
| `A` | Annuaire |
| `C` | Carte |
| `G` | Assistant |
| `M` | Mandats |
| `K` | Conflits |
| `D` | Données |

**Noms réels :** les vrais noms restent chiffrés en AES-256. Ils sont déverrouillés avec la phrase secrète, gardés en mémoire seulement, et reverrouillés après 20 minutes d'inactivité. Ils ne sont jamais envoyés à Claude, qui ne voit que l'annuaire anonymisé avec des numéros.

## Installation (Windows, une seule fois)

Prérequis déjà installés : Python 3.13, Node, Git, uv.

1. **Télécharger le projet.**
   Ouvrir PowerShell, puis lancer :
   ```powershell
   cd $HOME\Documents
   git clone https://github.com/Papanuch/soft-res.git
   cd soft-res
   ```
2. **Clé Claude (facultatif).**
   - Copier `.env.example` en `.env`. `lancer.bat` le fait aussi tout seul.
   - Ouvrir `.env` avec le Bloc-notes.
   - Coller la clé après `ANTHROPIC_API_KEY=`, sans espace ni guillemets.
   - Sans clé, tout fonctionne sauf la rédaction par Claude ; l'assistant passe alors en règles locales.
3. **Lancer.** Double-cliquer sur `lancer.bat`.
   - Le premier lancement installe les bibliothèques et construit l'interface (2 à 5 minutes).
   - Les lancements suivants prennent quelques secondes.

Pour un raccourci sur le bureau : clic droit sur `lancer.bat`, puis *Envoyer vers*, puis *Bureau (créer un raccourci)*.

**Variante :**

| Commande | Effet |
|---|---|
| `lancer.bat --navigateur` | Ouvre l'app dans Edge ou Chrome au lieu d'une fenêtre dédiée |

**Où sont mes données ?**

- Elles sont dans `%LOCALAPPDATA%\SoftRes\soft-res.db`. Le chemin exact est affiché dans la page *Données*.
- Faites une sauvegarde JSON de temps en temps depuis cette page.

## Tester

- **Dans l'app :**
  1. Annuaire : taper « bail Lausanne max 280 » puis Entrée.
  2. Ouvrir un avocat, puis *Courrier de mandat*.
  3. Remplir assuré et partie adverse, puis *Enregistrer comme mandat*.
  4. Page *Conflits* : taper le nom de la partie adverse. Le mandat doit apparaître.
- **Tests automatiques :**
  ```powershell
  uv run pytest
  ```
  Les 14 tests doivent passer. Ils n'appellent jamais la vraie API Claude.

## Mise à jour

Double-cliquer sur `mettre-a-jour.bat`, qui récupère la dernière version et reconstruit l'interface.

## Technique

| Couche | Outils |
|---|---|
| Moteur | Python 3.13, FastAPI, SQLModel/SQLite, RapidFuzz (conflits), cryptography (noms réels), SDK Anthropic (Claude Opus 5.5, sorties structurées) |
| Interface | React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, cmdk |
| Fenêtre | pywebview (Edge WebView2, déjà présent sous Windows 10/11) |

**Développement :**

- `uv run soft-res --serveur` lance le moteur avec rechargement automatique.
- `cd frontend` puis `npm run dev` lance l'interface sur http://localhost:5173.
