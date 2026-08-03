import { getAdminApp } from "@/firebaseAdmin";

const COLLECTION = "stripeEvents";

function stripeEventsCollection(): FirebaseFirestore.CollectionReference {
  return getAdminApp().firestore().collection(COLLECTION);
}

/** RN14: usa o proprio event.id do Stripe como ID do documento (lookup direto). */
export async function jaProcessado(eventId: string): Promise<boolean> {
  const snap = await stripeEventsCollection().doc(eventId).get();
  return snap.exists;
}

export async function registrarEventoProcessado(eventId: string, type: string): Promise<void> {
  await stripeEventsCollection().doc(eventId).set({
    eventId,
    type,
    processedAt: new Date(),
  });
}
