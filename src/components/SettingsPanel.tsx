import type { SearchSettings } from "../lib/api";

type Props = {
  settings: SearchSettings;
  maxLimit?: number;
  onChange: (next: SearchSettings) => void;
};

export function SettingsPanel({ settings, maxLimit = 20, onChange }: Props) {
  const max = Math.min(Math.max(maxLimit, 5), 40);
  return (
    <section className="card" aria-labelledby="settings-title">
      <h3 id="settings-title">Como a busca trabalha</h3>
      <p className="help">
        Estas opções valem para a próxima mensagem. Você não precisa mexer nelas no dia a dia — o
        assistente já entende cidade, estado e o que você está procurando.
      </p>

      <div className="field">
        <label htmlFor="finalLimit">Quantos fornecedores mostrar</label>
        <p className="help">
          É o tamanho da lista que o assistente devolve. Menos nomes = leitura mais rápida. Mais nomes =
          visão mais ampla do mercado.
        </p>
        <select
          id="finalLimit"
          value={settings.finalLimit}
          onChange={(e) => onChange({ ...settings, finalLimit: Number(e.target.value) })}
        >
          {[5, 8, 10, 15, 20].filter((n) => n <= max).map((n) => (
            <option key={n} value={n}>
              {n} fornecedores
            </option>
          ))}
        </select>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.rerank}
          onChange={(e) => onChange({ ...settings, rerank: e.target.checked })}
        />
        <span>
          <strong>Reordenar com inteligência artificial</strong>
          <span className="help" style={{ display: "block", margin: "0.2rem 0 0" }}>
            Depois de encontrar candidatos, uma segunda leitura da IA coloca no topo quem mais combina
            com o que você descreveu. Costuma melhorar a lista, mas a resposta demora um pouco mais.
          </span>
        </span>
      </label>
    </section>
  );
}
