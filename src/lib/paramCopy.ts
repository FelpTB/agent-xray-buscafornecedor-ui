/** Textos da tela de parâmetros — linguagem de compras, sem jargão de vetores. */

export type ParamMeta = { label: string; hint: string };

const PRODUTOS: ParamMeta = {
  label: "Produtos",
  hint: "O item que você quer cotar — o que sai da fábrica ou do estoque. Suba este peso se o critério for achar quem realmente vende esse produto, e não só uma empresa do mesmo ramo.",
};

const SERVICOS: ParamMeta = {
  label: "Serviços",
  hint: "A execução que você precisa (instalação, manutenção, logística, operação). Suba este peso quando o que importa é quem faz o serviço, não quem apenas revende o material.",
};

const DESCRICAO: ParamMeta = {
  label: "Descrição da empresa",
  hint: "Como o fornecedor se apresenta: especialidades, processos e diferenciais. Útil quando o nome do produto é genérico e você precisa de um perfil mais técnico ou de nicho.",
};

const PUBLICO: ParamMeta = {
  label: "Público alvo",
  hint: "Para quem a empresa costuma vender — indústria, hospitais, condomínios, varejo. Ajuste para priorizar quem já atende o tipo de operação da sua compra.",
};

const CLIENTES: ParamMeta = {
  label: "Clientes típicos",
  hint: "O porte e o segmento de quem a empresa já atende. Ajuda a achar fornecedor acostumado com contas parecidas com a sua, não só com o produto certo.",
};

const PALAVRAS: ParamMeta = {
  label: "Palavras-chave",
  hint: "Termos que devem aparecer no cadastro: marca, norma, material, SKU. Use para exigir “epóxi”, “inox 316” ou “ISO 9001” — não vale só parecer com o pedido.",
};

export const VECTOR_META: Record<string, ParamMeta> = {
  produto: PRODUTOS,
  v_produto: PRODUTOS,
  servico: SERVICOS,
  v_servico: SERVICOS,
  descricao: DESCRICAO,
  v_descricao: DESCRICAO,
  publico: PUBLICO,
  v_publico: PUBLICO,
  cliente: CLIENTES,
  v_cliente: CLIENTES,
  clientes: CLIENTES,
  bm25: PALAVRAS,
};

export const VECTOR_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(VECTOR_META).map(([key, meta]) => [key, meta.label]),
);

export const PARAM_HINTS = {
  query:
    "O pedido que a busca usou. Edite se o assistente entendeu outra necessidade — daqui sai a lista de fornecedores.",
  city:
    "Município de referência da cotação. A lista inclui cidades vizinhas conforme o raio, para não perder um bom fornecedor logo ao lado.",
  uf:
    "Estados em que o fornecedor pode estar. Sem cidade, qualquer município desses estados pode aparecer na lista.",
  radius:
    "Distância a partir da cidade. Aumente se a lista local estiver curta; diminua se frete, visita técnica ou prazo de entrega forem o gargalo.",
  modelo:
    "O elo da cadeia que você quer cotar: quem fabrica, quem distribui, atacado, varejo ou quem presta o serviço.",
  keywords:
    "Palavras que precisam estar no perfil do fornecedor. Bom para norma, marca ou material específico. Sem elas, a busca compara o sentido geral do pedido.",
  keywordsWeight:
    "Quanto a lista privilegia quem tem essas palavras no cadastro. Trave o cadeado se quiser manter este percentual enquanto ajusta os outros.",
  weights:
    "O peso total da busca deve ser 100%. Aumentar ou diminuir um dos pesos faz os outros se ajustarem proporcionalmente. O cadeado trava um critério no valor atual.",
  lock: "Trava este peso no valor atual. Os demais continuam se ajustando entre si até somar 100%.",
  limit:
    "Quantos nomes entram nesta shortlist. Use 5 a 8 para cotar rápido; 15 a 20 para mapear o mercado antes de fechar a lista.",
} as const;

export function vectorLabel(key: string): string {
  return VECTOR_META[key]?.label || key;
}

export function vectorHint(key: string): string {
  return VECTOR_META[key]?.hint || "";
}
