# -*- coding: utf-8 -*-
"""Chapitre 8 — Diagrammes Mermaid."""
from cdc_common import *  # noqa: F401,F403


def chapter8():
    chapter_title(8, "Diagrammes Mermaid")
    intro(
        "Ce chapitre présente les diagrammes clés de ScrapIQ CI sous forme de code Mermaid, "
        "format textuel standard largement supporté par les outils de documentation "
        "(GitHub, GitLab, Notion, etc.). Quatre familles de diagrammes sont couvertes : "
        "flowcharts, diagrammes de séquence, diagrammes entité-association (ER) et "
        "diagrammes de Gantt. Le code Mermaid est affiché dans des blocs monospace et peut "
        "être copié directement dans tout éditeur compatible pour rendu graphique."
    )

    # ---------------------------------------------------------------- 8.1
    h2("Flowcharts")
    h3("Flowchart 1 — Pipeline global de traitement")
    code_block(
        "flowchart TD\n"
        "    A([Requête utilisateur]) --> B[Agent 1: Sources]\n"
        "    B --> C[Agent 2: Scraping multi-sources]\n"
        "    C --> D[Agent 3: Nettoyage]\n"
        "    D --> E[Agent 4: Dédoublonnage]\n"
        "    E --> F{Parallèle}\n"
        "    F --> G[Agent 5: Enrichissement LLM]\n"
        "    F --> H[Agent 6: Validation]\n"
        "    G --> I[Agent 7: Géocodage]\n"
        "    H --> I\n"
        "    I --> J[Agent 8: Classification]\n"
        "    J --> K[Agent 9: Scoring]\n"
        "    K --> L[Agent 10: Export & Notification]\n"
        "    L --> M([Résultat final])\n"
        "    C -.->|erreur| X((Retry x3))\n"
        "    X -.-> C\n"
        "    X -.->|échec| Y((Circuit Breaker))",
        caption_text="Figure 8.1 — Flowchart du pipeline de traitement",
    )
    h3("Flowchart 2 — Authentification avec 2FA")
    code_block(
        "flowchart TD\n"
        "    Start([Utilisateur]) --> Pwd[Saisie email + mot de passe]\n"
        "    Pwd --> CheckPwd{Vérif bcrypt}\n"
        "    CheckPwd -->|invalide| ErrPwd[Erreur 401]\n"
        "    CheckPwd -->|valide| Check2FA{2FA activé?}\n"
        "    Check2FA -->|non| GenJWT[Génération JWT]\n"
        "    Check2FA -->|oui| AskCode[Demande code TOTP]\n"
        "    AskCode --> VerifyCode{Code valide?}\n"
        "    VerifyCode -->|non| ErrCode[Erreur 401]\n"
        "    VerifyCode -->|oui| GenJWT\n"
        "    GenJWT --> Session[Session active]\n"
        "    Session --> End([Tableau de bord])",
        caption_text="Figure 8.2 — Flowchart de l'authentification 2FA",
    )
    h3("Flowchart 3 — Gestion d'un quota")
    code_block(
        "flowchart TD\n"
        "    Req([Requête API]) --> Q1{Quota dépassé?}\n"
        "    Q1 -->|non| Incr[Incrémente compteur]\n"
        "    Q1 -->|oui| Q2{Overage autorisé?}\n"
        "    Q2 -->|oui| Bill[Billeter overage]\n"
        "    Q2 -->|non| Block[Erreur 429 Quota]\n"
        "    Incr --> Exec[Exécute requête]\n"
        "    Bill --> Exec\n"
        "    Exec --> Resp([Réponse])\n"
        "    Block --> Resp",
        caption_text="Figure 8.3 — Flowchart de gestion des quotas",
    )
    h3("Flowchart 4 — Décision de fusion de doublons")
    code_block(
        "flowchart TD\n"
        "    A[Deux fiches A et B] --> B1{Tel identique?}\n"
        "    B1 -->|oui| +0.45\n"
        "    B1 -->|non| B2{Email identique?}\n"
        "    B2 -->|oui| +0.35\n"
        "    B2 -->|non| B3[Similarité nom * 0.30]\n"
        "    +0.45 --> C\n"
        "    +0.35 --> C\n"
        "    B3 --> C[Score cumulé]\n"
        "    A --> D{Distance GPS < 100m?}\n"
        "    D -->|oui| +0.20\n"
        "    +0.20 --> C\n"
        "    C --> E{Score >= 0.82?}\n"
        "    E -->|oui| F[Fusion A+B]\n"
        "    E -->|non| G[Garder séparées]",
        caption_text="Figure 8.4 — Flowchart de décision de fusion",
    )

    # ---------------------------------------------------------------- 8.2
    h2("Diagrammes de séquence")
    h3("Séquence 1 — Recherche d'entreprises")
    code_block(
        "sequenceDiagram\n"
        "    actor U as Utilisateur\n"
        "    participant UI as Interface\n"
        "    participant API as API REST\n"
        "    participant ES as Elasticsearch\n"
        "    participant DB as PostgreSQL\n"
        "    U->>UI: Saisit critères + lance recherche\n"
        "    UI->>API: GET /companies/search?q=...&city=...\n"
        "    API->>API: Authentification JWT + RBAC\n"
        "    API->>ES: Recherche full-text + filtres\n"
        "    ES-->>API: Résultats + agrégations\n"
        "    API->>DB: Enrichir avec données propriétaires\n"
        "    DB-->>API: Données complètes\n"
        "    API-->>UI: 200 OK { data, meta, facets }\n"
        "    UI-->>U: Affiche liste + carte + filtres",
        caption_text="Figure 8.5 — Séquence : recherche d'entreprises",
    )
    h3("Séquence 2 — Pipeline d'agents IA")
    code_block(
        "sequenceDiagram\n"
        "    actor M as Manager\n"
        "    participant UI\n"
        "    participant API\n"
        "    participant ORC as Orchestrateur\n"
        "    participant A1 as Agent Sources\n"
        "    participant A2 as Agent Scraping\n"
        "    participant A5 as Agent Enrich\n"
        "    participant A6 as Agent Valid\n"
        "    participant LLM\n"
        "    participant WS as NotifWS\n"
        "    M->>UI: Lance pipeline\n"
        "    UI->>API: POST /agents\n"
        "    API->>ORC: start(input)\n"
        "    ORC->>A1: run\n"
        "    A1-->>ORC: sources + queries\n"
        "    ORC->>A2: run (parallèle multi-sources)\n"
        "    A2-->>ORC: rawData\n"
        "    par Branches parallèles\n"
        "        ORC->>A5: run\n"
        "        A5->>LLM: enrichir\n"
        "        LLM-->>A5: description\n"
        "    and\n"
        "        ORC->>A6: run\n"
        "        A6-->>ORC: validation\n"
        "    end\n"
        "    ORC->>WS: events (temps réel)\n"
        "    WS-->>UI: push progression\n"
        "    UI-->>M: 8/10 … 10/10\n"
        "    ORC-->>API: finalExport\n"
        "    API-->>UI: 201 résultat",
        caption_text="Figure 8.6 — Séquence : pipeline d'agents IA",
    )
    h3("Séquence 3 — Livraison d'un webhook")
    code_block(
        "sequenceDiagram\n"
        "    participant W as Worker\n"
        "    participant DB\n"
        "    participant WH as Webhook (client)\n"
        "    W->>DB: Événement job.completed\n"
        "    DB-->>W: Liste webhooks abonnés\n"
        "    W->>WH: POST (payload + signature HMAC)\n"
        "    alt Succès (2xx)\n"
        "        WH-->>W: 200 OK\n"
        "        W->>DB: delivery = delivered\n"
        "    else Échec\n"
        "        WH-->>W: 5xx / timeout\n"
        "        W->>W: Retry (backoff) x5\n"
        "        W->>DB: delivery = failed\n"
        "    end",
        caption_text="Figure 8.7 — Séquence : livraison d'un webhook",
    )

    # ---------------------------------------------------------------- 8.3
    h2("Diagramme entité-association")
    h3("ER complet du modèle de données (extrait)")
    code_block(
        "erDiagram\n"
        "    ORGANIZATION ||--o{ WORKSPACE : possède\n"
        "    ORGANIZATION ||--|| USER : owner\n"
        "    WORKSPACE ||--o{ MEMBER : contient\n"
        "    WORKSPACE ||--o{ COMPANY : regroupe\n"
        "    USER ||--o{ MEMBER : membre\n"
        "    USER ||--o{ SESSION : a\n"
        "    USER ||--o{ API_KEY : détient\n"
        "    USER ||--o{ SCRAPE_JOB : lance\n"
        "    SCRAPE_JOB ||--o{ COMPANY : produit\n"
        "    COMPANY ||--o{ AUDIT_LOG : audité\n"
        "    ORGANIZATION ||--|| SUBSCRIPTION : abonne\n"
        "    SUBSCRIPTION ||--o{ INVOICE : facture\n"
        "    USER ||--o{ NOTIFICATION : reçoit\n"
        "    WORKSPACE ||--o{ WEBHOOK : configure\n"
        "\n"
        "    ORGANIZATION {\n"
        "        string id PK\n"
        "        string name\n"
        "        string slug UK\n"
        "        string plan\n"
        "        string ownerId FK\n"
        "    }\n"
        "    COMPANY {\n"
        "        string id PK\n"
        "        string name\n"
        "        string sector\n"
        "        string city\n"
        "        string commune\n"
        "        string phone\n"
        "        float  lat\n"
        "        float  lng\n"
        "        int    score\n"
        "        string grade\n"
        "    }\n"
        "    SCRAPE_JOB {\n"
        "        string id PK\n"
        "        string query\n"
        "        string city\n"
        "        string status\n"
        "        int    results\n"
        "        string userId FK\n"
        "    }",
        caption_text="Figure 8.8 — Diagramme entité-association",
    )
    h3("Description des associations")
    table(
        ["Entité source", "Cardinalité", "Entité cible", "Relation"],
        [
            ["ORGANIZATION", "1 — N", "WORKSPACE", "possède"],
            ["WORKSPACE", "1 — N", "MEMBER", "contient"],
            ["WORKSPACE", "1 — N", "COMPANY", "regroupe"],
            ["USER", "1 — N", "MEMBER", "est membre"],
            ["USER", "1 — N", "SESSION", "possède"],
            ["SCRAPE_JOB", "1 — N", "COMPANY", "produit"],
            ["ORGANIZATION", "1 — 1", "SUBSCRIPTION", "abonné"],
            ["SUBSCRIPTION", "1 — N", "INVOICE", "facturé"],
            ["WORKSPACE", "1 — N", "WEBHOOK", "configure"],
        ],
        col_widths=[3.6 * cm, 2.2 * cm, 3.6 * cm, CONTENT_W - 9.4 * cm],
        align_center_cols=[1],
    )

    # ---------------------------------------------------------------- 8.4
    h2("Diagramme de Gantt")
    h3("Gantt du projet (18 mois — MVP à V2)")
    code_block(
        "gantt\n"
        "    title Planning ScrapIQ CI — MVP à V2\n"
        "    dateFormat YYYY-MM-DD\n"
        "    axisFormat %m/%y\n"
        "\n"
        "    section Cadrage\n"
        "    Étude de marché          :done, a1, 2024-01-01, 30d\n"
        "    Spécifications           :done, a2, after a1, 30d\n"
        "    Architecture             :done, a3, after a2, 21d\n"
        "\n"
        "    section MVP\n"
        "    Auth + RBAC              :m1, 2024-03-01, 30d\n"
        "    Scraping Google Maps     :m2, after m1, 30d\n"
        "    IA cleaner (clean+dedupe):m3, after m1, 30d\n"
        "    Recherche ES             :m4, after m3, 21d\n"
        "    Exports                  :m5, after m4, 14d\n"
        "    UI core                  :m6, after m1, 45d\n"
        "    Bêta privée              :milestone, mb, after m5, 0d\n"
        "\n"
        "    section V1\n"
        "    Multi-sources (FB/LI/Web):v1, after mb, 45d\n"
        "    Cartographie OSM         :v2, after mb, 30d\n"
        "    API REST publique        :v3, after mb, 30d\n"
        "    SaaS + facturation       :v4, after v1, 30d\n"
        "    Notifications + WS       :v5, after v1, 21d\n"
        "    BI + rapports            :v6, after v3, 30d\n"
        "    Lancement commercial     :milestone, mc, after v6, 0d\n"
        "\n"
        "    section V2\n"
        "    Agents IA multi-agents   :w1, after mc, 45d\n"
        "    Sécurité entreprise      :w2, after mc, 30d\n"
        "    Marketplace intégrations :w3, after w1, 45d\n"
        "    PWA + offline            :w4, after w1, 21d\n"
        "    Release V2               :milestone, md, after w3, 0d",
        caption_text="Figure 8.9 — Diagramme de Gantt du projet",
    )
    h3("Lecture du Gantt")
    table(
        ["Phase", "Durée", "Livrable majeur", "Jalon"],
        [
            ["Cadrage", "≈ 3 mois", "Spec + architecture", "Validation comité"],
            ["MVP", "≈ 4 mois", "Produit utilisable", "Bêta privée"],
            ["V1", "≈ 5 mois", "Produit commercial", "Lancement"],
            ["V2", "≈ 6 mois", "Agents IA + marketplace", "Release V2"],
        ],
        col_widths=[3.0 * cm, 2.4 * cm, 6.0 * cm, CONTENT_W - 11.4 * cm],
    )
    info_box(
        "Synthèse du chapitre",
        "Les diagrammes Mermaid offrent une représentation standardisée et exploitable du "
        "pipeline, de l'authentification, des quotas, de la fusion de doublons, des "
        "séquences clés, du modèle de données et du planning. Leur format textuel permet "
        "une intégration native dans la documentation technique et le suivi de projet.",
    )
