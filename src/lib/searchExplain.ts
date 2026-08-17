/** Traduz o contrato técnico da busca (tool args + Query Manager + geo) para o comprador. */

export type SearchArgs = {
  query?: string;
  queries?: Record<string, string>;
  weights?: Record<string, number>;
  filter?: Record<string, unknown>;
  filter_not?: Record<string, unknown>;
  bm25?: boolean;
  bm25_query?: string;
  exact_terms?: string[] | string;
  final_limit?: number;
  rerank?: boolean;
};

export type QueryManager = {
  query_original?: string | null;
  intent?: string | null;
  produtos?: string | null;
  servicos?: string | null;
  descricao?: string | null;
  publico?: string | null;
  clientes?: string | null;
  bm25?: string | null;
  exact_terms?: string[] | null;
  use_bm25?: boolean;
  Modelo_Negocio?: string | null;
  cidade_centro?: string | null;
  uf?: string | string[] | null;
  ufs?: string[] | null;
  radius_km?: number | null;
};

export type GeoInfo = {
  city?: string;
  city_name?: string;
  cities?: number;
  cities_in_filter?: number;
  city_names_sample?: string[];
  radius_km?: number;
  uf?: string | string[] | null;
  ufs?: string[] | null;
  scope?: string | null;
};

export type SearchSnapshot = {
  query?: string | null;
  intent?: string | null;
  args: SearchArgs;
  queryManager?: QueryManager | null;
  geo?: GeoInfo | null;
  fallback?: { stages?: Array<{ name?: string }> } | boolean | null;
  resultCount?: number;
  searchId?: string | null;
};

export type ExplainedFact = {
  id: string;
  title: string;
  value: string;
  hint: string;
};

const WEIGHT_LABELS: Record<string, { title: string; hint: string }> = {
  produto: {
    title: "O que a empresa vende",
    hint: "Quanto a busca priorizou o catálogo de produtos do fornecedor.",
  },
  v_produto: {
    title: "O que a empresa vende",
    hint: "Quanto a busca priorizou o catálogo de produtos do fornecedor.",
  },
  servico: {
    title: "Serviço prestado",
    hint: "Quanto a busca priorizou o tipo de serviço que a empresa executa.",
  },
  v_servico: {
    title: "Serviço prestado",
    hint: "Quanto a busca priorizou o tipo de serviço que a empresa executa.",
  },
  descricao: {
    title: "Descrição da empresa",
    hint: "Quanto pesou o texto geral do cadastro (o que a empresa diz sobre si).",
  },
  v_descricao: {
    title: "Descrição da empresa",
    hint: "Quanto pesou o texto geral do cadastro (o que a empresa diz sobre si).",
  },
  publico: {
    title: "Para quem vende",
    hint: "Quanto pesou o público-alvo do fornecedor (indústrias, condomínios, hospitais…).",
  },
  v_publico: {
    title: "Para quem vende",
    hint: "Quanto pesou o público-alvo do fornecedor (indústrias, condomínios, hospitais…).",
  },
  cliente: {
    title: "Clientes típicos",
    hint: "Quanto pesou o perfil de clientes que a empresa já atende.",
  },
  v_cliente: {
    title: "Clientes típicos",
    hint: "Quanto pesou o perfil de clientes que a empresa já atende.",
  },
  clientes: {
    title: "Clientes típicos",
    hint: "Quanto pesou o perfil de clientes que a empresa já atende.",
  },
  bm25: {
    title: "Palavras no cadastro",
    hint: "Quanto pesou achar as palavras-chave exatamente no texto do perfil — útil quando o termo é específico.",
  },
};

function asList(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map((p) => p.trim()).filter(Boolean);
  return [s];
}

function formatList(items: string[], max = 8): string {
  if (!items.length) return "";
  if (items.length <= max) {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} e ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
  }
  const shown = items.slice(0, max).join(", ");
  return `${shown} e mais ${items.length - max}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function intentCopy(intent: string | null | undefined): { value: string; hint: string } | null {
  const t = String(intent || "").toUpperCase();
  if (t === "PRODUTO") {
    return {
      value: "Produto",
      hint: "A busca entendeu que você quer comprar um item (algo que se entrega), e deu mais atenção a empresas que vendem esse tipo de produto.",
    };
  }
  if (t === "SERVICO") {
    return {
      value: "Serviço",
      hint: "A busca entendeu que você quer contratar uma execução (mão de obra, instalação, manutenção) e priorizou empresas prestadoras.",
    };
  }
  if (t === "MISTO") {
    return {
      value: "Produto e serviço juntos",
      hint: "Sua necessidade mistura as duas coisas (por exemplo equipamento + instalação). A busca equilibrou os dois lados.",
    };
  }
  return null;
}

function scopeCopy(scope: string | null | undefined): string | null {
  const s = String(scope || "").toLowerCase();
  if (s === "nacional") return "Todo o Brasil (sem recorte de estado ou cidade)";
  if (s === "uf") return "Somente o estado (sem limitar a uma cidade)";
  return null;
}

export function snapshotFromChat(data: {
  intent?: string | null;
  mcp_tool_call?: { arguments?: Record<string, unknown> } | null;
  query_manager?: Record<string, unknown> | null;
  geo?: Record<string, unknown> | null;
  fallback?: unknown;
  search?: { search_id?: string; results?: unknown[] } | null;
}): SearchSnapshot | null {
  const args = (data.mcp_tool_call?.arguments || {}) as SearchArgs;
  const hasSearch = Boolean(data.search?.search_id || data.search?.results?.length || args.query);
  if (!hasSearch && !data.query_manager && !data.geo) return null;
  return {
    query: args.query || (data.query_manager?.query_original as string) || null,
    intent: data.intent || (data.query_manager?.intent as string) || null,
    args,
    queryManager: (data.query_manager as QueryManager) || null,
    geo: (data.geo as GeoInfo) || null,
    fallback: (data.fallback as SearchSnapshot["fallback"]) ?? null,
    resultCount: Array.isArray(data.search?.results) ? data.search.results.length : undefined,
    searchId: data.search?.search_id || null,
  };
}

export function snapshotFromConsulta(row: {
  parametros?: Record<string, unknown> | null;
  v_produto?: string | null;
  v_servico?: string | null;
  v_descricao?: string | null;
  v_publico?: string | null;
  v_cliente?: string | null;
  bm_25?: string | null;
  uf?: unknown;
  municipio?: unknown;
  modelo_negocio?: string | null;
  id?: string;
} | null): SearchSnapshot | null {
  if (!row) return null;
  const p = row.parametros && typeof row.parametros === "object" ? row.parametros : {};
  const raw =
    p.raw && typeof p.raw === "object" ? (p.raw as Record<string, unknown>) : {};
  const queries = (raw.queries as Record<string, string> | undefined) || {
    produto: row.v_produto || "",
    servico: row.v_servico || "",
    descricao: row.v_descricao || "",
    publico: row.v_publico || "",
    cliente: row.v_cliente || "",
  };
  const filter = (raw.filter as Record<string, unknown> | undefined) || {};
  const args: SearchArgs = {
    query: (raw.query as string) || (p.descricao as string) || undefined,
    queries,
    weights: (raw.weights as Record<string, number> | undefined) || undefined,
    filter: {
      ...filter,
      uf: filter.uf ?? row.uf ?? p.ufs_selecionadas,
      cidade: filter.cidade ?? row.municipio ?? p.cidade_origem,
      modelo_negocio: filter.modelo_negocio ?? row.modelo_negocio ?? p.modelo_negocio,
    },
    filter_not: (raw.filter_not as Record<string, unknown>) || undefined,
    bm25: Boolean(raw.bm25),
    bm25_query: (raw.bm25_query as string) || row.bm_25 || undefined,
    final_limit: typeof raw.final_limit === "number" ? raw.final_limit : undefined,
    rerank: Boolean(raw.rerank),
  };
  const geo: GeoInfo = {
    city_name: typeof p.cidade_origem === "string" ? p.cidade_origem : undefined,
    radius_km: typeof p.raio_km === "number" ? p.raio_km : undefined,
    ufs: asList(p.ufs_selecionadas ?? row.uf),
    cities_in_filter: asList(row.municipio).length || undefined,
    city_names_sample: asList(row.municipio).slice(0, 12),
    scope: p.tipo_busca === "nacional" ? "nacional" : p.tipo_busca === "uf" ? "uf" : null,
  };
  return {
    query: args.query || null,
    intent: (raw.intent as string) || null,
    args,
    queryManager: null,
    geo,
    fallback: Boolean(raw.fallback),
    searchId: row.id || null,
  };
}

export function explainSearch(snap: SearchSnapshot | null): ExplainedFact[] {
  if (!snap) return [];
  const facts: ExplainedFact[] = [];
  const args = snap.args || {};
  const qm = snap.queryManager;
  const geo = snap.geo || {};
  const filter = args.filter && typeof args.filter === "object" ? args.filter : {};
  const filterNot =
    args.filter_not && typeof args.filter_not === "object" ? args.filter_not : {};

  const query = snap.query || args.query || qm?.query_original;
  if (query) {
    facts.push({
      id: "query",
      title: "Pedido entendido",
      value: String(query),
      hint: "Este é o resumo que o assistente usou como ponto de partida da busca — o que você descreveu, em linguagem de compras.",
    });
  }

  const intent = intentCopy(snap.intent || qm?.intent);
  if (intent) {
    facts.push({
      id: "intent",
      title: "Tipo de necessidade",
      value: intent.value,
      hint: intent.hint,
    });
  }

  const city =
    geo.city_name ||
    geo.city ||
    (typeof filter.cidade === "string" ? filter.cidade : null) ||
    qm?.cidade_centro ||
    null;
  const cities = asList(filter.cidade);
  const cityCount =
    geo.cities_in_filter ||
    geo.cities ||
    (cities.length > 1 ? cities.length : undefined);
  const radius = geo.radius_km ?? qm?.radius_km ?? null;
  const ufs = asList(geo.ufs || geo.uf || filter.uf || qm?.ufs || qm?.uf);
  const scoped = scopeCopy(geo.scope);

  if (city || cityCount) {
    const extra =
      cityCount && cityCount > 1
        ? ` — ${cityCount} municípios no raio`
        : cities.length > 1
          ? ` — ${formatList(cities, 6)}`
          : "";
    const radiusBit =
      typeof radius === "number" && radius > 0
        ? `, até ${radius} km ao redor`
        : typeof radius === "number" && radius === 0
          ? ", somente nessa cidade"
          : "";
    facts.push({
      id: "geo-city",
      title: "Onde (cidade e arredores)",
      value: `${city || "Cidades da região"}${radiusBit}${extra}`,
      hint: "A busca só considera empresas nessas cidades. O raio inclui vizinhas — assim um fornecedor de cidade próxima também aparece.",
    });
  } else if (ufs.length) {
    facts.push({
      id: "geo-uf",
      title: "Onde (estado)",
      value: formatList(ufs.map((u) => u.toUpperCase())),
      hint: "Não há recorte de cidade: qualquer município desses estados pode aparecer. Peça uma cidade se quiser uma lista mais local.",
    });
  } else if (scoped) {
    facts.push({
      id: "geo-scope",
      title: "Onde",
      value: scoped,
      hint: "Sem filtro de localização — a lista pode trazer empresas de qualquer região do país.",
    });
  } else {
    facts.push({
      id: "geo-none",
      title: "Onde",
      value: "Todo o Brasil (sem recorte de cidade ou estado)",
      hint: "Você não limitou a região. Se quiser só um estado ou uma cidade, diga no chat — por exemplo “em Campinas” ou “só em SP”.",
    });
  }

  const modelo = asList(filter.modelo_negocio || qm?.Modelo_Negocio);
  if (modelo.length) {
    facts.push({
      id: "modelo",
      title: "Tipo de empresa",
      value: formatList(modelo),
      hint: "Filtro de modelo de negócio (fabricante, distribuidor, prestador de serviço…). Só entram empresas classificadas assim no cadastro.",
    });
  }

  const nomeEmpresa = asList(filter.nome_empresa);
  if (nomeEmpresa.length) {
    facts.push({
      id: "nome",
      title: "Nome da empresa",
      value: formatList(nomeEmpresa),
      hint: "A busca foi restrita a empresas com esse nome no cadastro.",
    });
  }

  const excludeDesc = asList(filterNot.descricao);
  const excludeCnpj = asList(filterNot.cnpj);
  if (excludeDesc.length) {
    facts.push({
      id: "exclude-text",
      title: "O que ficou de fora",
      value: formatList(excludeDesc),
      hint: "Empresas cujo perfil menciona esses termos foram excluídas, para não misturar com o que você não quer.",
    });
  }
  if (excludeCnpj.length) {
    facts.push({
      id: "exclude-cnpj",
      title: "Empresas já vistas",
      value: `${excludeCnpj.length} CNPJ(s) deixados de fora`,
      hint: "Quando a busca é ampliada (estado ou Brasil), as empresas da lista anterior não se repetem.",
    });
  }

  const exact = asList(args.exact_terms || qm?.exact_terms);
  if (exact.length) {
    facts.push({
      id: "exact",
      title: "Termo que precisa aparecer",
      value: formatList(exact.map((t) => `“${t}”`)),
      hint: "Você pediu um termo exato (aspas). A busca exige que essas palavras estejam no perfil — não vale só “parecer com”.",
    });
  }

  const bm25On = args.bm25 !== false && Boolean(args.bm25_query || qm?.use_bm25 || qm?.bm25);
  const bm25Text = args.bm25_query || (typeof qm?.bm25 === "string" ? qm.bm25 : "");
  if (bm25On && bm25Text) {
    facts.push({
      id: "keywords",
      title: "Palavras-chave no perfil",
      value: String(bm25Text),
      hint: "Além do sentido geral, a busca procura essas palavras no texto do cadastro. Serve para nichos e nomes técnicos (ex.: “epóxi”, “caroço de açaí”).",
    });
  } else {
    facts.push({
      id: "keywords-off",
      title: "Palavras-chave no perfil",
      value: "Desligado nesta busca",
      hint: "A consulta foi tratada como ampla. O assistente comparou o sentido do que você pediu, sem exigir palavras específicas no texto.",
    });
  }

  const queries = args.queries || {};
  const qmTexts: Array<[string, string | null | undefined]> = [
    ["Produto", queries.produto || qm?.produtos],
    ["Serviço", queries.servico || qm?.servicos],
    ["Descrição", queries.descricao || qm?.descricao],
    ["Público", queries.publico || qm?.publico],
    ["Clientes", queries.cliente || queries.clientes || qm?.clientes],
  ];
  const usedTexts = qmTexts.filter(([, v]) => typeof v === "string" && v.trim());
  if (usedTexts.length) {
    facts.push({
      id: "facets",
      title: "Como o pedido foi detalhado",
      value: usedTexts.map(([k, v]) => `${k}: ${String(v).trim()}`).join(" · "),
      hint: "O assistente quebrou sua necessidade em partes (o que se compra, o serviço, para quem). Cada parte ajuda a achar empresas mais parecidas.",
    });
  }

  const weights = args.weights || {};
  const weightEntries = Object.entries(weights)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (weightEntries.length) {
    facts.push({
      id: "weights",
      title: "O que pesou mais na lista",
      value: weightEntries
        .map(([k, v]) => {
          const lab = WEIGHT_LABELS[k]?.title || k;
          return `${lab} ${pct(v)}`;
        })
        .join(" · "),
      hint: "Não é nota da empresa: é a ênfase da busca. Se “o que a empresa vende” está em 45%, a lista privilegia quem oferece o produto certo, mais do que o público ou a descrição.",
    });
  }

  if (typeof args.final_limit === "number") {
    facts.push({
      id: "limit",
      title: "Tamanho da lista",
      value: `Até ${args.final_limit} fornecedores`,
      hint: "Quantidade máxima devolvida nesta consulta. Dá para pedir mais nomes no chat ou ajustar o seletor ao lado.",
    });
  }

  facts.push({
    id: "rerank",
    title: "Reordenação com IA",
    value: args.rerank ? "Ligada" : "Desligada",
    hint: args.rerank
      ? "Depois de achar candidatos, a inteligência artificial releu a lista e colocou no topo quem mais combina com o seu pedido. A resposta pode demorar um pouco mais."
      : "A ordem veio só da busca na base, sem uma segunda leitura da IA. Ligue a opção se quiser priorizar qualidade da lista.",
  });

  const fallbackOn =
    snap.fallback === true ||
    (snap.fallback && typeof snap.fallback === "object" && Array.isArray(snap.fallback.stages));
  if (fallbackOn) {
    const stages =
      snap.fallback && typeof snap.fallback === "object"
        ? snap.fallback.stages?.map((s) => s.name).filter(Boolean)
        : [];
    facts.push({
      id: "fallback",
      title: "Busca ampliada",
      value: stages?.length ? stages.join(" → ") : "A região foi alargada (cidade → estado ou Brasil)",
      hint: "A primeira lista estava curta ou você pediu algo mais geral. O assistente soltou o recorte local e procurou mais longe, sem repetir as empresas já mostradas.",
    });
  }

  if (typeof snap.resultCount === "number") {
    facts.push({
      id: "count",
      title: "Resultado desta rodada",
      value: snap.resultCount === 0 ? "Nenhum fornecedor nesta consulta" : `${snap.resultCount} fornecedor(es) listado(s)`,
      hint: "Quantidade efetivamente devolvida. Se veio vazia, descreva de outro jeito ou peça para ampliar a região.",
    });
  }

  return facts;
}
