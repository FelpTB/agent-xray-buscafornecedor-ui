import type { SearchSnapshot } from "./searchExplain";

export { VECTOR_LABELS, vectorLabel } from "./paramCopy";

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

export type SearchParamsDraft = {
  query: string;
  city: string;
  ufs: string[];
  radiusKm: number | "";
  modeloNegocio: string;
  keywords: string[];
  queries: Record<string, string>;
  weights: Record<string, number>;
  lockedWeights: string[];
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
  empty_vectors?: EmptyVectors;
};

/** Critérios em branco: "ignore" ficam de fora da busca; "query" usam o pedido entendido. */
export type EmptyVectors = "ignore" | "query";

const EMPTY_VECTORS_KEY = "bf_ui_empty_vectors";

export function readStoredEmptyVectors(): EmptyVectors {
  try {
    return localStorage.getItem(EMPTY_VECTORS_KEY) === "query" ? "query" : "ignore";
  } catch {
    return "ignore";
  }
}

export function storeEmptyVectors(value: EmptyVectors): void {
  try {
    localStorage.setItem(EMPTY_VECTORS_KEY, value);
  } catch {
    /* sem storage: a escolha vale só nesta sessão */
  }
}

/**
 * Textos que contam para os pesos: com "query", critérios em branco recebem o pedido
 * entendido e passam a ter peso ajustável como os preenchidos.
 */
export function queriesForWeights(
  queries: Record<string, string>,
  mainQuery: string,
  emptyVectors: EmptyVectors,
): Record<string, string> {
  if (emptyVectors !== "query") return queries;
  const fill = mainQuery.trim() || "-";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(queries)) out[k] = (v || "").trim() ? v : fill;
  return out;
}

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
  for (const k of keys) {
    queries[k] = "";
    weights[k] = 0;
  }
  return {
    query: "",
    city: "",
    ufs: [],
    radiusKm: "",
    modeloNegocio: "",
    keywords: [],
    queries,
    weights: weightsForFilledQueries(weights, queries, false),
    lockedWeights: [],
    exactTerms: [],
    intent: null,
  };
}

export function draftFromSnapshot(
  snap: SearchSnapshot | null,
  dimensionKeys: string[] = DEFAULT_DIMENSION_KEYS,
  emptyVectors: EmptyVectors = "ignore",
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
  const incomingWeights =
    snap.weightsUsed && typeof snap.weightsUsed === "object"
      ? snap.weightsUsed
      : args.weights && typeof args.weights === "object"
        ? args.weights
        : {};
  let weights: Record<string, number> = {};
  for (const k of keys) {
    const v = Number(incomingWeights[k]);
    weights[k] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  if (keywords.length) {
    const bm = Number(incomingWeights.bm25);
    weights.bm25 = Number.isFinite(bm) && bm >= 0 ? bm : 0.2;
  }

  const query = String(snap.query || args.query || qm?.query_original || "");
  return {
    query,
    city: String(city || ""),
    ufs,
    radiusKm,
    modeloNegocio: modelo,
    keywords,
    queries,
    weights: weightsForFilledQueries(
      weights,
      queriesForWeights(queries, query, emptyVectors),
      keywords.length > 0,
    ),
    lockedWeights: [],
    exactTerms: asList(args.exact_terms || qm?.exact_terms),
    intent: snap.intent || qm?.intent || null,
  };
}

/** emptyVectors só deve ser informado quando os pesos do painel valem (modo Manual). */
export function draftToPayload(
  draft: SearchParamsDraft,
  dimensionKeys: string[],
  emptyVectors?: EmptyVectors,
): SearchParamsPayload {
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
  const weights = weightsForFilledQueries(
    weightSource,
    queriesForWeights(draft.queries, draft.query, emptyVectors ?? "ignore"),
    hasKeywords,
    draft.lockedWeights,
  );

  const payload: SearchParamsPayload = {
    query: draft.query.trim(),
    queries,
    weights,
  };
  if (emptyVectors) payload.empty_vectors = emptyVectors;

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

function hasQueryText(queries: Record<string, string>, key: string): boolean {
  return Boolean((queries[key] || "").trim());
}

function activeWeightKeys(
  weights: Record<string, number>,
  queries: Record<string, string>,
  hasBm25: boolean,
): string[] {
  return Object.keys(weights).filter((k) => {
    if (k === "bm25") return hasBm25;
    return hasQueryText(queries, k);
  });
}

function applyRemainder(out: Record<string, number>, preferred: string[]): Record<string, number> {
  const keys = Object.keys(out);
  if (!keys.length) return out;
  const sum = keys.reduce((a, k) => a + out[k], 0);
  const delta = Number((1 - sum).toFixed(4));
  if (Math.abs(delta) < 0.00005) return out;
  const target =
    preferred.find((k) => (out[k] || 0) > 0) || preferred[0] || keys.find((k) => out[k] > 0) || keys[0];
  if (!target) return out;
  out[target] = Number((out[target] + delta).toFixed(4));
  if (out[target] < 0) out[target] = 0;
  return out;
}

/** Zera peso de dimensões sem query e renormaliza os preenchidos para soma 1. */
export function weightsForFilledQueries(
  weights: Record<string, number>,
  queries: Record<string, string>,
  hasBm25: boolean,
  lockedKeys: string[] = [],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    if (k === "bm25") {
      out.bm25 = hasBm25 ? Math.max(0, Number(v) || 0) : 0;
      continue;
    }
    out[k] = hasQueryText(queries, k) ? Math.max(0, Number(v) || 0) : 0;
  }
  if (hasBm25 && !Object.prototype.hasOwnProperty.call(out, "bm25")) out.bm25 = 0;
  if (!hasBm25) delete out.bm25;

  const active = activeWeightKeys(out, queries, hasBm25);
  const lockedSet = new Set(lockedKeys.filter((k) => active.includes(k)));
  if (!active.length) {
    const fallback =
      Object.keys(out).find((k) => k !== "bm25" && hasQueryText(queries, k)) ||
      (hasBm25 ? "bm25" : undefined) ||
      Object.keys(out).find((k) => k !== "bm25") ||
      Object.keys(out)[0];
    if (fallback) {
      for (const k of Object.keys(out)) out[k] = 0;
      out[fallback] = 1;
    }
    return out;
  }

  const positive = active.filter((k) => (out[k] || 0) > 0);
  if (!positive.length) {
    const fallback = active.find((k) => !lockedSet.has(k)) || active[0];
    for (const k of Object.keys(out)) out[k] = 0;
    out[fallback] = 1;
    return out;
  }

  const activeOut: Record<string, number> = {};
  for (const k of active) activeOut[k] = out[k] || 0;
  const normalized = renormalizeWeights(activeOut, [...lockedSet]);
  const merged: Record<string, number> = { ...out };
  for (const k of Object.keys(merged)) {
    if (!active.includes(k)) merged[k] = 0;
  }
  return { ...merged, ...normalized };
}

export function renormalizeWeights(
  weights: Record<string, number>,
  lockedKeys: string[] = [],
): Record<string, number> {
  const keys = Object.keys(weights);
  if (!keys.length) return weights;
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = Math.max(0, Number(weights[k]) || 0);

  const lockedSet = new Set(lockedKeys.filter((k) => keys.includes(k)));
  const locked = keys.filter((k) => lockedSet.has(k));
  const unlocked = keys.filter((k) => !lockedSet.has(k));

  const lockedSum = locked.reduce((a, k) => a + out[k], 0);
  if (lockedSum > 1 && lockedSum > 0) {
    const scale = 1 / lockedSum;
    for (const k of locked) out[k] = Number((out[k] * scale).toFixed(4));
    for (const k of unlocked) out[k] = 0;
    return applyRemainder(out, locked);
  }

  const rest = Number(Math.max(0, 1 - lockedSum).toFixed(4));
  const unlockedPositive = unlocked.filter((k) => out[k] > 0);
  const pool = unlockedPositive.length ? unlockedPositive : unlocked;

  if (!pool.length) {
    if (lockedSum > 0 && lockedSum < 1) {
      const scale = 1 / lockedSum;
      for (const k of locked) out[k] = Number((out[k] * scale).toFixed(4));
    } else if (lockedSum <= 0 && keys.length) {
      out[keys[0]] = 1;
    }
    return applyRemainder(out, locked.length ? locked : keys);
  }

  const poolSum = pool.reduce((a, k) => a + out[k], 0);
  if (poolSum <= 0) {
    const each = Number((rest / pool.length).toFixed(4));
    for (const k of unlocked) out[k] = 0;
    for (const k of pool) out[k] = each;
  } else {
    const scale = rest / poolSum;
    for (const k of unlocked) {
      out[k] = pool.includes(k) ? Number((out[k] * scale).toFixed(4)) : 0;
    }
  }
  return applyRemainder(out, pool);
}

/** Altera um peso e redistribui o restante só entre dimensões destravadas com query. */
export function adjustWeight(
  weights: Record<string, number>,
  key: string,
  next: number,
  queries: Record<string, string> = {},
  hasBm25 = Object.prototype.hasOwnProperty.call(weights, "bm25"),
  lockedKeys: string[] = [],
): Record<string, number> {
  const active = activeWeightKeys(weights, queries, hasBm25);
  if (!active.includes(key)) {
    return weightsForFilledQueries(weights, queries, hasBm25, lockedKeys);
  }
  const locked = new Set(lockedKeys.filter((k) => k !== key && active.includes(k)));
  const lockedSum = [...locked].reduce((s, k) => s + Math.max(0, Number(weights[k]) || 0), 0);
  const maxForKey = Math.max(0, 1 - lockedSum);
  const clamped = Math.min(maxForKey, Math.max(0, Number(next) || 0));
  const others = active.filter((k) => k !== key && !locked.has(k));
  const rest = Number((1 - lockedSum - clamped).toFixed(4));
  const out: Record<string, number> = {};
  for (const k of Object.keys(weights)) out[k] = 0;
  for (const k of locked) out[k] = Number((Math.max(0, Number(weights[k]) || 0)).toFixed(4));
  out[key] = Number(clamped.toFixed(4));
  if (!others.length) {
    out[key] = Number(maxForKey.toFixed(4));
    return weightsForFilledQueries(out, queries, hasBm25, lockedKeys);
  }
  const othersSum = others.reduce((s, k) => s + (Number(weights[k]) || 0), 0);
  if (othersSum <= 0) {
    const each = Number((rest / others.length).toFixed(4));
    for (const k of others) out[k] = each;
  } else {
    const scale = rest / othersSum;
    for (const k of others) out[k] = Number(((Number(weights[k]) || 0) * scale).toFixed(4));
  }
  return weightsForFilledQueries(out, queries, hasBm25, lockedKeys);
}

export function setKeywordsOnDraft(
  draft: SearchParamsDraft,
  keywords: string[],
  emptyVectors: EmptyVectors = "ignore",
): SearchParamsDraft {
  const hadBm25 = Object.prototype.hasOwnProperty.call(draft.weights, "bm25");
  const lockedWeights = draft.lockedWeights || [];
  const next: SearchParamsDraft = { ...draft, keywords };
  const hasBm25 = keywords.length > 0;
  const wq = queriesForWeights(draft.queries, draft.query, emptyVectors);
  if (hasBm25 && !hadBm25) {
    next.weights = adjustWeight({ ...draft.weights, bm25: 0 }, "bm25", 0.2, wq, true, lockedWeights);
  } else if (!hasBm25 && hadBm25) {
    const dense = { ...draft.weights };
    delete dense.bm25;
    next.lockedWeights = lockedWeights.filter((k) => k !== "bm25");
    next.weights = weightsForFilledQueries(dense, wq, false, next.lockedWeights);
  } else {
    next.weights = weightsForFilledQueries(draft.weights, wq, hasBm25, lockedWeights);
  }
  return next;
}

/**
 * Aplica o tratamento dos critérios em branco ao rascunho. Com "query", se nenhum
 * critério em branco tem peso ainda, cada um recebe uma fatia igual; com "ignore",
 * o peso deles é redistribuído entre os preenchidos.
 */
export function setEmptyVectorsOnDraft(
  draft: SearchParamsDraft,
  emptyVectors: EmptyVectors,
): SearchParamsDraft {
  const hasBm25 = draft.keywords.length > 0;
  const wq = queriesForWeights(draft.queries, draft.query, emptyVectors);
  const weights = { ...draft.weights };
  if (emptyVectors === "query") {
    const blank = Object.keys(wq).filter((k) => !hasQueryText(draft.queries, k));
    if (blank.every((k) => !(Number(weights[k]) > 0))) {
      const active = Object.keys(wq).length + (hasBm25 ? 1 : 0);
      for (const k of blank) weights[k] = 1 / Math.max(active, 1);
    }
  }
  const lockedWeights = (draft.lockedWeights || []).filter(
    (k) => k === "bm25" || hasQueryText(wq, k),
  );
  return {
    ...draft,
    lockedWeights,
    weights: weightsForFilledQueries(weights, wq, hasBm25, lockedWeights),
  };
}
