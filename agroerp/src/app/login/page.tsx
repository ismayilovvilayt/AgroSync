'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sprout } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Gözlənilməz xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Sprout size={28} color="white" />
          </div>
          <span className="login-logo-text">AgroSync</span>
        </div>

        <h1 className="login-title">Xoş gəlmisiniz</h1>
        <p className="login-subtitle">
          Hesabınıza daxil olun
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email ünvanı
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="admin@agroerp.az"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Şifrə
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full mt-4"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Daxil olunur...
              </>
            ) : (
              'Daxil ol'
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}
        >
          Demo: admin@agroerp.az / admin123
        </p>
      </div>
    </div>
  );
}
