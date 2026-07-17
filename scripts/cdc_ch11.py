# -*- coding: utf-8 -*-
"""Chapitre 11 — Sécurité."""
from cdc_common import *  # noqa: F401,F403


def chapter11():
    chapter_title(11, "Sécurité")
    intro(
        "La sécurité est un pilier transverse de ScrapIQ CI, intégré dès la conception "
        "(« security by design »). Ce chapitre détaille l'ensemble des mesures de sécurité : "
        "authentification (JWT, OAuth), double authentification (2FA), contrôle d'accès "
        "(RBAC), protection infrastructurelle (WAF, anti-DDoS), chiffrement des données, "
        "conformité réglementaire (RGPD/APIPD), audit et traçabilité, et rate limiting. "
        "L'objectif est d'atteindre un niveau de maturité élevé (aligné OWASP Top 10) tout "
        "en restant conforme au cadre réglementaire ivoirien."
    )

    # ---------------------------------------------------------------- 11.1
    h2("Authentification JWT & OAuth")
    h3("Tokens JWT")
    P(
        "L'authentification repose sur des JSON Web Tokens (JWT) signés HS256. Deux tokens "
        "sont émis à la connexion : un access token de courte durée (15 minutes) utilisé "
        "pour authentifier chaque requête API, et un refresh token de longue durée "
        "(30 jours) permettant d'obtenir un nouvel access token sans reconnecter "
        "l'utilisateur. Les refresh tokens sont stockés en base (hashés) et révocables "
        "individuellement, ce qui permet la déconnexion à distance et la révocation en cas "
        "de compromission."
    )
    table(
        ["Token", "Usage", "Durée", "Stockage"],
        [
            ["Access token", "Authentifier chaque requête", "15 min", "Mémoire client (non localStorage XSS-safe)"],
            ["Refresh token", "Obtenir un nouvel access token", "30 jours", "Base (hashé), HttpOnly cookie"],
            ["2FA temp token", "Transporter l'étape 2FA", "5 min", "Mémoire serveur + JWT signé"],
            ["Email verification", "Confirmer un email", "24 h", "Base (jeton unique)"],
            ["Password reset", "Réinitialiser mot de passe", "1 h", "Base (jeton unique)"],
        ],
        col_widths=[3.0 * cm, 5.0 * cm, 1.8 * cm, CONTENT_W - 9.8 * cm],
    )
    h3("Cycle de vie d'un JWT")
    code_block(
        "// Émission à la connexion\n"
        "const accessToken = jwt.sign(\n"
        "  { sub: user.id, org: orgId, role, scope },\n"
        "  process.env.JWT_SECRET,\n"
        "  { expiresIn: '15m', algorithm: 'HS256' }\n"
        ");\n"
        "\n"
        "// Vérification à chaque requête (middleware)\n"
        "const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });\n"
        "if (await isBlacklisted(token)) throw new Unauthorized();\n"
        "req.user = payload;\n"
        "\n"
        "// Rafraîchissement\n"
        "POST /auth/refresh  { refreshToken }  →  { accessToken, refreshToken }",
    )
    h3("OAuth 2.0 (Google, Microsoft)")
    P(
        "Le SSO OAuth 2.0 permet aux utilisateurs de se connecter avec leur compte Google "
        "ou Microsoft. Le flux Authorization Code avec PKCE est utilisé. À l'issue du flux, "
        "un compte utilisateur est créé (ou lié) et une session JWT est émise. Les scopes "
        "demandés sont limités au strict nécessaire (openid, email, profile). Les tokens "
        "OAuth ne sont pas stockés en clair : seul l'identité vérifiée est conservée."
    )
    h3("Politique de mot de passe")
    table(
        ["Règle", "Valeur", "Justification"],
        [
            ["Longueur minimale", "12 caractères", "Résistance au force-brute"],
            ["Complexité", "3 des 4 classes (maj, min, chiffre, spécial)", "Éviter les mots du dictionnaire"],
            ["Hachage", "bcrypt cost 12", "Lenteur volontaire anti-offline"],
            ["Verrouillage", "5 échecs → 15 min", "Anti force-brute"],
            ["Historique", "5 derniers interdits", "Anti réutilisation"],
            ["Expiration", "Optionnelle (90 j)", "Selon politique org"],
            ["Pwned check", "k-anonymité HaveIBeenPwned", "Détection de fuites"],
        ],
        col_widths=[3.2 * cm, 4.8 * cm, CONTENT_W - 8 * cm],
    )

    # ---------------------------------------------------------------- 11.2
    h2("Double authentification (2FA)")
    P(
        "La double authentification renforce la sécurité des comptes, en particulier pour "
        "les rôles privilégiés (Owner, Admin). ScrapIQ CI implémente le 2FA TOTP "
        "(Time-based One-Time Password) selon la RFC 6238, compatible avec les applications "
        "Authenticator (Google Authenticator, Microsoft Authenticator, Authy, FreeOTP)."
    )
    h3("Activation de la 2FA")
    code_block(
        "// 1. Génération du secret TOTP\n"
        "const secret = generateTOTPSecret();  // base32, 20 bytes\n"
        "const qrUrl = `otpauth://totp/ScrapIQ:${email}?secret=${secret}&issuer=ScrapIQ`;\n"
        "// 2. Affichage QR + codes de secours (10 codes à usage unique)\n"
        "// 3. L'utilisateur valide en saisissant un code courant\n"
        "// 4. Secret chiffré puis stocké en base, 2FA activée",
    )
    h3("Vérification à la connexion")
    bullets([
        "Étape 1 : email + mot de passe → si OK, émission d'un 2FA temp token (5 min)",
        "Étape 2 : l'utilisateur saisit un code TOTP (6 chiffres) → vérification",
        "En cas d'indisponibilité de l'app : utilisation d'un code de secours (hashé, à usage unique)",
        "Après 5 codes erronés : verrouillage temporaire et notification email",
        "À succès : émission du JWT (access + refresh) et journalisation",
    ])
    h3("Codes de secours")
    P(
        "Dix codes de secours à usage unique sont générés à l'activation, hashés puis "
        "stockés. Ils permettent l'accès en cas de perte du dispositif TOTP. Chaque "
        "utilisation invalide le code. L'utilisateur peut régénérer les codes à tout "
        "moment (invalidant les précédents)."
    )

    # ---------------------------------------------------------------- 11.3
    h2("Contrôle d'accès RBAC")
    P(
        "Le contrôle d'accès basé sur les rôles (RBAC) est multi-tenant et hiérarchique. "
        "Chaque action est protégée par une permission, et chaque rôle regroupe un ensemble "
        "de permissions. L'évaluation se fait à chaque requête via un middleware qui "
        "vérifie le rôle du membre dans le workspace concerné."
    )
    h3("Matrice permissions × rôles (extrait étendu)")
    table(
        ["Permission", "Owner", "Admin", "Manager", "Agent", "Viewer"],
        [
            ["org:read", "✓", "✓", "✓", "✓", "✓"],
            ["org:billing", "✓", "—", "—", "—", "—"],
            ["org:delete", "✓", "—", "—", "—", "—"],
            ["workspace:create", "✓", "✓", "—", "—", "—"],
            ["member:invite", "✓", "✓", "—", "—", "—"],
            ["member:role:edit", "✓", "✓", "—", "—", "—"],
            ["member:delete", "✓", "✓", "—", "—", "—"],
            ["security:config", "✓", "✓", "—", "—", "—"],
            ["audit:read", "✓", "✓", "—", "—", "—"],
            ["scrape:run", "✓", "✓", "✓", "✓", "—"],
            ["agents:run", "✓", "✓", "✓", "—", "—"],
            ["export:create", "✓", "✓", "✓", "✓", "limité"],
            ["alert:config", "✓", "✓", "✓", "—", "—"],
            ["report:schedule", "✓", "✓", "✓", "—", "—"],
            ["company:edit", "✓", "✓", "✓", "—", "—"],
            ["company:delete", "✓", "✓", "—", "—", "—"],
            ["api-key:manage", "✓", "✓", "—", "—", "—"],
            ["webhook:manage", "✓", "✓", "—", "—", "—"],
            ["bi:read", "✓", "✓", "✓", "—", "✓"],
        ],
        col_widths=[4.2 * cm, 1.7 * cm, 1.7 * cm, 2.0 * cm, 1.7 * cm, CONTENT_W - 11.3 * cm],
        align_center_cols=[1, 2, 3, 4, 5],
    )
    h3("Principe du moindre privilège")
    P(
        "Les rôles par défaut suivent le principe du moindre privilège : un Viewer ne peut "
        "que consulter, un Agent peut collecter et exporter mais pas gérer, un Manager "
        "pilote l'activité mais ne configure pas la sécurité, un Admin gère le workspace, "
        "et l'Owner garde le contrôle total y compris la facturation. Les clés API "
        "héritent d'un sous-ensemble de permissions configurable (scopes)."
    )

    # ---------------------------------------------------------------- 11.4
    h2("WAF et protection DDoS")
    h3("Web Application Firewall (WAF)")
    P(
        "Un WAF en edge filtre les requêtes malveillantes avant qu'elles n'atteignent "
        "l'application. Il applique un ensemble de règles gérées (OWASP Core Rule Set) "
        "détectant les attaques courantes : injections SQL, cross-site scripting (XSS), "
        "inclusion de fichiers (LFI/RFI), traversée de répertoires, exécution de code à "
        "distance, et anomalies de protocole. Les requêtes suspectes sont bloquées (403) "
        "ou mises en défi (captcha)."
    )
    table(
        ["Catégorie d'attaque", "Détection", "Action"],
        [
            ["Injection SQL", "Patterns SQL dans paramètres", "Blocage 403"],
            ["XSS", "Scripts dans paramètres/headers", "Blocage 403"],
            ["LFI / RFI", "Chemins ../, http:// dans params", "Blocage 403"],
            ["Bot scanning", "User-agents suspects, vitesse", "Défi captcha"],
            ["Brute force login", "Tentatives répétées", "Rate limit + verrouillage"],
            ["Anomalies protocole", "Headers/requêtes malformés", "Rejet"],
        ],
        col_widths=[4.0 * cm, 5.8 * cm, CONTENT_W - 9.8 * cm],
    )
    h3("Protection anti-DDoS")
    P(
        "La protection anti-DDoS opère à plusieurs niveaux : au niveau réseau (L3/L4) pour "
        "absorber les attaques volumétriques (SYN floods, UDP floods) via mitigation "
        "anycast et scrubbing, et au niveau application (L7) pour limiter les requêtes par "
        "IP et par route. Les seuils sont ajustables et des alertes sont émises en cas de "
        "pic anormal de trafic."
    )
    bullets([
        "Mitigation L3/L4 managée par le fournisseur edge (absorption anycast)",
        "Rate limiting L7 par IP et par route (token bucket)",
        "Défi JavaScript / captcha pour les pics suspects",
        "Liste de blocage dynamique des IP malveillantes",
        "Alerting temps réel sur seuils de trafic",
    ])

    # ---------------------------------------------------------------- 11.5
    h2("Chiffrement des données")
    table(
        ["Donnée", "En transit", "Au repos", "Remarque"],
        [
            ["Communications HTTP", "TLS 1.3", "—", "HSTS, certificats Let's Encrypt"],
            ["Mots de passe", "TLS", "bcrypt cost 12", "Jamais en clair"],
            ["Secrets 2FA TOTP", "TLS", "AES-256-GCM", "Chiffré avec clé KMS"],
            ["Tokens (refresh)", "TLS", "Hash SHA-256", "Hashé en base"],
            ["Données business (PG)", "TLS", "Chiffrement disque (LUKS/EBS)", "Volume chiffré"],
            ["Backups", "TLS", "AES-256", "Chiffrés côté serveur"],
            ["Secrets applicatifs", "—", "Vault / secrets manager", "Rotation périodique"],
            ["Clés API", "TLS", "Hash SHA-256", "Affichées une fois"],
        ],
        col_widths=[3.4 * cm, 2.2 * cm, 4.0 * cm, CONTENT_W - 9.6 * cm],
    )
    h3("Gestion des secrets")
    P(
        "Les secrets applicatifs (clés JWT, credentials DB, tokens OAuth, clés API "
        "fournisseurs) sont gérés via un secrets manager (variable d'environnement chiffrée "
        "en développement, vault dédié en production). La rotation des secrets est planifiée "
        "(trimestrielle pour les clés sensibles, immédiate en cas d'incident). L'accès aux "
        "secrets est journalisé."
    )

    # ---------------------------------------------------------------- 11.6
    h2("Conformité RGPD / APIPD")
    P(
        "ScrapIQ CI intègre les principes de la loi ivoirienne n° 2013-450 sur la protection "
        "des données personnelles (régie par l'APIPD) et du RGPD européen pour les clients "
        "internationaux. La conformité est assurée par conception et documentée."
    )
    h3("Principes respectés")
    table(
        ["Principe", "Mise en œuvre"],
        [
            ["Licéité & loyauté", "Collecte sur sources publiques, consentement utilisateurs, transparence"],
            ["Finalité", "Finalités clairement définies (prospection, analyse), non détournement"],
            ["Minimisation", "Seules les données utiles sont collectées et conservées"],
            ["Exactitude", "Mise à jour par re-scraping, correction possible"],
            ["Limitation conservation", "Rétention définie par type de donnée, purge automatique"],
            ["Sécurité", "Chiffrement, RBAC, audit, WAF (voir sections précédentes)"],
            ["Accountability", "Documentation, registre des traitements, journal d'audit"],
        ],
        col_widths=[3.6 * cm, CONTENT_W - 3.6 * cm],
    )
    h3("Droits des personnes")
    bullets([
        ("Droit d'accès", ["L'utilisateur consulte ses données personnelles dans son profil"]),
        ("Droit à l'effacement", ["Procédure de suppression de compte avec anonymisation"]),
        ("Droit de rectification", ["Édition du profil par l'utilisateur"]),
        ("Droit à la portabilité", ["Export JSON des données utilisateur"]),
        ("Droit d'opposition", ["Désinscription possible, gestion des consentements"]),
        ("Notification de violation", ["Procédure de notification sous 72 h à l'APIPD et aux personnes"]),
    ])
    h3("Registre des traitements")
    P(
        "Un registre des traitements documente chaque finalité de traitement : données "
        "concernées, base légale, destinataires, durées de conservation, mesures de "
        "sécurité. Il est tenu à jour et disponible pour l'APIPD. Une mention de "
        "confidentialité (privacy policy) et des conditions d'utilisation sont accessibles "
        "publiquement."
    )

    # ---------------------------------------------------------------- 11.7
    h2("Audit et traçabilité")
    P(
        "Le journal d'audit enregistre toutes les actions sensibles effectuées sur la "
        "plateforme : authentifications, changements de rôle, modifications de "
        "configuration sécurité, accès aux données sensibles, lancement de jobs, exports, "
        "suppressions. Chaque entrée contient l'acteur, l'action, la cible, l'horodatage, "
        "l'IP, le user-agent et un contexte (metadata JSON)."
    )
    h3("Événements audités")
    table(
        ["Catégorie", "Événements", "Rétention"],
        [
            ["Authentification", "login, logout, 2FA enable/disable, OAuth link", "12 mois"],
            ["Autorisation", "role change, permission grant/revoke", "12 mois"],
            ["Configuration", "security config change, IP rules change", "12 mois"],
            ["Données", "company create/update/delete, bulk export", "12 mois"],
            ["Système", "source enable/disable, key rotation", "12 mois"],
            ["API", "api key create/revoke, webhook create/delete", "12 mois"],
        ],
        col_widths=[3.0 * cm, 8.0 * cm, CONTENT_W - 11 * cm],
    )
    h3("Intégrité du journal")
    P(
        "Le journal d'audit est append-only (aucune modification/suppression directe) et "
        "stocké sur un volume distinct. Les entrées sont horodatées et signées (chaîne de "
        "hachage) pour détecter toute altération. Un export du journal est disponible pour "
        "les Admins et Owners, et une intégration SIEM est prévue pour les plans "
        "Enterprise."
    )

    # ---------------------------------------------------------------- 11.8
    h2("Rate limiting et anti-abus")
    h3("Rate limiting multicouche")
    table(
        ["Niveau", "Portée", "Limite typique", "Algorithme"],
        [
            ["Edge / WAF", "Par IP globale", "1000 req/min", "Token bucket"],
            ["Application — auth", "Par IP sur /auth/*", "10 req/min", "Sliding window"],
            ["Application — API", "Par clé API / par IP", "Selon plan (100–3000/min)", "Token bucket"],
            ["Scraping jobs", "Par workspace", "Quota mensuel (plan)", "Compteur"],
            ["Exports", "Par workspace", "Concurrents limités", "Sémaphore"],
        ],
        col_widths=[3.4 * cm, 4.2 * cm, 4.0 * cm, CONTENT_W - 11.6 * cm],
    )
    h3("Anti-abus supplémentaires")
    bullets([
        "Captcha sur inscription, login après échecs, et formulaires sensibles",
        "Détection de comptes multiples depuis une même IP (anti-fraude)",
        "Validation d'email obligatoire (jeton à usage unique)",
        "Limitation de la taille des payloads (body size limit)",
        "Sanitization des entrées (anti-XSS, anti-injection)",
        "CORS strict (origines autorisées uniquement)",
        "En-têtes de sécurité : CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy",
    ])
    h3("Alignement OWASP Top 10")
    table(
        ["Risque OWASP", "Mesure"],
        [
            ["A01 Broken Access Control", "RBAC strict, vérification par requête, tests"],
            ["A02 Cryptographic Failures", "TLS 1.3, bcrypt, AES-256, gestion secrets"],
            ["A03 Injection", "Requêtes paramétrées (Prisma), WAF, validation Zod"],
            ["A04 Insecure Design", "Threat modeling, revue de design, principes sécurisés"],
            ["A05 Security Misconfiguration", "Hardening, images minimales, secrets hors code"],
            ["A06 Vulnerable Components", "Dépendances scannées (SCA), mise à jour continue"],
            ["A07 Auth Failures", "Politique mot de passe, 2FA, verrouillage, rotation"],
            ["A08 Software/Data Integrity", "Signatures webhooks, CI/CD signé, integrité audit"],
            ["A09 Logging/Monitoring Failures", "Audit, logs centralisés, alerting SIEM"],
            ["A10 SSRF", "Validation des URLs sortantes, allowlist, pas de redirect libre"],
        ],
        col_widths=[5.0 * cm, CONTENT_W - 5.0 * cm],
    )
    info_box(
        "Synthèse du chapitre",
        "La sécurité de ScrapIQ CI est multicouche et conforme aux bonnes pratiques OWASP "
        "et au cadre réglementaire ivoirien (APIPD). Elle couvre l'authentification (JWT, "
        "OAuth, 2FA), le contrôle d'accès (RBAC), la protection edge (WAF, anti-DDoS), le "
        "chiffrement, l'audit et le rate limiting. Cette posture sécurisée constitue un "
        "différenciateur majeur et une condition de confiance pour les clients "
        "entreprise et institutionnels.",
    )
