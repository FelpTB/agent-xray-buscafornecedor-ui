/**
 * Prévia dos pesos que a API aplicará ao refazer a busca no modo Simplificado.
 * Espelha `executeSearchByText` (BuscaFornecedor-Api-Mcp-Main/src/searchService.js):
 * pesos-base (explícitos ou preset) → foco (applySearchFocus) → BM25 (0,20; densos reescalados).
 */
import type { SearchFocus, WeightPreset } from "./searchPrefs";

export type PresetTable = Record<string, Record<string, number>>;

/** Usado só se `/config` não trouxer `weight_presets` (API antiga). */
export const FALLBACK_PRESET_TABLE: PresetTable = {
  escopo: { produto: 0.3, servico: 0.3, descricao: 0.3, publico: 0.05, cliente: 0.05 },
  publico_alvo: { produto: 0.2, servico: 0.2, descricao: 0.2, publico: 0.2, cliente: 0.2 },
  equilibrado: { produto: 0.25, servico: 0.25, descricao: 0.25, publico: 0.125, cliente: 0.125 },
};

const BM25_SHARE = 0.2;

type CanonicalDims = Record<"produto" | "servico" | "descricao" | "publico" | "cliente", string | null>;

function resolveCanonicalDims(keys: string[]): CanonicalDims {
  const find = (fragment: string) => keys.find((k) => k.toLowerCase().includes(fragment)) || null;
  return {
    produto: find("produt"),
    servico: find("servic"),
    descricao: find("descric"),
    publico: find("public"),
    cliente: find("client"),
  };
}

function presetWeights(table: Record<string, number>, keys: string[]): Record<string, number> | null {
  const dims = resolveCanonicalDims(keys);
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const [canonical, value] of Object.entries(table)) {
    const key = dims[canonical as keyof CanonicalDims];
    if (key) out[key] += Number(value) || 0;
  }
  const total = keys.reduce((a, k) => a + out[k], 0);
  if (total <= 0) return null;
  for (const k of keys) out[k] = out[k] / total;
  return out;
}

function focusTargets(preset: WeightPreset | undefined, dims: CanonicalDims, keys: string[], onKey: string, offKey: string) {
  if (preset === "equilibrado") return keys.filter((k) => k !== offKey);
  if (preset === "publico_alvo") {
    const audience = [dims.publico, dims.cliente].filter((k): k is string => Boolean(k));
    if (audience.length) return audience;
  }
  return [onKey];
}

function applyFocus(
  weights: Record<string, number>,
  focus: SearchFocus | "",
  keys: string[],
  preset: WeightPreset | undefined,
): Record<string, number> {
  if (!focus || focus === "mista") return weights;
  const dims = resolveCanonicalDims(keys);
  const onKey = focus === "produto" ? dims.produto : dims.servico;
  const offKey = focus === "produto" ? dims.servico : dims.produto;
  if (!onKey || !offKey) return weights;
  const out = { ...weights };
  const freed = Number(out[offKey] || 0);
  out[offKey] = 0;
  if (freed <= 0) return out;
  const targets = focusTargets(preset, dims, keys, onKey, offKey);
  for (const k of targets) out[k] = Number(out[k] || 0) + freed / targets.length;
  return out;
}

export function previewWeights({
  draftWeights,
  preset,
  focus,
  dimensionKeys,
  hasBm25,
  presetTable,
}: {
  draftWeights: Record<string, number>;
  preset: WeightPreset | "";
  focus: SearchFocus | "";
  dimensionKeys: string[];
  hasBm25: boolean;
  presetTable?: PresetTable | null;
}): Record<string, number> {
  const keys = dimensionKeys;
  const table = (presetTable && preset && presetTable[preset]) || (preset ? FALLBACK_PRESET_TABLE[preset] : null);
  const fromPreset = table ? presetWeights(table, keys) : null;

  let weights: Record<string, number>;
  if (fromPreset) {
    weights = fromPreset;
  } else {
    weights = Object.fromEntries(keys.map((k) => [k, Math.max(0, Number(draftWeights[k]) || 0)]));
    if (hasBm25 && draftWeights.bm25 != null) weights.bm25 = Math.max(0, Number(draftWeights.bm25) || 0);
  }

  weights = applyFocus(weights, focus, keys, fromPreset ? (preset as WeightPreset) : undefined);

  if (hasBm25 && weights.bm25 == null) {
    const denseSum = keys.reduce((a, k) => a + (weights[k] || 0), 0);
    const scale = denseSum > 0 ? (1 - BM25_SHARE) / denseSum : 0;
    weights = Object.fromEntries(keys.map((k) => [k, (weights[k] || 0) * scale]));
    weights.bm25 = BM25_SHARE;
  } else if (!hasBm25) {
    delete weights.bm25;
  }
  return weights;
}
