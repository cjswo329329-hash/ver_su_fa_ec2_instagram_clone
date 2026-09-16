import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const prefill = location.state?.prefillUsername;
  const initialSuccess = location.state?.successMessage;

  const [username, setUsername] = useState(prefill || 'alex_creator');
  const [password, setPassword] = useState(prefill ? '' : 'aaaa1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(initialSuccess || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login({
        username_or_email: username.trim(),
        username: username.trim(),
        password
      });
      if (res.success) {
        const isAdmin = Boolean(res.user?.is_admin || res.user?.isAdmin);
        const defaultPath = isAdmin ? '/admin' : '/';
        const from = location.state?.from?.pathname || searchParams.get('returnUrl') || defaultPath;
        navigate(from, { replace: true });
      } else {
        setError(res.error || '로그인에 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Main Login Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '1px',
            padding: '40px 36px 24px 36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span className="brand-logo" style={{ color: 'var(--text-primary)', marginBottom: '28px' }}>
            Instagram
          </span>

          {successInfo && (
            <div
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                color: '#10b981',
                fontSize: '12px',
                textAlign: 'center',
                marginBottom: '14px',
                lineHeight: 1.4,
              }}
            >
              {successInfo}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="전화번호, 사용자 이름 또는 이메일"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 8px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                color: 'var(--text-primary)',
              }}
            />

            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 8px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                color: 'var(--text-primary)',
              }}
            />

            {error && (
              <div style={{ color: '#ed4956', fontSize: '13px', textAlign: 'center', margin: '4px 0' }}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth={true}
              loading={loading}
              disabled={!username || !password || loading}
              style={{ marginTop: '8px', padding: '7px 0', borderRadius: '8px' }}
            >
              로그인
            </Button>
          </form>

          <NavLink
            to="/accounts/password/reset"
            style={{
              fontSize: '12px',
              color: 'var(--ig-link)',
              marginTop: '20px',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            비밀번호를 잊으셨나요?
          </NavLink>
        </div>

        {/* Signup Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '1px',
            padding: '20px',
            textAlign: 'center',
            fontSize: '14px',
          }}
        >
          계정이 없으신가요?{' '}
          <NavLink to="/signup" style={{ color: 'var(--ig-primary-button)', fontWeight: 600 }}>
            가입하기
          </NavLink>
        </div>

        {/* Admin Demo Helper Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '14px 16px',
            textAlign: 'center',
            fontSize: '13px',
          }}
        >
          <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px' }}>
            🔐 <strong>관리자 계정</strong>: admin / pass123
          </div>
          <button
            type="button"
            onClick={() => {
              setUsername('admin');
              setPassword('pass123');
            }}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              backgroundColor: 'rgba(237, 73, 86, 0.08)',
              color: 'var(--ig-danger)',
              border: '1px solid rgba(237, 73, 86, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            관리자 계정 정보 자동 입력
          </button>
        </div>
      </div>
    </div>
  );
};
