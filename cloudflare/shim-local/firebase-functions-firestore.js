/**
 * Faux module « firebase-functions/v2/firestore » — LTD Sandy Shores.
 *
 * POURQUOI CE FICHIER EXISTE. index.js importe onDocumentCreated et
 * onDocumentWritten en tete de module. Sans cette substitution, la construction
 * echoue ; avec un export absent, l'appel au chargement du module planterait
 * tout le Worker. On rend donc le handler lui-meme, marque `_type: 'firestore'`,
 * et le routeur du Worker l'ignore.
 *
 * CES DECLENCHEURS SONT INERTES, ET C'EST ASSUME. Un Worker Cloudflare n'a
 * aucun moyen d'ecouter les ecritures Firestore (l'API REST ne diffuse pas).
 * Les six fonctions concernees (alerteStock, alerteStation, alerteVenteSansStock,
 * notifyDeclarationDiscord, onAvertissementChange, onMouvementStockCreated) ne
 * tournent donc PLUS tant que le code vit sur Cloudflare. C'est documente dans
 * DEPLOIEMENT.md — ne pas chercher ici une panne : c'est une limite d'hebergement.
 */

'use strict';

function fabrique(nom) {
  return function (a, b) {
    const handler = (typeof a === 'function') ? a : b;
    const options = (typeof a === 'function') ? {} : (a || {});
    if (typeof handler !== 'function') {
      throw new TypeError(nom + ' : handler manquant');
    }
    try {
      Object.defineProperty(handler, '_options', { value: options, enumerable: false, configurable: true });
      Object.defineProperty(handler, '_type', { value: 'firestore', enumerable: false, configurable: true });
    } catch (e) { /* fonction gelee : sans importance */ }
    return handler;
  };
}

module.exports = {
  onDocumentCreated: fabrique('onDocumentCreated'),
  onDocumentWritten: fabrique('onDocumentWritten'),
  onDocumentUpdated: fabrique('onDocumentUpdated'),
  onDocumentDeleted: fabrique('onDocumentDeleted')
};
