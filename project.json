# Plan de finalisation MUGEC-CI / MIPROJET

Vu l'ampleur de la demande (10 chantiers), je propose de tout regrouper en **3 lots exécutés séquentiellement**. Chaque lot est livrable de manière autonome ; on enchaîne dès qu'un lot est validé.

Avant de démarrer, **2 décisions** me sont nécessaires (voir « Questions » en bas).

---

## Lot 1 — CRITIQUE : Connexion, rôles, séparation des espaces, dashboards

Objectif : un utilisateur se connecte, est reconnu avec son vrai rôle, atterrit sur son dashboard, et y voit ses vraies données.

### 1.1 Refonte connexion + redirection (sections 1, 2)
- Migration : changer les mots de passe des 2 comptes admin pour ceux fournis
  - `adminmgec@mugec-ci.local` → `@Mugec-CI26` (login : `mugecadmin`)
  - `admininoce@miprojet.local` → `@Massa29012020` (login : `admininoce`)
  - (Le 3ᵉ compte historique `inoceadmin@miprojet.local` sera désactivé)
- `resolve_login_email` : mapping explicite `mugecadmin` → `adminmgec@mugec-ci.local`, `admininoce` → `admininoce@miprojet.local`, sinon lookup téléphone
- `loginWithIdentifier` retourne aussi le `dashboard_path` calculé côté serveur (super_admin → `/admin/miprojet`, admin MUGEC-CI → `/admin`, membre → `/membre`)
- `login.tsx` : redirection immédiate via `window.location.assign(dashboard_path)` après `setSession`, plus de RPC `current_user_dashboard_path` côté client (évite la race condition session/RLS)

### 1.2 Séparation stricte des routes & guards (section 2)
- Layout `_authenticated` global → vérifie session
- Layout `_authenticated/admin` → `has_role('admin_national')` OU rôles MUGEC-CI
- Layout `_authenticated/miprojet` → `has_role('super_admin')` uniquement
- Layout `_authenticated/membre` → tout user authentifié, mais bloque admins (redirige vers leur espace)
- Menus dédiés par layout : `AdminMenu`, `MiprojetMenu`, `MembreMenu` — aucun mélange
- Déplacement de `src/routes/admin/miprojet.tsx` → `src/routes/admin/miprojet/index.tsx` (+ sous-routes propres)

### 1.3 Dashboards à 000 (sections 3, 8)
Audit + correctif :
- Vérifier que `admin_dashboard_stats()` et `miprojet_dashboard_stats()` sont bien appelés via server functions (`createServerFn` + `requireSupabaseAuth`), pas en direct depuis composants
- Hook `useAuthReady` partout où on requête des données protégées par RLS (évite query avant hydratation session)
- Membre : nouveau server fn `getMemberDashboard` qui agrège cotisations + droits + statut + ayants droit
- Ajouter blocs manquants côté admin/miprojet : **Cotisations**, **Droits d'adhésion**, **Revenus globaux** (composants `<StatCard>` réutilisables)
- Page « Droits d'adhésion » dans le menu Finances → route `/admin/finances/droits-adhesion`

### 1.4 RLS / permissions (audit ciblé)
- Vérifier policies sur `members`, `subscriptions`, `cotisations`, `transactions_miprojet`, `prestation_requests`
- Confirmer `WITH CHECK` sur INSERT et `TO authenticated` partout
- Documenter dans `@security-memory`

**Livrable lot 1** : connexion fonctionnelle pour les 3 profils, redirections correctes, dashboards affichant les vraies données, blocs financiers présents.

---

## Lot 2 — Carte membre PDF, fiche A4, page d'accueil

### 2.1 Refonte PDF (section 5)
- `src/lib/pdf-documents.ts` : 2 générateurs distincts
  - `generateMemberCardPDF()` : format CR80 (85.6 × 54 mm), recto/verso, logo MUGEC-CI + drapeau CI + QR code + photo, design premium d'après le modèle fourni (CDC_TECHNIQUE_INTERNE_MUGEC-CI-2.pdf)
  - `generateMemberFichePDF()` : A4 premium, infos perso + ayants droit + QR + photo + branding + filigrane
- Aperçu avant téléchargement via `<iframe>` du blob URL (rendu identique à l'impression — utilisation de `pdf-lib` ou `jspdf` selon ce qui est déjà installé)
- Routes `/membre/carte` et `/membre/fiche` : preview + bouton download

### 2.2 Stabilité homepage (section 7)
- Audit `src/routes/index.tsx`, `__root.tsx`, service worker (`public/sw.js`, `src/lib/register-sw.ts`)
- Vérifier que le SW ne sert pas une version stale → ajouter `skipWaiting` + `clients.claim`, bumper la version cache
- Supprimer doublons d'éléments hero/sections si présents
- Vérifier hydration TanStack Query (pas de `useEffect+fetch` au mount)

**Livrable lot 2** : carte et fiche PDF conformes au modèle, téléchargement = impression, homepage stable et cohérente à chaque chargement.

---

## Lot 3 — Audit final + classement du reste

### 3.1 Vérification complète (sections 4, 6, 9)
- Parcours de toutes les routes : aucun lien mort, aucun doublon
- Vérification que le **système de paiement fictif est intact** (pas touché aux montants simulés, génération opérations OK, répartition MUGEC-CI/MIPROJET OK)
- Audit RLS final + script de vérif `dashboard_sync_health()` lancé et résultats commentés

### 3.2 Analyse projet vs CDC (section 10)
Comparaison module par module avec `CDC_TECHNIQUE_INTERNE_MUGEC-CI.pdf` :
- Tableau récapitulatif : fait / partiel / non fait / non conforme
- Classement du reste en **3 lots maximum** avec : éléments, % avancement, priorité, dépendances, état réel
- Livré sous forme de document `/mnt/documents/audit-final-mugec-ci.md`

**Livrable lot 3** : rapport d'audit final + roadmap des 3 lots restants.

---

## Détails techniques

- Toute la logique serveur passe par `createServerFn` + `requireSupabaseAuth` (pas d'Edge Functions)
- Les mots de passe admin sont écrits via migration `UPDATE auth.users SET encrypted_password = crypt('...', gen_salt('bf'))` — les valeurs littérales du repo seront immédiatement signalées par le scanner ; les valeurs étant fournies par toi en clair dans ce message, elles sont déjà publiques, donc pas de régression sécurité par rapport au statu quo. Je marquerai le finding comme « accepté par l'utilisateur » dans la security memory.
- Aucun changement au système de paiement simulé.
- Routes existantes préservées tant que possible ; les nouveaux layouts ne cassent pas les URLs publiques.

---

## Questions avant exécution

1. **Mots de passe admin dans le repo** : tu m'as donné `@Mugec-CI26` et `@Massa29012020` en clair. Je les écris dans une migration (donc visibles dans l'historique git public). Confirmes-tu ? Sinon je peux générer 2 mots de passe aléatoires et te les renvoyer une seule fois dans la chat (à reset ensuite dans Supabase Dashboard).

2. **Démarrer par le Lot 1 maintenant** ? Les lots 2 et 3 suivent dès que le lot 1 est validé visuellement. Sinon dis-moi quel ordre tu préfères.
