import { useEffect, useMemo, useState } from "react";
import { PARAM_HINTS, vectorHint, vectorLabel } from "../lib/paramCopy";
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
  weightsForFilledQueries,
  weightSum,
} from "../lib/searchParams";
import type { SearchSnapshot } from "../lib/searchExplain";
import { focusLabel, PREFS_HINT, presetLabel, type SearchPrefs } from "../lib/searchPrefs";
import { ParamHint } from "./ParamHint";
import { SearchPrefsControls } from "./SearchPrefsControls";
import { TagInput } from "./TagInput";

type Props = {
  snapshot: SearchSnapshot | null;
  dimensionKeys?: string[];
  finalLimit: number;
  maxLimit?: number;
  busy?: boolean;
  prefs: SearchPrefs;
  onPrefsChange: (next: SearchPrefs) => void;
  onFinalLimitChange: (n: number) => void;
  onRerun: (payload: SearchParamsPayload) => void;
};

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M8 10V7a4 4 0 0 1 8 0v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect
          x="5"
          y="10"
          width="14"
          height="11"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 10V7a4 4 0 0 1 7.5-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function WeightSlider({
  id,
  label,
  value,
  disabled,
  locked,
  determined,
  busy,
  onChange,
  onToggleLock,
}: {
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  locked: boolean;
  determined: boolean;
  busy?: boolean;
  onChange: (next: number) => void;
  onToggleLock: () => void;
}) {
  const pct = Math.round((value || 0) * 100);
  const sliderDisabled = disabled || locked || determined || Boolean(busy);
  return (
    <div className="weight-ctrl">
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        disabled={sliderDisabled}
        aria-label={`Peso de ${label}`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        className="weight-pct"
        value={pct}
        disabled={sliderDisabled}
        aria-label={`Peso percentual de ${label}`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="weight-unit">%</span>
      <button
        type="button"
        className={`weight-lock${locked ? " is-locked" : ""}`}
        disabled={disabled || Boolean(busy)}
        aria-pressed={locked}
        aria-label={locked ? `Destravar peso de ${label}` : `Travar peso de ${label}`}
        title={PARAM_HINTS.lock}
        onClick={onToggleLock}
      >
        <LockIcon locked={locked} />
      </button>
    </div>
  );
}

export function SearchParamsPanel({
  snapshot,
  dimensionKeys = DEFAULT_DIMENSION_KEYS,
  finalLimit,
  maxLimit = 20,
  busy,
  prefs,
  onPrefsChange,
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
  const lockedSet = useMemo(() => new Set(draft.lockedWeights || []), [draft.lockedWeights]);
  const adjustableKeys = useMemo(() => {
    const list = keys.filter((key) => Boolean((draft.queries[key] || "").trim()));
    if (draft.keywords.length) list.push("bm25");
    return list;
  }, [keys, draft.queries, draft.keywords.length]);
  const unlockedCount = adjustableKeys.filter((key) => !lockedSet.has(key)).length;
  const usedPreset = presetLabel(snapshot?.weightPreset);
  const usedFocus = focusLabel(snapshot?.searchFocus);

  function patch(partial: Partial<SearchParamsDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function patchQuery(key: string, text: string) {
    setDraft((prev) => {
      const queries = { ...prev.queries, [key]: text };
      const had = Boolean((prev.queries[key] || "").trim());
      const has = Boolean(text.trim());
      const hasBm25 = prev.keywords.length > 0;
      const weights = { ...prev.weights };
      if (!had && has) {
        const filled =
          Object.keys(queries).filter((k) => (queries[k] || "").trim()).length + (hasBm25 ? 1 : 0);
        weights[key] = 1 / Math.max(filled, 1);
      }
      const lockedWeights = has
        ? prev.lockedWeights || []
        : (prev.lockedWeights || []).filter((k) => k !== key);
      return {
        ...prev,
        queries,
        lockedWeights,
        weights: weightsForFilledQueries(weights, queries, hasBm25, lockedWeights),
      };
    });
  }

  function patchWeight(key: string, next: number) {
    if (prefs.weightPreset) onPrefsChange({ ...prefs, weightPreset: "" });
    setDraft((prev) => ({
      ...prev,
      weights: adjustWeight(
        prev.weights,
        key,
        next,
        prev.queries,
        prev.keywords.length > 0,
        prev.lockedWeights,
      ),
    }));
  }

  function toggleLock(key: string) {
    setDraft((prev) => {
      const current = new Set(prev.lockedWeights || []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, lockedWeights: [...current] };
    });
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
        <div className="section-title-row">
          <h3 id="query-title">Pedido entendido</h3>
          <ParamHint label="Pedido entendido" hint={PARAM_HINTS.query} />
        </div>
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
          <div className="field-label-row">
            <label htmlFor="param-city">Cidade</label>
            <ParamHint label="Cidade" hint={PARAM_HINTS.city} />
          </div>
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
            <div className="field-label-row">
              <label htmlFor="param-uf">UF</label>
              <ParamHint label="UF" hint={PARAM_HINTS.uf} />
            </div>
            <div className={`tag-input uf-input${busy ? " is-disabled" : ""}`}>
              {draft.ufs.map((uf) => (
                <span className="tag" key={uf}>
                  {uf}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover ${uf}`}
                    disabled={busy}
                    onClick={() => patch({ ufs: draft.ufs.filter((u) => u !== uf) })}
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                id="param-uf"
                value=""
                disabled={busy}
                aria-label="Adicionar UF"
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  if (!next || draft.ufs.includes(next)) return;
                  patch({ ufs: [...draft.ufs, next] });
                }}
              >
                <option value="">Adicionar</option>
                {UF_OPTIONS.filter((uf) => !draft.ufs.includes(uf)).map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div className="field-label-row">
              <label htmlFor="param-radius">Raio (km)</label>
              <ParamHint label="Raio" hint={PARAM_HINTS.radius} />
            </div>
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
        <div className="section-title-row">
          <h3 id="modelo-title">Tipo de empresa</h3>
          <ParamHint label="Tipo de empresa" hint={PARAM_HINTS.modelo} />
        </div>
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
        <div className="section-title-row">
          <h3 id="kw-title">Palavras-chave no perfil</h3>
          <ParamHint label="Palavras-chave no perfil" hint={PARAM_HINTS.keywords} />
        </div>
        <div className="field" style={{ marginBottom: draft.keywords.length ? "0.45rem" : undefined }}>
          <label className="sr-only" htmlFor="param-keywords">
            Palavras-chave
          </label>
          <TagInput
            id="param-keywords"
            values={draft.keywords}
            disabled={busy}
            placeholder="Termo + Enter ou espaço"
            onChange={(keywords) => setDraft((prev) => setKeywordsOnDraft(prev, keywords))}
          />
        </div>
        {draft.keywords.length ? (
          <div className="vector-row vector-row--weight-only">
            <div className="field-label-row">
              <label htmlFor="vec-w-bm25">Peso das palavras-chave</label>
              <ParamHint label="Peso das palavras-chave" hint={PARAM_HINTS.keywordsWeight} />
            </div>
            <WeightSlider
              id="vec-w-bm25"
              label="Palavras-chave"
              value={draft.weights.bm25 || 0}
              disabled={Boolean(busy)}
              locked={lockedSet.has("bm25")}
              determined={!lockedSet.has("bm25") && unlockedCount <= 1}
              busy={busy}
              onChange={(next) => patchWeight("bm25", next)}
              onToggleLock={() => toggleLock("bm25")}
            />
          </div>
        ) : null}
      </section>

      <section className="card" aria-labelledby="prefs-title">
        <div className="section-title-row">
          <h3 id="prefs-title">Ênfase da busca</h3>
          <ParamHint label="Ênfase da busca" hint={PREFS_HINT} />
        </div>
        {usedPreset || usedFocus ? (
          <p className="prefs-used">
            Última busca: {[usedPreset && `ênfase “${usedPreset}”`, usedFocus && `procura “${usedFocus}”`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <SearchPrefsControls idPrefix="panel" prefs={prefs} disabled={busy} onChange={onPrefsChange} />
      </section>

      <section className="card" aria-labelledby="weights-title">
        <div className="section-title-row">
          <h3 id="weights-title">Informações e pesos</h3>
          <ParamHint label="Informações e pesos" hint={PARAM_HINTS.weights} />
        </div>
        <p className="weight-sum" aria-live="polite">
          Total {sumPct}%
        </p>
        {prefs.weightPreset ? (
          <p className="help">
            Com a ênfase “{presetLabel(prefs.weightPreset)}”, os pesos são recalculados ao refazer a busca.
            Ajustar um peso aqui troca a ênfase para Automática.
          </p>
        ) : null}
        {keys.map((key) => {
          const queryFilled = Boolean((draft.queries[key] || "").trim());
          const label = vectorLabel(key);
          return (
            <div className="vector-row" key={key}>
              <div className="field-label-row">
                <label htmlFor={`vec-q-${key}`}>{label}</label>
                <ParamHint label={label} hint={vectorHint(key)} />
              </div>
              <textarea
                id={`vec-q-${key}`}
                rows={2}
                value={draft.queries[key] || ""}
                disabled={busy}
                onChange={(e) => patchQuery(key, e.target.value)}
              />
              <WeightSlider
                id={`vec-w-${key}`}
                label={label}
                value={draft.weights[key] || 0}
                disabled={!queryFilled}
                locked={lockedSet.has(key)}
                determined={queryFilled && !lockedSet.has(key) && unlockedCount <= 1}
                busy={busy}
                onChange={(next) => patchWeight(key, next)}
                onToggleLock={() => toggleLock(key)}
              />
            </div>
          );
        })}
      </section>

      <section className="card" aria-labelledby="limit-title">
        <div className="section-title-row">
          <h3 id="limit-title">Quantos fornecedores mostrar</h3>
          <ParamHint label="Quantos fornecedores mostrar" hint={PARAM_HINTS.limit} />
        </div>
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
