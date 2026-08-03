import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getAdminApp } from "@/firebaseAdmin";
import { getResendClient } from "@/resendClient";

interface PedidoDoc {
  clienteId: string;
  status: string;
  total: number;
}

const EMAIL_FROM = process.env.NOTIFICATIONS_FROM_EMAIL ?? "onboarding@resend.dev";

/**
 * RN19: reage de forma assincrona (fire-and-forget) a mudancas de status em
 * `pedidos`, enviando um e-mail (Resend, sempre modo sandbox) ao cliente
 * dono quando o status transiciona para `confirmado` ou `cancelado`. So
 * dispara em transicao REAL de status (Decisao tecnica 5) - um update que
 * so grava paymentIntentId, por exemplo, nao deve reenviar e-mail. Clausula
 * best-effort: qualquer falha (Resend indisponivel, cliente sem e-mail no
 * Auth) e logada, nunca propagada - a transicao de status ja foi efetivada
 * por Orders antes deste trigger disparar, e nunca e revertida por causa de
 * uma notificacao que falhou.
 */
export const onPedidoStatusChange = onDocumentUpdated(
  { document: "pedidos/{pedidoId}", secrets: ["RESEND_API_KEY"] },
  async (event) => {
    const before = event.data?.before.data() as PedidoDoc | undefined;
    const after = event.data?.after.data() as PedidoDoc | undefined;

    if (!before || !after) return;
    if (before.status === after.status) return;
    if (after.status !== "confirmado" && after.status !== "cancelado") return;

    try {
      const user = await getAdminApp().auth().getUser(after.clienteId);
      if (!user.email) return;

      const assunto =
        after.status === "confirmado" ? "Seu pedido foi confirmado!" : "Seu pedido foi cancelado";

      await getResendClient().emails.send({
        from: EMAIL_FROM,
        to: user.email,
        subject: assunto,
        text: `Ola! Seu pedido no valor de R$ ${after.total.toFixed(2)} agora esta "${after.status}".`,
      });
    } catch (err) {
      console.error("Falha ao enviar notificacao de pedido (best-effort, nao bloqueia nada):", err);
    }
  },
);
