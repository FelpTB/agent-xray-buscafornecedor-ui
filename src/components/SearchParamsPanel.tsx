import { useEffect, useMemo, useState } from "react";
import {
  adjustWeight,
  DEFAULT_DIMENSION_KEYS,
  draftFromSnapshot,
  draftToPayload,
  MODELO_NEGOCIO_OPTIONS,
  setKeywordsOnDraft,
  type SearchParamsDraft,
  type SearchParamsPayload,
  UF_OPTIONS,
  vectorLabel,
  weightSum,
} from "../lib/searchParams";
import type { SearchSnapshot } from "../lib/searchExplain";
import { TagInput } from "./TagInput";

type Props = {
  snapshot: SearchSnapshot | null;
  dimensionKeys?: string[];
  finalLimit: number;
  maxLimit?: number;
  busy?: boolean;
  onFinalLimitChange: (n: number) => void;
  onRerun: (payload: SearchParamsPayload) => void;
};

export function SearchParamsPanel({
  snapshot,
  dimensionKeys = DEFAULT_DIMENSION_KEYS,
  finalLimit,
  maxLimit = 20,
  busy,
  onFinalLimitChange,
  onRerun,
}: Props) {
  const keys = dimensionKeys.length ? dimensionKeys : DEFAULT_DIMENSION_KEYS;
  const keysKey = keys.join("|");
  const max = Math.min(Math.max(maxLimit, 5), 40);
  const [draft, setDraft] = useState<SearchParamsDraft>(() => draftFromSnapshot(snapshot, keys));

  useEffect(() => {
    const nextKeys = keysKey.split("|").filter(Boolean);
    setDraft(draftFromSnapshot(snapshot, nextKeys.length ? nextKeys : DEFAULT_DIMENSION_KEYS));
  }, [snapshot, keysKey]);

  const canRerun = Boolean(snapshot) && Boolean(draft.query.trim()) && !busy;
  const sumPct = Math.round(weightSum(draft.weights) * 100);
  const weightKeys = useMemo(() => {
    const list = [...keys];
    if (draft.keywords.length) list.push("bm25");
    return list;
  }, [keys, draft.keywords.length]);

  function patch(partial: Partial<SearchParamsDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  if (!snapshot) {
    return <p className="help">Os parâmetros aparecem depois da primeira busca.</p>;
  }

  return (
    <form
      className="params-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canRerun) return;
        onRerun(draftToPayload(draft, keys));
      }}
    >
      <section className="card" aria-labelledby="query-title">
        <h3 id="query-title">Pedido entendido</h3>
        <div className="field">
          <label className="sr-only" htmlFor="param-query">
            Texto da busca
          </label>
          <textarea
            id="param-query"
            rows={3}
            value={draft.query}
            disabled={busy}
            onChange={(e) => patch({ query: e.target.value })}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="geo-title">
        <h3 id="geo-title">Localização</h3>
        <div className="field">
          <label htmlFor="param-city">Cidade</label>
          <input
            id="param-city"
            type="text"
            value={draft.city}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => patch({ city: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="param-uf">UF</label>
            <select
              id="param-uf"
              value={draft.uf}
              disabled={busy}
              onChange={(e) => patch({ uf: e.target.value })}
            >
              <option value="">—</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
              {draft.uf && !UF_OPTIONS.includes(draft.uf as (typeof UF_OPTIONS)[number]) ? (
                <option value={draft.uf}>{draft.uf}</option>
              ) : null}
            </select>
          </div>
          <div className="field">
            <label htmlFor="param-radius">Raio (km)</label>
            <input
              id="param-radius"
              type="number"
              min={0}
              max={500}
              step={10}
              value={draft.radiusKm}
              disabled={busy}
              onChange={(e) => {
                const raw = e.target.value;
                patch({ radiusKm: raw === "" ? "" : Number(raw) });
              }}
            />
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="modelo-title">
        <h3 id="modelo-title">Tipo de empresa</h3>
        <div className="field">
          <label className="sr-only" htmlFor="param-modelo">
            Tipo de empresa
          </label>
          <select
            id="param-modelo"
            value={draft.modeloNegocio}
            disabled={busy}
            onChange={(e) => patch({ modeloNegocio: e.target.value })}
          >
            <option value="">Qualquer tipo</option>
            {MODELO_NEGOCIO_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {draft.modeloNegocio &&
            !MODELO_NEGOCIO_OPTIONS.includes(
              draft.modeloNegocio as (typeof MODELO_NEGOCIO_OPTIONS)[number],
            ) ? (
              <option value={draft.modeloNegocio}>{draft.modeloNegocio}</option>
            ) : null}
          </select>
        </div>
      </section>

      <section className="card" aria-labelledby="kw-title">
        <h3 id="kw-title">Palavras-chave no perfil</h3>
        <div className="field">
          <label className="sr-only" htmlFor="param-keywords">
            Palavras-chave
          </label>
          <TagInput
            id="param-keywords"
            values={draft.keywords}
            disabled={busy}
            placeholder="Digite e pressione Enter"
            onChange={(keywords) => setDraft((prev) => setKeywordsOnDraft(prev, keywords))}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="weights-title">
        <h3 id="weights-title">Vetores e pesos</h3>
        <p className="weight-sum" aria-live="polite">
          Total {sumPct}%
        </p>
        {weightKeys.map((key) => (
          <div className="vector-row" key={key}>
            <label htmlFor={`vec-q-${key}`}>{vectorLabel(key)}</label>
            {key !== "bm25" ? (
              <textarea
                id={`vec-q-${key}`}
                rows={2}
                value={draft.queries[key] || ""}
                disabled={busy}
                onChange={(e) =>
                  patch({ queries: { ...draft.queries, [key]: e.target.value } })
                }
              />
            ) : (
              <p className="help" style={{ margin: "0 0 0.35rem" }}>
                {draft.keywords.join(", ")}
              </p>
            )}
            <div className="weight-ctrl">
              <input
                id={`vec-w-${key}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round((draft.weights[key] || 0) * 100)}
                disabled={busy}
                aria-label={`Peso de ${vectorLabel(key)}`}
                onChange={(e) =>
                  patch({
                    weights: adjustWeight(draft.weights, key, Number(e.target.value) / 100),
                  })
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                className="weight-pct"
                value={Math.round((draft.weights[key] || 0) * 100)}
                disabled={busy}
                aria-label={`Peso percentual de ${vectorLabel(key)}`}
                onChange={(e) =>
                  patch({
                    weights: adjustWeight(draft.weights, key, Number(e.target.value) / 100),
                  })
                }
              />
              <span className="weight-unit">%</span>
            </div>
          </div>
        ))}
      </section>

      <section className="card" aria-labelledby="limit-title">
        <h3 id="limit-title">Quantos fornecedores mostrar</h3>
        <div className="field">
          <label className="sr-only" htmlFor="finalLimit">
            Quantos fornecedores mostrar
          </label>
          <select
            id="finalLimit"
            value={finalLimit}
            disabled={busy}
            onChange={(e) => onFinalLimitChange(Number(e.target.value))}
          >
            {[5, 8, 10, 15, 20].filter((n) => n <= max).map((n) => (
              <option key={n} value={n}>
                {n} fornecedores
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="params-actions">
        <button className="btn btn-primary btn-block" type="submit" disabled={!canRerun}>
          Refazer busca
        </button>
      </div>
    </form>
  );
}
