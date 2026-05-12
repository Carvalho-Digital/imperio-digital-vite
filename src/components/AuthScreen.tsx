import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'login') {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      const err = await signUp(email, password);
      if (err) {
        setError(err);
      } else {
        setInfo('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: 360, padding: '40px 36px', background: 'var(--bg-2)',
        border: '1px solid var(--border)', borderRadius: 16,
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>👑</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt-0)', fontFamily: 'var(--font-display)' }}>
            Império Digital
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4 }}>
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--txt-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              style={{
                width: '100%', padding: '9px 12px', background: 'var(--bg-1)',
                border: '1px solid var(--border-strong)', borderRadius: 8,
                color: 'var(--txt-0)', fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--txt-2)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '9px 12px', background: 'var(--bg-1)',
                border: '1px solid var(--border-strong)', borderRadius: 8,
                color: 'var(--txt-0)', fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', background: 'var(--red-soft)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              color: 'var(--red)', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          {info && (
            <div style={{
              padding: '8px 12px', background: 'var(--green-soft)',
              border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8,
              color: 'var(--green)', fontSize: 12,
            }}>
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '10px 0',
              background: loading ? 'var(--bg-4)' : 'var(--silver-grad)',
              border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              color: loading ? 'var(--txt-2)' : '#0a0a0c',
              fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--txt-2)' }}>
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button
                onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver-1)', textDecoration: 'underline', fontSize: 12, padding: 0 }}
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                onClick={() => { setMode('login'); setError(null); setInfo(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver-1)', textDecoration: 'underline', fontSize: 12, padding: 0 }}
              >
                Entrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
