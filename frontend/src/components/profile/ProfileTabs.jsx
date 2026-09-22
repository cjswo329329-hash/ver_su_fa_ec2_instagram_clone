import React from 'react';
import { Grid, Bookmark } from 'lucide-react';

export const ProfileTabs = ({ activeTab, onChangeTab, isMe = true }) => {
  const tabs = [
    { id: 'posts', label: '게시물', icon: Grid },
    ...(isMe ? [{ id: 'saved', label: '저장됨', icon: Bookmark }] : []),
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '40px',
        borderTop: '1px solid var(--border-color)',
      }}
      className="profile-tabs-wrapper"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '16px 4px',
              borderTop: isActive ? '1px solid var(--text-primary)' : '1px solid transparent',
              marginTop: '-1px',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <Icon size={14} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}

      <style>{`
        @media (max-width: 768px) {
          .profile-tabs-wrapper {
            gap: 0px !important;
            justify-content: space-around !important;
          }
          .profile-tabs-wrapper .tab-label {
            display: none;
          }
          .profile-tabs-wrapper button {
            padding: 12px 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
