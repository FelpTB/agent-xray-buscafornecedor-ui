import type { SupplierCard } from "../lib/display";

export function SupplierList({ cards }: { cards: SupplierCard[] }) {
  if (!cards.length) {
    return <p className="help">Nenhum fornecedor listado nesta conversa ainda. Descreva o que precisa no chat.</p>;
  }
  return (
    <div>
      {cards.map((c) => (
        <article className="supplier" key={`${c.posicao}-${c.nome}`}>
          <h4>
            {c.posicao}. {c.nome}
          </h4>
          {c.local ? <div className="local">{c.local}</div> : null}
          {c.modelo ? <div className="local">Modelo de negócio: {c.modelo}</div> : null}
          {c.descricao ? <p>{c.descricao}</p> : null}
          <div className="supplier-links">
            {c.site ? (
              <a href={c.site} target="_blank" rel="noopener noreferrer">
                {c.siteLabel || "Site"}
              </a>
            ) : null}
            {c.perfilUrl ? (
              <a href={c.perfilUrl} target="_blank" rel="noopener noreferrer">
                Ver perfil
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
