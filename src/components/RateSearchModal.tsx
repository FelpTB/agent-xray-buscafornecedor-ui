export const QUALIDADE_OPTIONS = [
  {
    value: "Ótimo",
    label: "Ótimo",
    hint: "A lista veio certeira — eu cotaria por esses nomes.",
  },
  {
    value: "Bom",
    label: "Bom",
    hint: "Serviu, com um ou outro ajuste de filtro ou região.",
  },
  {
    value: "Ruim",
    label: "Ruim",
    hint: "Misturou ramo, praça ou tipo de empresa.",
  },
  {
    value: "Péssimo",
    label: "Péssimo",
    hint: "Quase nada a ver com o que eu pedi.",
  },
] as const;

type Props = {
  query?: string | null;
  busy?: boolean;
  error?: string | null;
  onChoose: (qualidade: string) => void;
};

export function RateSearchModal({ query, busy, error, onChoose }: Props) {
  return (
    <div className="rate-overlay" role="dialog" aria-modal="true" aria-labelledby="rate-title">
      <div className="rate-card">
        <h2 id="rate-title">Como ficou a última lista?</h2>
        <p>
          Antes de abrir outra busca, avalie o resultado anterior. Isso ajuda as próximas cotações a
          chegarem mais no alvo.
        </p>
        {query ? <p className="rate-query">Pedido: {query}</p> : null}
        <div className="rate-options">
          {QUALIDADE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="rate-option"
              disabled={busy}
              onClick={() => onChoose(opt.value)}
            >
              <strong>{opt.label}</strong>
              <span>{opt.hint}</span>
            </button>
          ))}
        </div>
        {error ? (
          <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>
            {error}
          </p>
        ) : null}
        {busy ? <p className="help">Registrando sua avaliação…</p> : null}
      </div>
    </div>
  );
}
