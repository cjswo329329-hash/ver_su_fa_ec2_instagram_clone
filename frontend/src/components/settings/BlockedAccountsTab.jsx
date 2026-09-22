import React, { useState } from 'react';
import { UserX } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';

export const BlockedAccountsTab = ({ showToast }) => {
  const [blockedUsers, setBlockedUsers] = useState(() => {
    const saved = localStorage.getItem('ig_blocked_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [
      { id: 991, username: 'spammer_bot_1', full_name: '무료 이벤트 봇', profile_image_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' },
      { id: 992, username: 'ad_promoter_kr', full_name: '홍보 계정', profile_image_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150' }
    ];
  });

  const handleUnblock = (userId) => {
    setBlockedUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      localStorage.setItem('ig_blocked_users', JSON.stringify(updated));
      return updated;
    });
    if (showToast) showToast('차단이 해제되었습니다.');
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
        차단된 계정
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        차단한 사용자는 회원님의 프로필이나 게시물을 볼 수 없습니다.
      </p>

      {blockedUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <UserX size={40} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '15px' }}>차단된 계정이 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {blockedUsers.map(bUser => (
            <div
              key={bUser.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar src={bUser.profile_image_url} size="md" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{bUser.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{bUser.full_name}</div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleUnblock(bUser.id)}>
                차단 해제
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockedAccountsTab;
