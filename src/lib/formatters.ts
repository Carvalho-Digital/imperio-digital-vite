export function fmtBRL(valor: number, opts: { compacto?: boolean } = {}): string {
  const { compacto = true } = opts;
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? '−' : '';
  if (compacto && abs >= 1000000) {
    const m = (abs / 1000000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${sinal}R$ ${m} mi`;
  }
  return `${sinal}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

export const fmtBRLCompleto = (v: number): string => fmtBRL(v, { compacto: false });

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    };
    return map[c] ?? c;
  });
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
