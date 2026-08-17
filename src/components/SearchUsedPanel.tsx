import { explainSearch, type SearchSnapshot } from "../lib/searchExplain";

type Props = {
  snapshot: SearchSnapshot | null;
};

export function SearchUsedPanel({ snapshot }: Props) {
  const facts = explainSearch(snapshot);

  return (
    <section className="card" aria-labelledby="used-title">
      <h3 id="used-title">O que esta busca usou</h3>
      {facts.length === 0 ? (
        <p className="help">
          Quando o assistente consultar a base, aparece aqui — em linguagem de compras — a região, o
          tipo de necessidade, os recortes e o que pesou na lista. Nada de código: só o que entrou (e o
          que ficou de fora).
        </p>
      ) : (
        <>
          <p className="help">
            Recortes realmente aplicados nesta consulta. Se algo não bater com o que você queria, diga
            no chat (“só em SP”, “sem instalação”, “termo exato X”).
          </p>
          <dl className="facts">
            {facts.map((f) => (
              <div className="fact" key={f.id}>
                <dt>{f.title}</dt>
                <dd>
                  <strong>{f.value}</strong>
                  <span>{f.hint}</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
