/**
 * Enveloppe locale de « firebase-admin/auth » — LTD Sandy Shores.
 *
 * Le shim partage (BLA-Corporate/cloudflare/shim/firebase-auth.js) expose
 * `auth()` mais pas l'export nomme `getAuth`, la forme qu'importe index.js LTD
 * (`import { getAuth } from 'firebase-admin/auth'`). On l'ajoute ICI plutot que
 * dans le shim partage : celui-ci est valide en production sur le Worker BLA
 * (83 verifications) et n'a pas a bouger pour un besoin propre a LTD.
 */

'use strict';

const authShim = require('../../../cloudflare/shim/firebase-auth.js');

module.exports = Object.assign({}, authShim, {
  // getAuth(app?) — l'argument est ignore, comme initializeApp() du shim.
  getAuth: function () { return authShim.auth(); }
});
