/**
 * Échantillon de démonstration pour le moteur IA
 * Contient volontairement des doublons, erreurs et champs manquants
 * pour tester toutes les capacités du cleaner
 */
import type { ScrapedPlace } from "@/lib/scraper/types"

export function getSampleEntities(): ScrapedPlace[] {
  return [
    // === Orange CI — 3 variantes (doublons à fusionner) ===
    {
      id: "s1",
      name: "Orange CI - Agence Cocody",
      phone: "+225 27 22 48 00 00",
      email: "service.client@orange.ci",
      website: "orange.ci",
      address: "Cocody, Abidjan",
      sector: "Télécommunications",
      category: "Opérateur télécom",
      lat: 5.3511,
      lng: -3.9956,
      rating: 4.2,
      reviewCount: 1234,
      sources: ["Google Maps", "Site Web", "RCCM"],
      confidence: 99,
      status: "verified",
      scrapedAt: new Date().toISOString(),
    },
    {
      id: "s2",
      name: "Orange Côte d'Ivoire SARL",
      phone: "002250722480000", // format à corriger
      email: "service.client@orangeci", // email à corriger (manque .ci)
      website: "https://www.orange.ci/",
      address: "Cocody  Abidjan  Côte d'Ivoire", // espaces à normaliser
      sector: "telecom",
      lat: 5.3511,
      lng: -3.9956,
      rating: 4.2,
      sources: ["Google Maps"],
      confidence: 92,
      status: "enriched",
      scrapedAt: new Date().toISOString(),
    },
    {
      id: "s3",
      name: "ORANGE CI",
      phone: "07 22 48 00 00", // sans indicatif
      website: "orange.ci",
      address: "Cocody, Abidjan, Côte d'Ivoire",
      sources: ["Facebook"],
      confidence: 85,
      status: "partial",
      scrapedAt: new Date().toISOString(),
    },

    // === MTN CI — 2 variantes ===
    {
      id: "s4",
      name: "MTN Côte d'Ivoire - Siège",
      phone: "+225 27 22 49 00 00",
      email: "customercare@mtn.ci",
      website: "mtn.ci",
      address: "Cocody, Abidjan",
      sector: "Télécommunications",
      lat: 5.3481,
      lng: -4.0006,
      rating: 4.0,
      reviewCount: 856,
      sources: ["Google Maps", "Site Web"],
      confidence: 98,
      status: "verified",
      scrapedAt: new Date().toISOString(),
    },
    {
      id: "s5",
      name: "MTN CI Sarl",
      phone: "+2252722490000", // à formater
      email: "customercare@mtn.ci",
      website: "www.mtn.ci",
      address: "Riviera 2, Cocody, Abidjan",
      sources: ["Facebook"],
      confidence: 88,
      status: "enriched",
      scrapedAt: new Date().toISOString(),
    },

    // === Restaurant (champs manquants à enrichir) ===
    {
      id: "s6",
      name: "Restaurant Le Wôyô",
      phone: "+225 07 08 12 34 56",
      address: "Riviera 2, Cocody, Abidjan",
      sector: "Restauration",
      lat: 5.3461,
      lng: -3.9986,
      rating: 4.5,
      reviewCount: 142,
      sources: ["Google Maps", "Facebook"],
      confidence: 92,
      status: "enriched",
      scrapedAt: new Date().toISOString(),
      // Pas d'email ni site web → à enrichir par IA
    },

    // === Entreprise fermée (à détecter) ===
    {
      id: "s7",
      name: "Ancienne Pharmacie de Plateau (fermée définitivement)",
      phone: "+225 27 20 30 40 50",
      address: "Plateau, Abidjan",
      sector: "Santé",
      description: "Cette pharmacie est définitivement fermée depuis 2024.",
      sources: ["Google Maps"],
      confidence: 60,
      status: "partial",
      scrapedAt: new Date().toISOString(),
    },

    // === Entreprise avec email invalide ===
    {
      id: "s8",
      name: "BICICI Succursale Plateau",
      phone: "+225 27 20 24 50 00",
      email: "particuliers@bicici", // invalide (pas de TLD)
      website: "bicici.com",
      address: "Plateau, Abidjan",
      sector: "Banque",
      lat: 5.3161,
      lng: -4.0161,
      rating: 4.1,
      reviewCount: 312,
      sources: ["Google Maps", "Site Web", "RCCM"],
      confidence: 97,
      status: "verified",
      scrapedAt: new Date().toISOString(),
    },

    // === Entreprise avec typo email ===
    {
      id: "s9",
      name: "Pharmacie de la Riviera",
      phone: "+225 27 22 44 12 12",
      email: "contact@pharma-riviera.gmial.com", // typo gmial → gmail
      website: "pharma-riviera.ci",
      address: "Cocody, Abidjan",
      sector: "Pharmacie",
      lat: 5.3421,
      lng: -4.0016,
      rating: 4.3,
      reviewCount: 89,
      sources: ["Google Maps", "Facebook"],
      confidence: 88,
      status: "enriched",
      scrapedAt: new Date().toISOString(),
    },

    // === Entreprise sans secteur (à détecter par IA) ===
    {
      id: "s10",
      name: "ETS Kouassi Logistique",
      phone: "+225 05 56 78 90 12",
      email: "kouassi.logistique@gmail.com",
      address: "Yopougon, Abidjan",
      description: "Société de transport et de livraison de marchandises sur tout le territoire ivoirien. Logistique, fret, expédition.",
      // Pas de secteur → à détecter
      sources: ["Facebook", "Annuaire.ci"],
      confidence: 76,
      status: "partial",
      scrapedAt: new Date().toISOString(),
    },

    // === Doublon avec nom légèrement différent ===
    {
      id: "s11",
      name: "Groupe SIFCA Industries",
      phone: "+225 27 20 21 00 00",
      email: "contact@sifca-group.com",
      website: "sifca-group.com",
      address: "Plateau, Abidjan",
      sector: "Agro-alimentaire",
      lat: 5.3181,
      lng: -4.0181,
      sources: ["Google Maps", "RCCM"],
      confidence: 98,
      status: "verified",
      scrapedAt: new Date().toISOString(),
    },
    {
      id: "s12",
      name: "SIFCA Industries SARL",
      phone: "+225 27 20 21 00 00", // même tél → doublon
      email: "contact@sifca-group.com", // même email → doublon
      website: "sifca-group.com",
      address: "Plateau, Abidjan",
      sector: "Agro-alimentaire",
      sources: ["Google Maps"],
      confidence: 90,
      status: "enriched",
      scrapedAt: new Date().toISOString(),
    },
  ]
}
