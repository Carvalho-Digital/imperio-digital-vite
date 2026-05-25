import { supabase } from './supabase';

export interface ShareToken {
  id: string;
  contractId: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

interface DbRow {
  id: string;
  contract_id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

function fromDb(r: DbRow): ShareToken {
  return {
    id: r.id,
    contractId: r.contract_id,
    token: r.token,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    accessCount: r.access_count,
    lastAccessedAt: r.last_accessed_at,
    createdAt: r.created_at,
  };
}

/** Lista tokens de um contrato (ativos + revogados). */
export async function listTokens(contractId: string): Promise<ShareToken[]> {
  const { data, error } = await supabase
    .from('contract_share_tokens')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listTokens: ${error.message}`);
  return (data ?? []).map(r => fromDb(r as DbRow));
}

/** Cria novo token. expiresInDays default = 30. */
export async function createToken(contractId: string, expiresInDays = 30): Promise<ShareToken> {
  const expires = new Date();
  expires.setDate(expires.getDate() + expiresInDays);
  const { data, error } = await supabase
    .from('contract_share_tokens')
    .insert({ contract_id: contractId, expires_at: expires.toISOString() })
    .select()
    .single();
  if (error) throw new Error(`createToken: ${error.message}`);
  return fromDb(data as DbRow);
}

/** Revoga um token (não apaga — mantém histórico de acessos). */
export async function revokeToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from('contract_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId);
  if (error) throw new Error(`revokeToken: ${error.message}`);
}

/** Constrói a URL pública a partir do token. */
export function buildPublicUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/ficha/${token}`;
}
