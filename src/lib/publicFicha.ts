import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './supabase';

export interface PublicFichaData {
  ficha: {
    cliente: string | null;
    produto: { nome: string; icon: string; code: string };
    mes: string;
    ano: number | null;
    valor: number;
    tipo: 'tcv' | 'mrr';
    formaPagamento: 'cartao' | 'avista' | 'mensalidade' | 'parcelado' | null;
    parcelas: number | null;
    meses_mrr: number | null;
    comboItens: string[] | null;
    vigenciaInicio: string | null;
    vigenciaMeses: number | null;
    entregaveis: string | null;
    notasJuridico: string | null;
    notasOperacional: string | null;
    notasLivres: string | null;
    customFields: Record<string, unknown>;
    atualizadaEm: string | null;
  };
  tokenInfo: {
    expiresAt: string;
    accessCount: number;
  };
}

export type PublicFichaError =
  | { kind: 'not_found' }
  | { kind: 'revoked' }
  | { kind: 'expired'; expiredAt?: string }
  | { kind: 'server'; message: string };

export type PublicFichaResult =
  | { ok: true; data: PublicFichaData }
  | { ok: false; error: PublicFichaError };

/** Busca a ficha por token (rota pública, sem login). */
export async function fetchPublicFicha(token: string): Promise<PublicFichaResult> {
  try {
    const url = `${FUNCTIONS_URL}/ficha-publica?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
    });

    if (resp.status === 404) return { ok: false, error: { kind: 'not_found' } };
    if (resp.status === 410) {
      const body = await resp.json().catch(() => ({}));
      if (body?.code === 'revoked') return { ok: false, error: { kind: 'revoked' } };
      return { ok: false, error: { kind: 'expired', expiredAt: body?.expired_at } };
    }
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return { ok: false, error: { kind: 'server', message: body?.error ?? `HTTP ${resp.status}` } };
    }

    const data = await resp.json();
    return { ok: true, data: data as PublicFichaData };
  } catch (e) {
    return { ok: false, error: { kind: 'server', message: e instanceof Error ? e.message : String(e) } };
  }
}
