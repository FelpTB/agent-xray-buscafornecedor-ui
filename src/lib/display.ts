const PERFIL_BASE = "https://buscafornecedor.com.br/perfil";

export function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function softTitleCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'/.-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function cnpjBasicoFromPayload(payload: Record<string, unknown> = {}): string | null {
  const fromBasico = digitsOnly(payload.cnpj_basico);
  if (fromBasico.length >= 8) return fromBasico.slice(0, 8).padStart(8, "0");
  const fromCnpj = digitsOnly(payload.cnpj ?? payload.cnpj_completo ?? payload.CNPJ);
  if (fromCnpj.length >= 14) return fromCnpj.slice(0, 8);
  if (fromCnpj.length >= 8) return fromCnpj.slice(0, 8).padStart(8, "0");
  return fromCnpj.length ? fromCnpj.padStart(8, "0") : null;
}

export function normalizeSiteUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t === "-" || t.toLowerCase() === "null" || t.toLowerCase() === "n/a") return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t) || /^[\w.-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return t;
}

export function siteLabelFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] || null;
  }
}

export type SupplierCard = {
  posicao: number;
  nome: string;
  local: string | null;
  modelo: string | null;
  descricao: string | null;
  site: string | null;
  siteLabel: string | null;
  perfilUrl: string | null;
};

export function mapResultsForDisplay(
  results: Array<{ posicao?: number; payload?: Record<string, unknown> }> = [],
): SupplierCard[] {
  return results.slice(0, 40).map((r, i) => {
    const p = r.payload && typeof r.payload === "object" ? r.payload : {};
    const descricao =
      typeof p.descricao === "string"
        ? p.descricao.trim()
        : typeof p.descricao_empresa === "string"
          ? p.descricao_empresa.trim()
          : null;
    const nome =
      (typeof p.nome_empresa === "string" && p.nome_empresa.trim()) ||
      (typeof p.razao_social === "string" && p.razao_social.trim()) ||
      "Fornecedor";
    const uf = typeof p.uf === "string" ? p.uf.trim().toUpperCase() : "";
    const rawCity =
      (typeof p.cidade === "string" && p.cidade.trim()) ||
      (typeof p.municipio === "string" && p.municipio.trim()) ||
      "";
    const cidade = softTitleCase(rawCity);
    const local = uf && cidade ? `${uf} · ${cidade}` : uf || cidade || null;
    const site = normalizeSiteUrl(p.site ?? p.website ?? p.url);
    const basico = cnpjBasicoFromPayload(p);
    return {
      posicao: r.posicao ?? i + 1,
      nome: softTitleCase(nome),
      local,
      modelo: typeof p.modelo_negocio === "string" && p.modelo_negocio.trim() ? p.modelo_negocio.trim() : null,
      descricao: descricao ? descricao.slice(0, 400) : null,
      site,
      siteLabel: siteLabelFromUrl(site),
      perfilUrl: basico ? `${PERFIL_BASE}/${basico}` : null,
    };
  });
}
