import { getAdminApp } from "@/firebaseAdmin";
import { Pedido, PedidoInput } from "@/models/pedido";

const COLLECTION = "pedidos";

export function pedidosCollection(): FirebaseFirestore.CollectionReference {
  return getAdminApp().firestore().collection(COLLECTION);
}

export async function getPedido(id: string): Promise<Pedido | undefined> {
  const snap = await pedidosCollection().doc(id).get();
  if (!snap.exists) return undefined;
  return { id: snap.id, ...(snap.data() as PedidoInput) };
}

/**
 * RN08: sem clienteId, lista todos os pedidos (uso do Admin). Com
 * clienteId, filtra para os pedidos do proprio cliente.
 */
export async function listPedidos(clienteId?: string): Promise<Pedido[]> {
  const query = clienteId
    ? pedidosCollection().where("clienteId", "==", clienteId)
    : pedidosCollection();
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as PedidoInput) }));
}
