// ============================================================
// Configuration Firebase — À COMPLÉTER avec votre projet
// ============================================================
// Voir docs/01-setup-firebase.md pour obtenir ces valeurs.
// Remplacer les valeurs ci-dessous puis push sur l'hebergement.
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey:            'AIzaSyA2A_zJZ8NeZO8Hbvp4TBJSFlhKxy7fgxI',
  authDomain:        'ltd-sandy-shores-f3919.firebaseapp.com',
  projectId:         'ltd-sandy-shores-f3919',
  storageBucket:     'ltd-sandy-shores-f3919.firebasestorage.app',
  messagingSenderId: '1070326769058',
  appId:             '1:1070326769058:web:7da605199cb39c4b38befb'
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => { /* multi-tab non critique */ });
