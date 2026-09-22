import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Lock,
  Shield,
  Bell,
  Palette,
  UserX,
  Activity,
  HelpCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  Star,
  MessageSquare,
  Tag,
  EyeOff,
  Heart,
  Archive,
  Clock,
  Briefcase,
  BarChart3,
  Key,
  FileText,
  Smartphone
} from 'lucide-react';

// Subcomponents / Panels
import { ProfileEditTab } from '../components/settings/ProfileEditTab';
import { PersonalDetailsPanel } from '../components/settings/PersonalDetailsPanel';
import { PasswordSecurityPanel } from '../components/settings/PasswordSecurityPanel';
import { TwoFactorPanel } from '../components/settings/TwoFactorPanel';
import { LoginActivityPanel } from '../components/settings/LoginActivityPanel';
import { AccountPrivacyTab } from '../components/settings/AccountPrivacyTab';
import { CloseFriendsPanel } from '../components/settings/CloseFriendsPanel';
import { HiddenWordsPanel } from '../components/settings/HiddenWordsPanel';
import { TagsMentionsPanel } from '../components/settings/TagsMentionsPanel';
import { BlockedAccountsTab } from '../components/settings/BlockedAccountsTab';
import { RestrictedAccountsPanel } from '../components/settings/RestrictedAccountsPanel';
import { ActivityOverviewTab } from '../components/settings/ActivityOverviewTab';
import { LikedPostsPanel } from '../components/settings/LikedPostsPanel';
import { ArchivePanel } from '../components/settings/ArchivePanel';
import { SearchHistoryPanel } from '../components/settings/SearchHistoryPanel';
import { ProfessionalPanel } from '../components/settings/ProfessionalPanel';
import { InsightsPanel } from '../components/settings/InsightsPanel';
import { NotificationsTab } from '../components/settings/NotificationsTab';
import { DisplayMediaTab } from '../components/settings/DisplayMediaTab';
import { HelpLegalPanel } from '../components/settings/HelpLegalPanel';

export const EditProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') || 'edit-profile';
  const [activeTab, setActiveTab] = useState(tabParam);
  const isMobileMenu = activeTab === 'menu';

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === 'edit-profile' ? {} : { tab: tabId });
  };

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const navSections = [
    {
      title: 'Meta 계정 센터',
      items: [
        { id: 'edit-profile', label: '프로필 편집', icon: User },
        { id: 'personal-details', label: '개인정보', icon: FileText },
        { id: 'password', label: '비밀번호 및 보안', icon: Shield },
        { id: 'two-factor', label: '2단계 인증', icon: Key },
        { id: 'login-activity', label: '로그인 활동', icon: Smartphone },
      ]
    },
    {
      title: '상호작용 및 개인정보',
      items: [
        { id: 'privacy', label: '계정 공개 범위', icon: Lock },
        { id: 'close-friends', label: '친한 친구', icon: Star },
        { id: 'hidden-words', label: '댓글 및 숨긴 단어', icon: MessageSquare },
        { id: 'tags-mentions', label: '태그 및 언급', icon: Tag },
        { id: 'blocked', label: '차단된 계정', icon: UserX },
        { id: 'restricted', label: '제한된 계정', icon: EyeOff },
      ]
    },
    {
      title: '내 활동 및 보관함',
      items: [
        { id: 'activity', label: '내 활동 개요', icon: Activity },
        { id: 'liked-posts', label: '좋아요한 콘텐츠', icon: Heart },
        { id: 'archive', label: '보관함', icon: Archive },
        { id: 'search-history', label: '검색 내역', icon: Clock },
      ]
    },
    {
      title: '프로페셔널 & 크리에이터',
      items: [
        { id: 'professional', label: '프로페셔널 전환', icon: Briefcase },
        { id: 'insights', label: '계정 인사이트', icon: BarChart3 },
      ]
    },
    {
      title: '앱 환경설정 및 지원',
      items: [
        { id: 'notifications', label: '알림', icon: Bell },
        { id: 'display', label: '디스플레이 및 미디어', icon: Palette },
        { id: 'help', label: '고객 센터 및 정보', icon: HelpCircle },
      ]
    }
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
      className="settings-page-root"
    >
      {/* Toast notification banner */}
      {toastMessage && (
        <div
          className="modal-enter"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            padding: '12px 24px',
            borderRadius: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Check size={18} color="var(--ig-primary-button)" strokeWidth={3} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Settings Container (Full Screen Dual-Pane) */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: 'var(--bg-primary)',
          overflow: 'hidden',
        }}
        className="settings-card-wrapper"
      >
        {/* Left Navigation Sidebar */}
        <aside
          style={{
            width: '320px',
            minWidth: '290px',
            borderRight: '1px solid var(--border-color)',
            padding: '28px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: 'var(--bg-primary)',
            flexShrink: 0,
            overflowY: 'auto',
            height: '100%',
          }}
          className={`settings-sidebar no-scrollbar ${isMobileMenu ? 'mobile-visible' : 'mobile-hidden'}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="settings-mobile-back-btn"
              aria-label="Back to Profile"
            >
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              설정
            </h2>
          </div>

          {/* Meta Accounts Center Banner Box */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ig-primary-button)', fontWeight: 700, fontSize: '13px' }}>
              <span>∞ Meta</span>
              <span style={{ color: 'var(--text-primary)' }}>계정 센터</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              비밀번호, 보안, 개인정보 등 환경을 통합 관리하세요.
            </p>
          </div>

          {/* Grouped Navigation Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {navSections.map((sec, secIdx) => (
              <div key={secIdx}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    padding: '0 10px 8px 10px',
                  }}
                >
                  {sec.title}
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '13.5px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                        className="settings-menu-item"
                      >
                        <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                        {isActive && <ChevronRight size={14} color="var(--text-secondary)" />}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Content Area */}
        <main
          style={{
            flex: 1,
            padding: '36px 56px 80px 56px',
            overflowY: 'auto',
            height: '100%',
            display: 'flex',
            justifyContent: 'flex-start',
          }}
          className={`settings-content-area ${isMobileMenu ? 'mobile-hidden' : 'mobile-visible'}`}
        >
          <div style={{ width: '100%', maxWidth: '800px' }}>
            {/* Mobile Header Bar for Content Area */}
            <div className="settings-mobile-content-header">
              <button
                type="button"
                onClick={() => {
                  if (activeTab !== 'edit-profile' && searchParams.get('tab')) {
                    navigate('/accounts/edit?tab=menu');
                  } else {
                    navigate(-1);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="뒤로가기"
              >
                <ChevronLeft size={26} strokeWidth={2.2} />
              </button>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {activeTab === 'edit-profile' || activeTab === 'menu'
                  ? '프로필 편집'
                  : (navSections.flatMap(s => s.items).find(i => i.id === activeTab)?.label || '설정')}
              </h3>
              <div style={{ width: '26px' }} />
            </div>

            {/* TAB: EDIT PROFILE */}
            {(activeTab === 'edit-profile' || activeTab === 'menu') && (
              <ProfileEditTab showToast={showToast} />
            )}

            {/* TAB: PERSONAL DETAILS */}
            {activeTab === 'personal-details' && (
              <PersonalDetailsPanel showToast={showToast} />
            )}

            {/* TAB: PASSWORD & SECURITY */}
            {activeTab === 'password' && (
              <PasswordSecurityPanel showToast={showToast} />
            )}

            {/* TAB: TWO FACTOR AUTH */}
            {activeTab === 'two-factor' && (
              <TwoFactorPanel showToast={showToast} />
            )}

            {/* TAB: LOGIN ACTIVITY */}
            {activeTab === 'login-activity' && (
              <LoginActivityPanel showToast={showToast} />
            )}

            {/* TAB: ACCOUNT PRIVACY */}
            {activeTab === 'privacy' && (
              <AccountPrivacyTab showToast={showToast} />
            )}

            {/* TAB: CLOSE FRIENDS */}
            {activeTab === 'close-friends' && (
              <CloseFriendsPanel showToast={showToast} />
            )}

            {/* TAB: HIDDEN WORDS */}
            {activeTab === 'hidden-words' && (
              <HiddenWordsPanel showToast={showToast} />
            )}

            {/* TAB: TAGS & MENTIONS */}
            {activeTab === 'tags-mentions' && (
              <TagsMentionsPanel showToast={showToast} />
            )}

            {/* TAB: BLOCKED ACCOUNTS */}
            {activeTab === 'blocked' && (
              <BlockedAccountsTab showToast={showToast} />
            )}

            {/* TAB: RESTRICTED ACCOUNTS */}
            {activeTab === 'restricted' && (
              <RestrictedAccountsPanel showToast={showToast} />
            )}

            {/* TAB: YOUR ACTIVITY OVERVIEW */}
            {activeTab === 'activity' && (
              <ActivityOverviewTab onSelectTab={handleSelectTab} />
            )}

            {/* TAB: LIKED POSTS */}
            {activeTab === 'liked-posts' && (
              <LikedPostsPanel showToast={showToast} />
            )}

            {/* TAB: ARCHIVE */}
            {activeTab === 'archive' && (
              <ArchivePanel showToast={showToast} />
            )}

            {/* TAB: SEARCH HISTORY */}
            {activeTab === 'search-history' && (
              <SearchHistoryPanel showToast={showToast} />
            )}

            {/* TAB: PROFESSIONAL CONVERSION */}
            {activeTab === 'professional' && (
              <ProfessionalPanel showToast={showToast} />
            )}

            {/* TAB: INSIGHTS */}
            {activeTab === 'insights' && (
              <InsightsPanel />
            )}

            {/* TAB: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <NotificationsTab showToast={showToast} />
            )}

            {/* TAB: DISPLAY & THEME */}
            {activeTab === 'display' && (
              <DisplayMediaTab showToast={showToast} />
            )}

            {/* TAB: HELP, FAQ & LEGAL */}
            {activeTab === 'help' && (
              <HelpLegalPanel showToast={showToast} />
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @media (max-width: 768px) {
          .settings-page-root {
            height: auto !important;
            min-height: 100vh !important;
            overflow: visible !important;
            animation: slideInFromRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            will-change: transform;
          }
          .settings-mobile-back-btn {
            display: flex !important;
          }
          .settings-card-wrapper {
            flex-direction: column !important;
            height: auto !important;
            overflow: visible !important;
          }
          .settings-sidebar.mobile-hidden {
            display: none !important;
          }
          .settings-sidebar.mobile-visible {
            display: flex !important;
            width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border-color) !important;
            padding: 16px !important;
          }
          .settings-content-area.mobile-hidden {
            display: none !important;
          }
          .settings-content-area.mobile-visible {
            display: flex !important;
            padding: 16px 16px 80px 16px !important;
            height: auto !important;
            overflow: visible !important;
          }
          .settings-mobile-content-header {
            display: flex !important;
            align-items: center;
            justifyContent: space-between;
            padding: 0 0 16px 0;
            margin-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
          }
          .settings-desktop-title {
            display: none !important;
          }
        }
        @media (min-width: 769px) {
          .settings-mobile-content-header {
            display: none !important;
          }
          .settings-sidebar {
            display: flex !important;
          }
          .settings-content-area {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default EditProfilePage;
