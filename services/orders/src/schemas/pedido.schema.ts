import { z } from "zod";

export const criarPedidoSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1, "produtoId e obrigatorio"),
        quantidade: z
          .number()
          .int("quantidade deve ser um numero inteiro")
          .positive("quantidade deve ser > 0"),
      }),
    )
    .min(1, "pedido deve ter ao menos um item"),
});

export const alterarStatusSchema = z.object({
  status: z.enum([
    "pendente",
    "confirmado",
    "enviado",
    "entregue",
    "aguardando_devolucao",
    "cancelado",
  ]),
});

export type CriarPedidoPayload = z.infer<typeof criarPedidoSchema>;
