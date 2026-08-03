import { initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

// RN27: este front-end de testes nunca pode se conectar a um projeto
// Firebase real. `demo-` e o prefixo oficial reconhecido pelo Firebase
// Emulator Suite para projetos que nunca alcancam servicos reais - a
// aplicacao recusa inicializar sem ele, em vez de falhar silenciosamente
// contra producao.
if (!projectId || !projectId.startsWith("demo-")) {
  throw new Error(
    `VITE_FIREBASE_PROJECT_ID deve comecar com "demo-" (valor atual: "${projectId ?? ""}"). ` +
      "Este front-end e exclusivo para uso com o Firebase Emulator Suite local (RN27).",
  );
}

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

connectAuthEmulator(
  auth,
  (import.meta.env.VITE_AUTH_EMULATOR_URL as string) || "http://localhost:9099",
  { disableWarnings: true },
);
