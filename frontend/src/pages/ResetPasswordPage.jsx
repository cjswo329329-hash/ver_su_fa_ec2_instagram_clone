import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, Eye, EyeOff, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { authApi } from '../services/authApi';
import { extractErrorMessage } from '../utils/errorHandler';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();

  // 1단계: 계정 확인
  const [identifier, setIdentifier] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null);

  // 2단계: 새 비밀번호 입력
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 3단계: 완료 여부
  const [isSuccess, setIsSuccess] = useState(false);

  // 에러 메시지
  const [error, setError] = useState('');

  // 1단계: 계정 확인 제출
  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!identifier.trim()) {
      setError('사용자 이름 또는 이메일을 입력해주세요.');
      return;
    }

    setError('');
    setVerifying(true);
    try {
      const res = await authApi.verifyAccount(identifier.trim());
      setVerifiedUser(res);
    } catch (err) {
      console.error('Verify error:', err);
      setError(extractErrorMessage(err, '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.'));
    } finally {
      setVerifying(false);
    }
  };

  // 2단계: 비밀번호 재설정 제출
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(verifiedUser.username, newPassword, verifiedUser.reset_token);
      setIsSuccess(true);
    } catch (err) {
      console.error('Reset error:', err);
      setError(extractErrorMessage(err, '비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  // 비밀번호 안전도 계산
  const getPasswordStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6) score += 30;
    if (newPassword.length >= 10) score += 20;
    if (/[a-zA-Z]/.test(newPassword)) score += 25;
    if (/[\d\W_]/.test(newPassword)) score += 25;
    return Math.min(score, 100);
  };

  const strength = getPasswordStrength();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '388px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Main Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '1px',
            padding: '36px 32px 28px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Top Lock Icon */}
          <div
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '50%',
              border: '2px solid var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: 'var(--text-primary)',
            }}
          >
            {isSuccess ? (
              <CheckCircle size={44} color="#10b981" />
            ) : verifiedUser ? (
              <KeyRound size={42} strokeWidth={1.75} />
            ) : (
              <Lock size={44} strokeWidth={1.75} />
            )}
          </div>

          {/* Title & Description */}
          {!isSuccess ? (
            <>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  marginBottom: '10px',
                  color: 'var(--text-primary)',
                }}
              >
                {verifiedUser ? '새 비밀번호 설정' : '로그인에 문제가 있나요?'}
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  marginBottom: '20px',
                }}
              >
                {verifiedUser
                  ? `'${verifiedUser.username}' 계정의 새 비밀번호를 입력해주세요.`
                  : '사용자 이름 또는 이메일을 입력하시면 계정을 확인한 후 새 비밀번호로 안전하게 재설정할 수 있습니다.'}
              </p>
            </>
          ) : (
            <>
              <h1
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  marginBottom: '10px',
                  color: '#10b981',
                }}
              >
                비밀번호 재설정 완료
              </h1>
              <p
                style={{
                  fontSize: '13.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: '24px',
                }}
              >
                비밀번호가 성공적으로 변경되었습니다.<br />
                새로운 비밀번호로 로그인해주세요.
              </p>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(237, 73, 86, 0.08)',
                border: '1px solid rgba(237, 73, 86, 0.3)',
                borderRadius: '6px',
                color: '#ed4956',
                fontSize: '12.5px',
                marginBottom: '16px',
                textAlign: 'left',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Verify Account */}
          {!verifiedUser && !isSuccess && (
            <form onSubmit={handleVerify} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="이메일 또는 사용자 이름"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError('');
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />

              {/* Quick test buttons */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', margin: '4px 0 6px 0' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('alex_creator');
                    if (error) setError('');
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  alex_creator 입력
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier('admin');
                    if (error) setError('');
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  admin 입력
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth={true}
                loading={verifying}
                disabled={!identifier.trim() || verifying}
                style={{ padding: '8px 0', borderRadius: '8px', fontWeight: 600 }}
              >
                계정 확인 및 계속
              </Button>
            </form>
          )}

          {/* Step 2: Set New Password */}
          {verifiedUser && !isSuccess && (
            <form onSubmit={handleResetPassword} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Account summary badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  textAlign: 'left',
                }}
              >
                {verifiedUser.profile_image_url ? (
                  <img
                    src={verifiedUser.profile_image_url}
                    alt={verifiedUser.username}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {verifiedUser.username[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {verifiedUser.username}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {verifiedUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedUser(null);
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    color: 'var(--ig-primary-button)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  변경
                </button>
              </div>

              {/* New Password input */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="새 비밀번호 (6자 이상)"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength indicator */}
              {newPassword && (
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <div
                    style={{
                      height: '4px',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginBottom: '4px',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${strength}%`,
                        backgroundColor: strength < 50 ? '#ed4956' : strength < 80 ? '#f59e0b' : '#10b981',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {strength < 50 ? '취약 (문자, 숫자 조합 권장)' : strength < 80 ? '적정' : '안전함'}
                  </span>
                </div>
              )}

              {/* Confirm Password input */}
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="새 비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    fontSize: '13px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                  }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth={true}
                loading={submitting}
                disabled={!newPassword || !confirmPassword || submitting}
                style={{ padding: '8px 0', borderRadius: '8px', fontWeight: 600, marginTop: '6px' }}
              >
                비밀번호 재설정 완료
              </Button>
            </form>
          )}

          {/* Step 3: Success Action */}
          {isSuccess && (
            <div style={{ width: '100%' }}>
              <Button
                type="button"
                variant="primary"
                fullWidth={true}
                onClick={() => {
                  navigate('/login', {
                    state: {
                      prefillUsername: verifiedUser?.username,
                      successMessage: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.',
                    },
                  });
                }}
                style={{ padding: '8px 0', borderRadius: '8px', fontWeight: 600 }}
              >
                새 비밀번호로 로그인하기
              </Button>
            </div>
          )}

          {/* Divider */}
          {!isSuccess && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  margin: '22px 0 16px 0',
                }}
              >
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
                <span
                  style={{
                    padding: '0 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  또는
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
              </div>

              {/* Create new account */}
              <NavLink
                to="/signup"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                }}
              >
                새 계정 만들기
              </NavLink>
            </>
          )}
        </div>

        {/* Back to Login Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '1px',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <NavLink
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} />
            <span>로그인으로 돌아가기</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
