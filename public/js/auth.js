// ============================================================
// Authentification — gestion session, rôles, redirections
// ============================================================

import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { getUserDoc, setUserDoc, listUsers } from './api.js';
import { canAccess, defaultLandingPage, ROLES } from './utils/permissions.js';

let currentUser = null;
let currentProfile = null;

// === Création du premier compte (patron / co-patron) ===
// Seuls le patron et le co-patron peuvent s'inscrire eux-mêmes.
// Une fois ces deux comptes créés, l'inscription publique est verrouillée.

export async function inscrireDirection(email, password, prenom, nom, role) {
  if (role !== ROLES.PATRON && role !== ROLES.CO_PATRON) {
    throw new Error('Seuls le Patron et le Co-Patron peuvent s\'inscrire ici.');
  }
  // Vérifier qu'aucun compte avec ce rôle n'existe déjà
  const existants = await listUsers().catch(() => []);
  const dejaPresent = existants.some(u => u.role === role);
  if (dejaPresent) {
    throw new Error(`Un compte ${role} existe déjà. Demande au patron de te créer un compte.`);
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setUserDoc(cred.user.uid, {
    email,
    nom: nom.toUpperCase(),
    prenom,
    role,
    statut: 'actif',
    dateEntree: new Date().toISOString().slice(0, 10),
    creePar: 'auto-inscription'
  });
  return cred.user;
}

// === Création par admin (patron crée des comptes employés) ===
// IMPORTANT : createUserWithEmailAndPassword connecte automatiquement le nouvel
// utilisateur. Pour éviter de déconnecter le patron, on utilise une instance
// Firebase secondaire le temps de la création.

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth as getAuth2 } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

export async function creerCompteEmploye({ email, prenom, nom, idDiscord, idPerso, role, motDePasse, creePar }) {
  const tmpApp = initializeApp(firebaseConfig, 'tmp-auth-' + Date.now());
  const tmpAuth = getAuth2(tmpApp);
  try {
    const cred = await createUserWithEmailAndPassword(tmpAuth, email, motDePasse);
    await setUserDoc(cred.user.uid, {
      email,
      prenom,
      nom: nom.toUpperCase(),
      idDiscord: idDiscord || '',
      idPerso: idPerso || '',
      role,
      statut: 'actif',
      dateEntree: new Date().toISOString().slice(0, 10),
      creePar: creePar || '',
      motDePasseProvisoire: true
    });
    await signOut(tmpAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(tmpApp);
  }
}

// === Connexion ===
export async function connecter(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function deconnecter() {
  await signOut(auth);
  window.location.href = 'index.html';
}

export async function envoyerResetMotDePasse(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function changerMotDePasse(nouveauMdp) {
  if (!auth.currentUser) throw new Error('Pas connecté.');
  await updatePassword(auth.currentUser, nouveauMdp);
  await setUserDoc(auth.currentUser.uid, { motDePasseProvisoire: false });
}

// === Mot de passe provisoire généré ===
export function genererMotDePasseProvisoire(length = 12) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ!@#';
  let p = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) p += chars[arr[i] % chars.length];
  return p;
}

// === Garde de page : redirige si non autorisé ===
export function requireAuth(pageKey) {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }
      const profile = await getUserDoc(user.uid);
      if (!profile) {
        window.location.href = 'index.html';
        return;
      }
      if (profile.statut === 'suspendu') {
        alert('Votre compte est suspendu. Contactez la direction.');
        await signOut(auth);
        window.location.href = 'index.html';
        return;
      }
      currentUser = user;
      currentProfile = profile;

      if (pageKey && !canAccess(profile.role, pageKey)) {
        alert("Accès refusé pour ce module.");
        window.location.href = defaultLandingPage(profile.role);
        return;
      }

      resolve({ user, profile });
    });
  });
}

export function getCurrentUser()    { return currentUser; }
export function getCurrentProfile() { return currentProfile; }
