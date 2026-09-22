import React from 'react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { ChangeAvatarModal } from '../profile/ChangeAvatarModal';
import { ToggleSwitch } from './ToggleSwitch';
import { useProfileForm } from '../../hooks/useProfileForm';

export const ProfileEditTab = ({ showToast }) => {
  const {
    user,
    fullName,
    setFullName,
    username,
    setUsername,
    website,
    setWebsite,
    bio,
    setBio,
    gender,
    setGender,
    showSuggestions,
    handleSuggestionToggle,
    avatarUrl,
    isAvatarModalOpen,
    setIsAvatarModalOpen,
    isSubmitting,
    handleProfileSubmit,
    handleAvatarChange,
  } = useProfileForm(showToast);

  return (
    <div>
      <h2 className="settings-desktop-title" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '28px' }}>
        프로필 편집
      </h2>

      {/* Avatar Header Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          marginBottom: '28px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Avatar src={avatarUrl || user?.profile_image_url} size="lg" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{username || user?.username}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fullName || user?.full_name}</div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAvatarModalOpen(true)}
          style={{ fontWeight: 600, padding: '8px 16px', borderRadius: '8px' }}
        >
          사진 바꾸기
        </Button>
      </div>

      <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
            웹사이트
          </label>
          <input
            type="url"
            placeholder="https://yourwebsite.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            프로필에 링크를 추가하여 방문자들을 외부 사이트로 안내하세요.
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
            이름
          </label>
          <input
            type="text"
            placeholder="이름"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            사람들이 회원님의 계정을 찾을 수 있도록 널리 알려진 이름을 사용하세요.
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
            사용자 이름
          </label>
          <input
            type="text"
            placeholder="사용자 이름"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
            소개
          </label>
          <textarea
            rows={4}
            placeholder="자신을 표현해보세요 ✨"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={150}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              resize: 'none',
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {bio.length} / 150
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
            성별
          </label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="female">여성</option>
            <option value="male">남성</option>
            <option value="custom">직접 지정</option>
            <option value="not_specified">밝히고 싶지 않음</option>
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 0',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ paddingRight: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>프로필에 계정 추천 표시</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              사람들이 회원님의 프로필을 볼 때 유사한 추천 계정을 표시합니다.
            </div>
          </div>
          <ToggleSwitch
            checked={showSuggestions}
            onChange={handleSuggestionToggle}
          />
        </div>

        <div style={{ marginTop: '12px' }}>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            style={{ padding: '10px 32px', fontWeight: 600 }}
          >
            {isSubmitting ? '저장 중...' : '제출'}
          </Button>
        </div>
      </form>

      <ChangeAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={avatarUrl || user?.profile_image_url || user?.profileImageUrl}
        onAvatarChange={handleAvatarChange}
      />
    </div>
  );
};

export default ProfileEditTab;
