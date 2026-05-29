# MUGEC-CI — Connexion à votre Supabase

## 1. Créez un projet Supabase
Rendez-vous sur https://supabase.com → New Project.

## 2. Exécutez le schéma SQL
Ouvrez le **SQL Editor** et collez le contenu de [`supabase/schema.sql`](./schema.sql). Lancez la requête.

## 3. Récupérez vos clés
Project Settings → API :
- `Project URL`
- `anon public key`

## 4. Configurez les variables d'environnement
Créez un fichier `.env` à la racine du projet avec :

```
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi....
```

Redémarrez le dev server. La plateforme se connectera automatiquement.

## 5. (Optionnel) Créer un super-admin
Dans la table `user_roles`, insérez une ligne `role = 'super_admin'` avec l'`user_id` de votre compte.

## Modules livrés
- Portail public (accueil, actualités, opportunités, FAQ, contact, forum)
- Inscription en 3 étapes avec **filigrane MUGEC-CI** sur le formulaire
- Paiement mobile simulé (Orange Money, MTN, Wave, Moov)
- Espace membre + fiche/carte téléchargeable en PDF avec **filigrane MUGEC-CI**
- Schéma SQL complet avec rôles, RLS et triggers

## À étendre
- Intégration réelle des API mobile money (Orange, Wave…)
- Upload de la photo membre vers Supabase Storage
- Dashboards administrateurs par niveau (national, régional, local)
- Notifications SMS / WhatsApp via une edge function
