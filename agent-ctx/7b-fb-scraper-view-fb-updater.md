---
Task ID: 7b-fb
Agent: Scraper View FB Updater
Task: Update scraper-view.tsx to support both Google Maps and Facebook engines

Work Log:
- Lu /home/z/my-project/worklog.md (contexte tâches 1, 7a, 8, 9, 10, 11) et le fichier actuel src/components/dashboard/views/scraper-view.tsx (623 lignes) pour comprendre la structure existante
- Vérifié la disponibilité des composants shadcn/ui requis : alert.tsx (Alert, AlertTitle, AlertDescription) et textarea.tsx (Textarea) — les deux existent
- Réécrit scraper-view.tsx (~770 lignes) avec :
  * Type `Engine = "google-maps" | "facebook"` + table `ENDPOINTS` qui mappe launch/job URLs par moteur
  * État `jobs: Record<Engine, JobState | null>` pour conserver le job en cours par moteur (changement d'onglet ne perd pas l'état)
  * `pollingEngine: Engine | null` pour tracker quel moteur poll en arrière-plan
  * Tabs shadcn en haut pour basculer "Google Maps" ↔ "Facebook" (avec icônes MapPin / FacebookIcon inline SVG)
  * Formulaire partagé : mot-clé, ville, commune, quartier, maxResults — visibles mais grisés (opacity-50 pointer-events-none) quand pageUrl est fourni en mode FB direct
  * Champs Facebook additionnels : Textarea "Cookies Facebook" (placeholder `c_user=XXXX; xs=YYYY; datr=ZZZZ; fr=WWW`) + Input "URL de page Facebook" (placeholder `https://www.facebook.com/orangecotedivoire`)
  * Alert orange (info) quand FB activé : "Facebook nécessite des cookies de session (c_user, xs)…"
  * Warning banner ambre quand FB activé et cookies vides (avant le bouton Lancer)
  * `launchJob` : construit le body différemment selon moteur, gère le flag `authenticated` de la réponse FB (toast.warning si false), valide keyword OU pageUrl pour FB
  * `cancelJob` et `pollJob` utilisent `ENDPOINTS[engine].job(id)` — la polling passe le moteur en paramètre pour garantir l'indépendance
  * Log streaming : ajouté les couleurs pour les 6 nouveaux event types FB (fb-login-required ambre, fb-consent-required ambre, fb-page-loaded cyan, fb-search-loaded cyan, fb-extracted emerald, fb-error red)
  * `formatEvent` étendu avec les 6 cas FB (🔐🍪📄🔍✓✗) en plus des cas GM existants
  * `PlaceCard` étendu pour détecter le mode FB (icône FacebookIcon orange au lieu de l'initiale, badge vérifié BadgeCheck sky-500, bloc description tronquée avec bouton "Voir plus"/"Voir moins", likes/followers avec Heart/Users + formatCount K/M, badges cliquables Messenger/WhatsApp/Facebook/Google Maps)
  * Dialog léger (overlay) ajouté pour visualiser le lieu sélectionné (icône Eye) avec tous les liens cliquables
  * Stats tab : labels adaptés au moteur ("Pages extraites" vs "Lieux extraits", "Pages visitées" vs "Pages scrapées")
  * Export CSV pointe vers `${ENDPOINTS[engine].job(currentJob.id)}?format=csv`
  * Palette respectée : emerald (primary) + orange (accent FB + alertes) + ambre (warning cookies) + sky-500 uniquement pour le badge vérifié FB (exception explicite demandée). Aucun indigo/bleu non justifié
  * Icônes lucide ajoutées : MessageCircle, BadgeCheck, Heart, Users, AlertTriangle (plus FacebookIcon SVG inline car lucide a déprécié l'icône Facebook)
- Lint : `bun run lint` → 0 erreur, 0 warning
- Dev server : compile en 563ms, GET / 200 OK, aucun warning runtime

Stage Summary:
- Fichier modifié : src/components/dashboard/views/scraper-view.tsx (réécriture complète, ~770 lignes)
- Toggle moteur Google Maps ↔ Facebook fonctionnel avec persistance d'état par moteur
- Intégration complète de l'API Facebook : POST /api/scraper/facebook, GET/DELETE /api/scraper/facebook/jobs/[id], export CSV
- Affichage des champs FB spécifiques dans PlaceCard (Messenger, WhatsApp, pageUrl, googleMapsUrl, likesCount, followersCount, isVerified, description expandable)
- Log streaming formaté pour les 6 event types FB (fb-login-required, fb-consent-required, fb-page-loaded, fb-search-loaded, fb-extracted, fb-error)
- Alerte info orange (cookies requis) + warning banner ambre (si cookies manquants) avant lancement FB
- Flow Google Maps existant préservé à l'identique (mêmes endpoints, mêmes event types, mêmes champs affichés)
- Lint 100% propre, dev server compile sans erreur, page / répond 200
- Palette conforme : emerald + orange, sky-500 uniquement pour le badge vérifié FB (exception explicite de la spec)
