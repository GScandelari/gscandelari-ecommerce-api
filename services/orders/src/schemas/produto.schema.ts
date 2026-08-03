import { z } from "zod";

export const produtoSchema = z.object({
  nome: z.string().trim().min(1, "nome e obrigatorio"),
  preco: z.number().positive("preco deve ser maior que zero"),
  estoque: z
    .number()
    .int("estoque deve ser um numero inteiro")
    .nonnegative("estoque deve ser >= 0"),
});

export type ProdutoPayload = z.infer<typeof produtoSchema>;
