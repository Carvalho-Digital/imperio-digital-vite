import { useEffect, useState } from 'react';
import { fetchPublicFicha, type PublicFichaData, type PublicFichaError } from '../lib/publicFicha';

interface Props { token: string; }

export default function FichaPublica({ token }: Props) {
  const [data, setData] = useState<PublicFichaData | null>(null);
  const [error, setError] = useState<PublicFichaError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Não indexar essa página
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'Ficha do Contrato — Império Digital';

    let cancel = false;
    fetchPublicFicha(token).then(res => {
      if (cancel) return;
      if (res.ok) setData(res.data); else setError(res.error);
      setLoading(false);
    });
    return () => { cancel = true; meta.remove(); };
  }, [token]);

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--txt-3)' }}>
          Carregando ficha…
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorBlock error={error} />
      </Layout>
    );
  }

  if (!data) return null;
  return (
    <Layout>
      <FichaContent data={data} />
    </Layout>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0)',
      color: 'var(--txt-0)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--silver-grad)', color: '#0a0a0c',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
          }}>ID</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.2, fontFamily: 'var(--font-display)' }}>
              Império Digital
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>Ficha do Contrato</div>
          </div>
        </div>
        {children}
        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 10.5, color: 'var(--txt-3)', textAlign: 'center' }}>
          Este link foi gerado automaticamente para passagem de bastão. Mantenha em sigilo.
        </div>
      </div>
    </div>
  );
}

function ErrorBlock({ error }: { error: PublicFichaError }) {
  const msg = {
    not_found: { title: 'Link não encontrado', body: 'Este link não existe ou nunca foi gerado. Confirme com quem te enviou se o link está correto.' },
    revoked: { title: 'Link revogado', body: 'Este link foi revogado pelo administrador e não pode mais ser acessado. Solicite um novo link.' },
    expired: { title: 'Link expirado', body: `Este link expirou${'expiredAt' in error && error.expiredAt ? ` em ${new Date(error.expiredAt).toLocaleDateString('pt-BR')}` : ''}. Solicite um novo link.` },
    server: { title: 'Erro ao carregar', body: 'message' in error ? error.message : 'Erro desconhecido. Tente recarregar a página.' },
  }[error.kind];

  return (
    <div style={{
      padding: 30, borderRadius: 14,
      background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt-0)', marginBottom: 8 }}>{msg.title}</div>
      <div style={{ fontSize: 13, color: 'var(--txt-2)', maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>{msg.body}</div>
    </div>
  );
}

function FichaContent({ data }: { data: PublicFichaData }) {
  const f = data.ficha;
  const tipoLabel = f.tipo === 'mrr' ? 'Mensalidade (MRR)' : 'Valor único (TCV)';
  const fpLabel = f.formaPagamento
    ? { cartao: 'Cartão', avista: 'À vista', mensalidade: 'Mensalidade', parcelado: 'Parcelado' }[f.formaPagamento]
    : null;

  const valorFmt = f.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      {/* Cabeçalho do cliente */}
      <div style={{
        padding: '24px 28px', borderRadius: 14,
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 10.5, color: 'var(--txt-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
          Cliente
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.3, fontFamily: 'var(--font-display)', marginBottom: 14 }}>
          {f.cliente ?? '—'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <KV label="Produto">{f.produto.icon} {f.produto.nome}</KV>
          <KV label="Mês de fechamento">{f.mes} {f.ano ?? ''}</KV>
          <KV label="Valor">{valorFmt}</KV>
          <KV label="Tipo">{tipoLabel}</KV>
          {fpLabel && <KV label="Forma de pagamento">{fpLabel}{f.parcelas ? ` em ${f.parcelas}x` : ''}</KV>}
          {f.tipo === 'mrr' && f.meses_mrr && <KV label="Duração">{f.meses_mrr} meses</KV>}
        </div>
      </div>

      {/* Vigência */}
      {(f.vigenciaInicio || f.vigenciaMeses) && (
        <Section title="Vigência">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            {f.vigenciaInicio && (
              <KV label="Início">{new Date(f.vigenciaInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</KV>
            )}
            {f.vigenciaMeses && <KV label="Duração">{f.vigenciaMeses} meses</KV>}
            {f.vigenciaInicio && f.vigenciaMeses && (
              <KV label="Término previsto">{computeEndDate(f.vigenciaInicio, f.vigenciaMeses)}</KV>
            )}
          </div>
        </Section>
      )}

      {/* Entregáveis */}
      {f.entregaveis && (
        <Section title="Entregáveis prometidos ao cliente">
          <Paragraph text={f.entregaveis} />
        </Section>
      )}

      {/* Notas operacional */}
      {f.notasOperacional && (
        <Section title="Notas pro time operacional">
          <Paragraph text={f.notasOperacional} />
        </Section>
      )}

      {/* Notas jurídico */}
      {f.notasJuridico && (
        <Section title="Notas pro jurídico">
          <Paragraph text={f.notasJuridico} />
        </Section>
      )}

      {/* Notas livres */}
      {f.notasLivres && (
        <Section title="Outras observações">
          <Paragraph text={f.notasLivres} />
        </Section>
      )}

      {/* Meta info */}
      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 20, textAlign: 'right' }}>
        {f.atualizadaEm && <>Ficha atualizada em {new Date(f.atualizadaEm).toLocaleString('pt-BR')} · </>}
        Expira em {new Date(data.tokenInfo.expiresAt).toLocaleDateString('pt-BR')} · {data.tokenInfo.accessCount} acesso{data.tokenInfo.accessCount === 1 ? '' : 's'}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '18px 24px', borderRadius: 12,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 10.5, color: 'var(--txt-3)', letterSpacing: 2,
        fontWeight: 600, marginBottom: 10, textTransform: 'uppercase',
      }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 3, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--txt-0)', fontWeight: 600, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 13.5, color: 'var(--txt-1)', lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    }}>{text}</div>
  );
}

function computeEndDate(start: string, months: number): string {
  const d = new Date(start + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('pt-BR');
}
