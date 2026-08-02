#!/usr/bin/env node
/**
 * Task 2.2.3: utilitario de dev para atribuir a custom claim admin:true a
 * um usuario no Auth Emulator. Uso:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npm run set-admin -- <email>
 *
 * Recusa-se a rodar sem FIREBASE_AUTH_EMULATOR_HOST definido, para nunca
 * ser usado por engano contra um projeto Firebase real.
 */
const admin = require("firebase-admin");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: npm run set-admin -- <email>");
    process.exit(1);
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error(
      "FIREBASE_AUTH_EMULATOR_HOST nao esta definido. Rode isto so contra o Auth Emulator, nunca em producao.",
    );
    process.exit(1);
  }

  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "demo-gscandelari-ecommerce-api",
  });

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  const updated = await admin.auth().getUser(user.uid);

  console.log(`OK: ${email} (uid=${user.uid}) agora tem custom claims:`, updated.customClaims);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
