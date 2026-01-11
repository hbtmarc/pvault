import { normalizeText } from "./normalizeText";

export type Direction = "income" | "expense";

export type CategorySeed = {
  id: string;
  name: string;
  type: Direction;
  order: number;
};

export const DEFAULT_CATEGORY_SEED: CategorySeed[] = [
  { id: "receitas", name: "Receitas", type: "income", order: 1 },
  { id: "alimentacao", name: "Alimentacao", type: "expense", order: 10 },
  { id: "mercado", name: "Mercado", type: "expense", order: 20 },
  { id: "transporte", name: "Transporte", type: "expense", order: 30 },
  { id: "saude", name: "Saude", type: "expense", order: 40 },
  { id: "assinaturas", name: "Assinaturas", type: "expense", order: 50 },
  { id: "moradia-contas", name: "Moradia/Contas", type: "expense", order: 60 },
  { id: "lazer", name: "Lazer", type: "expense", order: 70 },
  { id: "educacao", name: "Educacao", type: "expense", order: 80 },
  { id: "transferencias", name: "Transferencias", type: "expense", order: 90 },
  { id: "ajustes-saldo", name: "Ajustes/Saldo", type: "expense", order: 100 },
  { id: "outros", name: "Outros", type: "expense", order: 110 },
];

export type CategorizationResult = {
  categoryKey?: string;
  confidence: number;
  matchedRule?: string;
};

type CategorizationRule = {
  id: string;
  categoryKey: string;
  keywords: string[];
  kind?: Direction;
  confidence: number;
};

const RULES: CategorizationRule[] = [
  {
    id: "food.delivery",
    categoryKey: "alimentacao",
    keywords: ["ifood", "delivery", "restaurante", "lanchonete", "burger", "chefs"],
    kind: "expense",
    confidence: 0.85,
  },
  {
    id: "market.grocery",
    categoryKey: "mercado",
    keywords: ["supermercado", "mercado", "atacadao", "carrefour", "extra"],
    kind: "expense",
    confidence: 0.85,
  },
  {
    id: "transport.ride",
    categoryKey: "transporte",
    keywords: ["uber", "99", "posto", "gasolina", "estacionamento"],
    kind: "expense",
    confidence: 0.85,
  },
  {
    id: "health.care",
    categoryKey: "saude",
    keywords: ["drogaria", "farmacia", "hospital", "clinica", "laboratorio"],
    kind: "expense",
    confidence: 0.8,
  },
  {
    id: "subscriptions.digital",
    categoryKey: "assinaturas",
    keywords: ["netflix", "spotify", "adobe", "google", "microsoft", "prime"],
    kind: "expense",
    confidence: 0.8,
  },
  {
    id: "home.utilities",
    categoryKey: "moradia-contas",
    keywords: ["aluguel", "condominio", "energia", "agua", "luz", "telefone", "internet"],
    kind: "expense",
    confidence: 0.75,
  },
  {
    id: "leisure.fun",
    categoryKey: "lazer",
    keywords: ["cinema", "show", "ingresso", "parque", "viagem", "hotel"],
    kind: "expense",
    confidence: 0.7,
  },
  {
    id: "education.learning",
    categoryKey: "educacao",
    keywords: ["escola", "faculdade", "curso", "educacao", "udemy", "alura"],
    kind: "expense",
    confidence: 0.7,
  },
  {
    id: "transfer.out",
    categoryKey: "transferencias",
    keywords: ["pix enviado", "transferencia enviada", "ted enviado", "doc enviado"],
    kind: "expense",
    confidence: 0.9,
  },
  {
    id: "income.received",
    categoryKey: "receitas",
    keywords: ["pix recebido", "salario", "proventos", "ted recebido", "doc recebido"],
    kind: "income",
    confidence: 0.95,
  },
  {
    id: "balance.adjustment",
    categoryKey: "ajustes-saldo",
    keywords: ["saldo anterior", "saldo"],
    kind: "expense",
    confidence: 0.4,
  },
];

export const categorizeTransaction = (
  description: string | undefined,
  extra: string | undefined,
  _amountCents: number,
  kind: Direction
): CategorizationResult => {
  const text = normalizeText([description, extra].filter(Boolean).join(" "));
  if (!text) {
    return { confidence: 0 };
  }

  for (const rule of RULES) {
    if (rule.kind && rule.kind !== kind) {
      continue;
    }
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return {
        categoryKey: rule.categoryKey,
        confidence: rule.confidence,
        matchedRule: rule.id,
      };
    }
  }

  return { confidence: 0 };
};
