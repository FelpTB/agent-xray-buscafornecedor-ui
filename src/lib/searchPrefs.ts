/** Ênfase da busca (`weight_preset`) e o que o comprador procura (`search_focus`) — contrato da API. */

export type WeightPreset = "escopo" | "equilibrado" | "publico_alvo";
export type SearchFocus = "produto" | "servico" | "mista";

export type SearchPrefs = {
  weightPreset: WeightPreset | "";
  searchFocus: SearchFocus | "";
};

type Option<T extends string> = { value: T | ""; label: string; hint: string };

export const WEIGHT_PRESET_OPTIONS: Option<WeightPreset>[] = [
  {
    value: "",
    label: "Automática",
    hint: "O assistente decide a ênfase a partir do seu pedido e mantém os pesos que escolheu.",
  },
  {
    value: "escopo",
    label: "O que eu compro",
    hint: "Prioriza quem oferece exatamente o item ou serviço pedido. A melhor escolha para a maioria das cotações.",
  },
  {
    value: "equilibrado",
    label: "Equilibrada",
    hint: "Combina o item pedido com o perfil de clientes que o fornecedor costuma atender.",
  },
  {
    value: "publico_alvo",
    label: "Quem atende meu segmento",
    hint: "Dá mais peso a fornecedores que já vendem para operações como a sua (hospitais, condomínios, indústria), sem perder de vista o item pedido.",
  },
];

export const SEARCH_FOCUS_OPTIONS: Option<SearchFocus>[] = [
  {
    value: "",
    label: "Automático",
    hint: "A busca considera produtos e serviços conforme o pedido.",
  },
  {
    value: "produto",
    label: "Produto",
    hint: "Você quer comprar um item. A busca deixa de comparar serviços e concentra a ênfase em quem vende o produto.",
  },
  {
    value: "servico",
    label: "Serviço",
    hint: "Você quer contratar uma execução (instalação, manutenção, mão de obra). A busca deixa de comparar produtos e foca em quem presta o serviço.",
  },
  {
    value: "mista",
    label: "Produto e serviço",
    hint: "Você precisa dos dois juntos (por exemplo equipamento + instalação). A busca mantém os dois lados.",
  },
];

export const PREFS_HINT =
  "A ênfase define o que pesa mais na lista: o item pedido, o segmento atendido ou um equilíbrio. “Você procura” diz se a cotação é de produto, serviço ou dos dois. Vale para as próximas buscas e para “Refazer busca” no modo Simplificado; no modo Manual valem os seus pesos.";

const STORAGE_KEY = "bf_ui_search_prefs";
const PRESETS = new Set(WEIGHT_PRESET_OPTIONS.map((o) => o.value).filter(Boolean));
const FOCUSES = new Set(SEARCH_FOCUS_OPTIONS.map((o) => o.value).filter(Boolean));

export const DEFAULT_PREFS: SearchPrefs = { weightPreset: "", searchFocus: "" };

export function asWeightPreset(value: unknown): WeightPreset | "" {
  return typeof value === "string" && PRESETS.has(value as WeightPreset) ? (value as WeightPreset) : "";
}

export function asSearchFocus(value: unknown): SearchFocus | "" {
  return typeof value === "string" && FOCUSES.has(value as SearchFocus) ? (value as SearchFocus) : "";
}

export function readStoredPrefs(): SearchPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<SearchPrefs>;
    return {
      weightPreset: asWeightPreset(parsed.weightPreset),
      searchFocus: asSearchFocus(parsed.searchFocus),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function storePrefs(prefs: SearchPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* modo privado sem storage: a escolha vale só nesta aba */
  }
}

/** Campos do corpo de `POST /api/chat`; omitidos quando automáticos. */
export function prefsToBody(prefs: SearchPrefs): { weight_preset?: WeightPreset; search_focus?: SearchFocus } {
  return {
    ...(prefs.weightPreset ? { weight_preset: prefs.weightPreset } : {}),
    ...(prefs.searchFocus ? { search_focus: prefs.searchFocus } : {}),
  };
}

export function presetLabel(value: unknown): string | null {
  const v = asWeightPreset(value);
  return v ? WEIGHT_PRESET_OPTIONS.find((o) => o.value === v)?.label || null : null;
}

export function focusLabel(value: unknown): string | null {
  const v = asSearchFocus(value);
  return v ? SEARCH_FOCUS_OPTIONS.find((o) => o.value === v)?.label || null : null;
}
