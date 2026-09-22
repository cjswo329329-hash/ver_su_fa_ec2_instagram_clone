import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ToggleSwitch } from './ToggleSwitch';

export const AccountPrivacyTab = ({ showToast }) => {
  const { user, updateProfile } = useAuth();

  const [isPrivate, setIsPrivate] = useState(() => {
    if (user && user.is_private !== undefined) return !!user.is_private;
    const saved = localStorage.getItem('ig_is_private');
    return saved !== null ? saved === 'true' : false;
  });

  const [showActivityStatus, setShowActivityStatus] = useState(() => {
    const saved = localStorage.getItem('ig_activity_status');
    return saved !== null ? saved === 'true' : true;
  });

  const [allowStorySharing, setAllowStorySharing] = useState(() => {
    const saved = localStorage.getItem('ig_story_sharing');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    if (user && user.is_private !== undefined) {
      setIsPrivate(!!user.is_private);
      localStorage.setItem('ig_is_private', String(user.is_private));
    }
  }, [user]);

  const handlePrivateToggle = async (val) => {
    setIsPrivate(val);
    localStorage.setItem('ig_is_private', String(val));
    try {
      await updateProfile({ is_private: val });
      if (showToast) {
        showToast(val ? '비공개 계정으로 전환되었습니다.' : '공개 계정으로 전환되었습니다.');
      }
    } catch (err) {
      console.error('Failed to update privacy setting:', err);
    }
  };

  const handleActivityStatusToggle = (val) => {
    setShowActivityStatus(val);
    localStorage.setItem('ig_activity_status', String(val));
    if (showToast) {
      showToast(val ? '활동 상태 표시가 활성화되었습니다.' : '활동 상태 표시가 비활성화되었습니다.');
    }
  };

  const handleStorySharingToggle = (val) => {
    setAllowStorySharing(val);
    localStorage.setItem('ig_story_sharing', String(val));
    if (showToast) {
      showToast(val ? '스토리 메시지 공유가 허용되었습니다.' : '스토리 메시지 공유가 비허용되었습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '28px' }}>
        계정 공개 범위
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ paddingRight: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>비공개 계정</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              계정이 비공개 상태인 경우 승인한 사람만 회원님의 사진과 동영상을 볼 수 있습니다.
            </div>
          </div>
          <ToggleSwitch
            checked={isPrivate}
            onChange={handlePrivateToggle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ paddingRight: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>활동 상태 표시</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              마지막으로 활동한 시간을 메시지를 주고받은 사람들에게 표시합니다.
            </div>
          </div>
          <ToggleSwitch
            checked={showActivityStatus}
            onChange={handleActivityStatusToggle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ paddingRight: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>스토리 메시지 공유 허용</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              다른 사람이 회원님의 스토리를 Direct 메시지로 공유할 수 있습니다.
            </div>
          </div>
          <ToggleSwitch
            checked={allowStorySharing}
            onChange={handleStorySharingToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default AccountPrivacyTab;
