// Retire jerrican + ajoute mastic-carrosserie dans Firestore (collection produits).
// One-shot, conserve l'historique des mouvements (on supprime juste le doc produit).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

// 1. Suppression jerrican (si existe)
const jerRef = db.collection('produits').doc('jerrican');
const jer = await jerRef.get();
if (jer.exists) {
  console.log('Suppression du jerrican (stock actuel:', jer.data().stock || 0, ')');
  await jerRef.delete();
} else {
  console.log('jerrican absent — rien a supprimer');
}

// 2. Ajout mastic-carrosserie (si absent)
const mastRef = db.collection('produits').doc('mastic-carrosserie');
const mast = await mastRef.get();
if (!mast.exists) {
  console.log('Ajout du mastic-carrosserie (placeholders a completer)');
  await mastRef.set({
    nom: 'Mastic carrosserie',
    categorie: 'auto',
    prixAchat: 0,
    prixVente: 0,
    pourPro: false,
    enFabrication: true,
    stock: 0,
    seuilAlerte: 5,
    note: 'Prix de vente et recette a completer par le patron.'
  });
} else {
  console.log('mastic-carrosserie deja present — pas de modification');
}

console.log('OK');
process.exit(0);
