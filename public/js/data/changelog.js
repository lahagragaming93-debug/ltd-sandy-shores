// ============================================================
// Journal des mises à jour — LTD Sandy Shores
// Affiché dans la modale ouverte en cliquant sur la signature
// de version (footer). La version la plus récente en premier.
// Routine : à CHAQUE mise à jour, ajouter une entrée ici ET
// bumper VERSION dans js/version.js.
// ============================================================

export const CHANGELOG = [
  {
    version: '1.28.6',
    date: '16/07/2026',
    title: "Correction d'affichage du journal",
    items: [
      'Mise en page du journal des mises à jour corrigée (espaces superflus supprimés).'
    ]
  },
  {
    version: '1.28.5',
    date: '16/07/2026',
    title: 'Journal des mises à jour intégré',
    items: [
      'Le journal des mises à jour est désormais consultable en cliquant sur la signature de version en bas de chaque page.'
    ]
  },
  {
    version: '1.28.4',
    date: '06/07/2026',
    title: 'Correction stock station',
    items: [
      'La correction manuelle du stock d\'une station applique bien la valeur saisie.'
    ]
  },
  {
    version: '1.28.3',
    date: '05/07/2026',
    title: 'Déblocage des déclarations',
    items: [
      'Livreur, pompiste et chef d\'équipe peuvent à nouveau déclarer sans blocage.'
    ]
  },
  {
    version: '1.28.2',
    date: '04/07/2026',
    title: 'Espace livreur enrichi',
    items: [
      'Le livreur voit son salaire estimé directement dans son espace.'
    ]
  },
  {
    version: '1.28.0',
    date: '03/07/2026',
    title: 'Permission de livraison individuelle',
    items: [
      'La permission « déclarer une livraison » peut être accordée personne par personne.',
      'v1.28.1 : journalisation du site complétée (ventes, notes de frais, comptabilité, configuration).'
    ]
  },
  {
    version: '1.27.0',
    date: '01/07/2026',
    title: 'Paie livreur revalorisée',
    items: [
      'Paie livreur : 5 000 $ fixe + commission sur ses propres ventes.',
      'Les redistributions d\'essence sont routées vers le salon d\'audit dédié.'
    ]
  },
  {
    version: '1.26.0',
    date: '30/06/2026',
    title: 'Journalisation complète (audit)',
    items: [
      'Toutes les actions en jeu et sur le site sont journalisées vers l\'espace d\'audit du cabinet.'
    ]
  },
  {
    version: '1.25.0',
    date: '28/06/2026',
    title: 'Déclaration de livraison',
    items: [
      'Nouvel onglet Déclaration de livraison ; poste livreur avec paie fixe.'
    ]
  },
  {
    version: '1.24.0',
    date: '27/06/2026',
    title: 'Permissions de stocks par employé',
    items: [
      'La modification des stocks peut être autorisée employé par employé.'
    ]
  },
  {
    version: '1.23.0',
    date: '26/06/2026',
    title: 'Accès supplémentaires par employé',
    items: [
      'Des accès supplémentaires peuvent être accordés individuellement (en plus du rôle).',
      'Périmètres chef d\'équipe et responsable de vente affinés.'
    ]
  },
  {
    version: '1.22.0',
    date: '24/06/2026',
    title: 'Paie hybride et chef d\'équipe',
    items: [
      'Paie du Responsable Ventes en modèle hybride ; création du poste Chef d\'équipe.',
      'Comptabilité : plafonds d\'honoraires comptable appliqués au fichier de déclaration ; paiement d\'impôt exclu de l\'assiette.'
    ]
  }
];
