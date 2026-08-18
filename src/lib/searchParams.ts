import type { SearchSnapshot } from "./searchExplain";

export const MODELO_NEGOCIO_OPTIONS = [
  "Fabricante",
  "Distribuidor",
  "Atacado",
  "Varejo",
  "Prestador de Serviço",
] as const;

export const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const DEFAULT_DIMENSION_KEYS = ["produto", "servico", "descricao", "publico", "cliente"];

export const VECTOR_LABELS: Record<string, string> = {
  produto: "O que a empresa vende",
  v_produto: "O que a empresa vende",
  servico: "Serviço prestado",
  v_servico: "Serviço prestado",
  descricao: "Descrição da empresa",
  v_descricao: "Descrição da empresa",
  publico: "Para quem vende",
  v_publico: "Para quem vende",
  cliente: "Clientes típicos",
  v_cliente: "Clientes típicos",
  clientes: "Clientes típicos",
  bm25: "Palavras no cadastro",
};

export type SearchParamsDraft = {
  query: string;
  city: string;
  ufs: string[];
  radiusKm: number | "";
  modeloNegocio: string;
  keywords: string[];
  queries: Record<string, string>;
  weights: Record<string, number>;
  exactTerms: string[];
  intent: string | null;
};

export type SearchParamsPayload = {
  query: string;
  queries: Record<string, string>;
  weights: Record<string, number>;
  city_name?: string;
  uf?: string;
  radius_km?: number;
  modelo_negocio?: string;
  bm25_query?: string;
  bm25?: boolean;
  exact_terms?: string[];
  intent?: string;
};

function asList(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const s = String(value).trim();
  if (!s) return [];
  if (s.includes(",")) return s.split(",").map((p) => p.trim()).filter(Boolean);
  return [s];
}

function firstString(value: unknown): string {
  const list = asList(value);
  return list[0] || "";
}

function parseKeywords(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return uniqueTerms(raw.flatMap((v) => parseKeywords(v)));
  }
  const s = String(raw).trim();
  if (!s) return [];
  return uniqueTerms(
    s
      .split(/[,;|/]+|\s+/)
      .map((p) => p.trim())
      .filter(Boolean),
  );
}

function uniqueTerms(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function parseUfs(value: unknown): string[] {
  const raw = asList(value).flatMap((part) => part.split(/[\s,;/|]+/));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw) {
    const u = part.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export function emptyDraft(dimensionKeys: string[] = DEFAULT_DIMENSION_KEYS): SearchParamsDraft {
  const keys = dimensionKeys.length ? dimensionKeys : DEFAULT_DIMENSION_KEYS;
  const queries: Record<string, string> = {};
  const weights: Record<string, number> = {};
  const eq = 1 / keys.length;
  for (const k of keys) {
    queries[k] = "";
    weights[k] = eq;
  }
  return {
    query: "",
    city: "",
    ufs: [],
    radiusKm: "",
    modeloNegocio: "",
    keywords: [],
    queries,
    weights: renormalizeWeights(weights),
    exactTerms: [],
    intent: null,
  };
}

export function draftFromSnapshot(
  snap: SearchSnapshot | null,
  dimensionKeys: string[] = DEFAULT_DIMENSION_KEYS,
): SearchParamsDraft {
  const base = emptyDraft(dimensionKeys);
  if (!snap) return base;

  const args = snap.args || {};
  const qm = snap.queryManager;
  const geo = snap.geo || {};
  const filter = args.filter && typeof args.filter === "object" ? args.filter : {};
  const keys = dimensionKeys.length ? dimensionKeys : DEFAULT_DIMENSION_KEYS;

  const incomingQueries = args.queries && typeof args.queries === "object" ? args.queries : {};
  const queries: Record<string, string> = { ...base.queries };
  for (const k of keys) {
    const fromArgs = incomingQueries[k];
    if (typeof fromArgs === "string" && fromArgs.trim()) {
      queries[k] = fromArgs.trim();
      continue;
    }
    if (k.includes("produt")) queries[k] = String(qm?.produtos || queries[k] || "");
    else if (k.includes("servic")) queries[k] = String(qm?.servicos || queries[k] || "");
    else if (k.includes("descric")) queries[k] = String(qm?.descricao || queries[k] || "");
    else if (k.includes("public")) queries[k] = String(qm?.publico || queries[k] || "");
    else if (k.includes("client")) {
      queries[k] = String(qm?.clientes || incomingQueries.cliente || incomingQueries.clientes || "");
    }
  }

  const cityFromFilter = typeof filter.cidade === "string" ? filter.cidade : asList(filter.cidade)[0];
  const city =
    geo.city_name ||
    geo.city ||
    cityFromFilter ||
    qm?.cidade_centro ||
    "";

  const ufs = parseUfs(geo.ufs?.length ? geo.ufs : geo.uf || filter.uf || qm?.ufs || qm?.uf);
  const radiusRaw = geo.radius_km ?? qm?.radius_km;
  const radiusKm =
    typeof radiusRaw === "number" && Number.isFinite(radiusRaw)
      ? radiusRaw
      : city
        ? 50
        : "";

  const modeloRaw = firstString(filter.modelo_negocio || qm?.Modelo_Negocio);
  const modelo =
    MODELO_NEGOCIO_OPTIONS.find((m) => m.toLowerCase() === modeloRaw.toLowerCase()) ||
    modeloRaw;
  const keywords = parseKeywords(
    args.bm25_query || (typeof qm?.bm25 === "string" ? qm.bm25 : ""),
  );
  const incomingWeights = args.weights && typeof args.weights === "object" ? args.weights : {};
  let weights: Record<string, number> = {};
  for (const k of keys) {
    const v = Number(incomingWeights[k]);
    weights[k] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  if (keywords.length) {
    const bm = Number(incomingWeights.bm25);
    weights.bm25 = Number.isFinite(bm) && bm >= 0 ? bm : 0.2;
  }

  return {
    query: String(snap.query || args.query || qm?.query_original || ""),
    city: String(city || ""),
    ufs,
    radiusKm,
    modeloNegocio: modelo,
    keywords,
    queries,
    weights: renormalizeWeights(weights),
    exactTerms: asList(args.exact_terms || qm?.exact_terms),
    intent: snap.intent || qm?.intent || null,
  };
}

export function draftToPayload(draft: SearchParamsDraft, dimensionKeys: string[]): SearchParamsPayload {
  const keys = dimensionKeys.length ? dimensionKeys : DEFAULT_DIMENSION_KEYS;
  const queries: Record<string, string> = {};
  for (const k of keys) {
    const t = (draft.queries[k] || "").trim();
    if (t) queries[k] = t;
  }

  const hasKeywords = draft.keywords.length > 0;
  const weightSource: Record<string, number> = {};
  for (const k of keys) weightSource[k] = Number(draft.weights[k]) || 0;
  if (hasKeywords) weightSource.bm25 = Number(draft.weights.bm25) || 0;
  const weights = renormalizeWeights(weightSource);

  const payload: SearchParamsPayload = {
    query: draft.query.trim(),
    queries,
    weights,
  };

  const city = draft.city.trim();
  const ufs = parseUfs(draft.ufs);
  if (city) {
    payload.city_name = city;
    payload.radius_km = draft.radiusKm === "" ? 0 : Number(draft.radiusKm) || 0;
  }
  if (ufs.length) payload.uf = ufs.join(",");
  if (draft.modeloNegocio.trim()) payload.modelo_negocio = draft.modeloNegocio.trim();
  if (hasKeywords) {
    payload.bm25_query = draft.keywords.join(" ");
  } else {
    payload.bm25 = false;
  }
  if (draft.exactTerms.length) payload.exact_terms = draft.exactTerms;
  if (draft.intent) payload.intent = draft.intent;
  return payload;
}

export function weightSum(weights: Record<string, number>): number {
  return Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function renormalizeWeights(weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights);
  if (!keys.length) return weights;
  const out: Record<string, number> = {};
  const sum = keys.reduce((a, k) => a + Math.max(0, Number(weights[k]) || 0), 0);
  if (sum <= 0) {
    const eq = Number((1 / keys.length).toFixed(4));
    for (const k of keys) out[k] = eq;
  } else {
    for (const k of keys) out[k] = Number((Math.max(0, Number(weights[k]) || 0) / sum).toFixed(4));
  }
  const fixed = keys.reduce((a, k) => a + out[k], 0);
  out[keys[0]] = Number((out[keys[0]] + (1 - fixed)).toFixed(4));
  if (out[keys[0]] < 0) out[keys[0]] = 0;
  return out;
}

/** Altera um peso e redistribui o restante para a soma permanecer 1. */
export function adjustWeight(
  weights: Record<string, number>,
  key: string,
  next: number,
): Record<string, number> {
  const keys = Object.keys(weights);
  if (!keys.includes(key)) return weights;
  const clamped = Math.min(1, Math.max(0, Number(next) || 0));
  const others = keys.filter((k) => k !== key);
  const rest = 1 - clamped;
  const out: Record<string, number> = { ...weights, [key]: Number(clamped.toFixed(4)) };
  if (!others.length) return { [key]: 1 };
  const othersSum = others.reduce((s, k) => s + (Number(weights[k]) || 0), 0);
  if (othersSum <= 0) {
    const each = Number((rest / others.length).toFixed(4));
    for (const k of others) out[k] = each;
  } else {
    const scale = rest / othersSum;
    for (const k of others) out[k] = Number(((Number(weights[k]) || 0) * scale).toFixed(4));
  }
  const sum = Object.values(out).reduce((a, b) => a + b, 0);
  out[key] = Number((out[key] + (1 - sum)).toFixed(4));
  if (out[key] < 0) out[key] = 0;
  return out;
}

export function setKeywordsOnDraft(draft: SearchParamsDraft, keywords: string[]): SearchParamsDraft {
  const hadBm25 = Object.prototype.hasOwnProperty.call(draft.weights, "bm25");
  const next = { ...draft, keywords };
  if (keywords.length && !hadBm25) {
    const dense = { ...draft.weights };
    delete dense.bm25;
    next.weights = adjustWeight({ ...dense, bm25: 0 }, "bm25", 0.2);
  } else if (!keywords.length && hadBm25) {
    const dense = { ...draft.weights };
    delete dense.bm25;
    next.weights = renormalizeWeights(dense);
  }
  return next;
}

export function vectorLabel(key: string): string {
  return VECTOR_LABELS[key] || key;
}
