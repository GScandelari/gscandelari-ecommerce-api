import { getAdminApp } from "@/firebaseAdmin";
import { Produto, ProdutoInput } from "@/models/produto";

const COLLECTION = "produtos";

export function produtosCollection(): FirebaseFirestore.CollectionReference {
  return getAdminApp().firestore().collection(COLLECTION);
}

export async function createProduto(data: ProdutoInput): Promise<Produto> {
  const ref = await produtosCollection().add(data);
  return { id: ref.id, ...data };
}

export async function getProduto(id: string): Promise<Produto | undefined> {
  const snap = await produtosCollection().doc(id).get();
  if (!snap.exists) return undefined;
  return { id: snap.id, ...(snap.data() as ProdutoInput) };
}

export async function listProdutos(): Promise<Produto[]> {
  const snap = await produtosCollection().get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProdutoInput) }));
}

export async function updateProduto(id: string, data: ProdutoInput): Promise<Produto | undefined> {
  const ref = produtosCollection().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return undefined;
  await ref.set(data);
  return { id, ...data };
}

export async function deleteProduto(id: string): Promise<boolean> {
  const ref = produtosCollection().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}
