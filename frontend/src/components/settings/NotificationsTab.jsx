import React, { useState } from 'react';
import { ToggleSwitch } from './ToggleSwitch';

export const NotificationsTab = ({ showToast }) => {
  const [pauseAllNotifications, setPauseAllNotifications] = useState(() => {
    const saved = localStorage.getItem('ig_pause_notifications');
    return saved !== null ? saved === 'true' : false;
  });

  const [likesNotif, setLikesNotif] = useState(() => {
    return localStorage.getItem('ig_likes_notif') || 'everyone';
  });

  const [directNotif, setDirectNotif] = useState(() => {
    const saved = localStorage.getItem('ig_direct_notif');
    return saved !== null ? saved === 'true' : true;
  });

  const handlePauseToggle = (val) => {
    setPauseAllNotifications(val);
    localStorage.setItem('ig_pause_notifications', String(val));
    if (showToast) {
      showToast(val ? '모든 알림이 일시 중단되었습니다.' : '알림 수신이 재개되었습니다.');
    }
  };

  const handleLikesChange = (optId) => {
    setLikesNotif(optId);
    localStorage.setItem('ig_likes_notif', optId);
  };

  const handleDirectToggle = (val) => {
    setDirectNotif(val);
    localStorage.setItem('ig_direct_notif', String(val));
    if (showToast) {
      showToast(val ? '메시지 알림이 켜졌습니다.' : '메시지 알림이 꺼졌습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '28px' }}>
        알림 설정
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>모두 일시 중단</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              푸시 알림을 일시적으로 수신하지 않습니다.
            </div>
          </div>
          <ToggleSwitch
            checked={pauseAllNotifications}
            onChange={handlePauseToggle}
          />
        </div>

        <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>좋아요 알림</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'off', label: '해제' },
              { id: 'following', label: '내가 팔로우하는 사람' },
              { id: 'everyone', label: '모든 사람' }
            ].map(opt => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="likes_notif"
                  checked={likesNotif === opt.id}
                  onChange={() => handleLikesChange(opt.id)}
                  style={{ accentColor: 'var(--ig-primary-button)', width: '18px', height: '18px' }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>메시지 알림</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              새로운 Direct 메시지가 오면 알림을 받습니다.
            </div>
          </div>
          <ToggleSwitch
            checked={directNotif}
            onChange={handleDirectToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default NotificationsTab;
