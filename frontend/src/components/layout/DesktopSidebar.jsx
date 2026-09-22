import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Compass,
  Film,
  MessageCircle,
  Heart,
  PlusSquare,
  Menu,
  Sun,
  Moon,
  LogOut,
  Settings,
  Bookmark,
  LogIn,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useModal } from '../../contexts/ModalContext';
import { Avatar } from '../common/Avatar';

export const DesktopSidebar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { openCreatePost, openNotifications, openAuthPromptModal } = useModal();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isDirect = location.pathname.startsWith('/direct');
  const isExplore = location.pathname.startsWith('/explore');
  const isSettings = location.pathname.startsWith('/accounts');
  const isReels = location.pathname.startsWith('/reels');
  const isCollapsed = isDirect || isExplore || isSettings || isReels;

  const handleAuthRequiredAction = (action, actionType = 'default', title, description) => {
    if (!user) {
      openAuthPromptModal({ actionType, title, description });
      return;
    }
    action();
  };

  const navItems = [
    { label: '홈', icon: Home, path: '/' },
    {
      label: '검색',
      icon: Search,
      path: user ? '/explore' : undefined,
      onClick: user ? undefined : () => navigate('/login', { state: { from: { pathname: '/explore' } } })
    },
    {
      label: '릴스',
      icon: Film,
      path: user ? '/reels' : undefined,
      onClick: (e) => {
        if (!user) {
          e?.preventDefault();
          navigate('/login', { state: { from: { pathname: '/reels' } } });
          return;
        }
        if (location.pathname.startsWith('/reels')) {
          e?.preventDefault();
          window.dispatchEvent(new CustomEvent('ig_reels_refresh'));
        }
      }
    },
    {
      label: '메시지',
      icon: MessageCircle,
      path: user ? '/direct' : undefined,
      onClick: user ? undefined : () => openAuthPromptModal({
        actionType: 'message',
        title: '메시지를 보내고 실시간으로 대화하세요',
        description: 'Instagram에 로그인하여 1:1 다이렉트 메시지를 주고받을 수 있습니다.'
      })
    },
    {
      label: '알림',
      icon: Heart,
      onClick: () => handleAuthRequiredAction(
        () => openNotifications(),
        'default',
        '활동 알림을 확인하세요',
        'Instagram에 로그인하여 게시물 반응 및 팔로우 알림을 실시간으로 확인하세요.'
      )
    },
    {
      label: '만들기',
      icon: PlusSquare,
      onClick: () => handleAuthRequiredAction(
        () => openCreatePost(),
        'create',
        '새로운 게시물 만들기',
        'Instagram에 로그인하여 사진과 동영상을 공유해보세요.'
      )
    },
    user ? {
      label: '프로필',
      customIcon: (
        <Avatar
          src={user?.profile_image_url}
          size="xs"
          alt="Profile"
        />
      ),
      path: `/${user.username}`
    } : {
      label: '로그인',
      icon: LogIn,
      path: '/login'
    },
    ...(user && (user.is_admin || user.isAdmin) ? [{
      label: '관리자',
      icon: ShieldCheck,
      path: '/admin',
    }] : [])
  ];

  return (
    <aside
      className={`desktop-sidebar-container ${isCollapsed ? 'is-collapsed' : ''}`}
    >
      {/* Top Logo & Navigation */}
      <div>
        {/* Top Logo Container */}
        <div className="sidebar-logo-wrapper" style={{ padding: '0 0 24px 0', height: '48px', position: 'relative' }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', height: '100%', textDecoration: 'none', position: 'relative' }}>
            {/* Expanded Instagram Wordmark Logo */}
            <span
              className="sidebar-brand-wordmark brand-logo"
              style={{
                color: 'var(--text-primary)',
                paddingLeft: '12px',
                lineHeight: 1,
              }}
            >
              Instagram
            </span>

            {/* Collapsed Instagram Camera Icon Logo */}
            <div
              className="sidebar-brand-icon"
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                left: 0,
                top: 0,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--text-primary)' }}
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item, idx) => {
            const Icon = item.icon;

            const renderContent = (isActive) => (
              <div className="sidebar-nav-item-content">
                <div className="sidebar-icon-box">
                  {item.customIcon ? (
                    item.customIcon
                  ) : (
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  )}
                </div>
                <span
                  className="sidebar-nav-label"
                  style={{
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {item.label}
                </span>
              </div>
            );

            if (!item.path && item.onClick) {
              return (
                <div
                  key={idx}
                  onClick={item.onClick}
                  className="sidebar-nav-link"
                >
                  {renderContent(false)}
                </div>
              );
            }

            return (
              <NavLink
                key={idx}
                to={item.path}
                end={item.path === '/'}
                onClick={item.onClick}
                className={({ isActive }) =>
                  isActive ? 'sidebar-nav-link active-link' : 'sidebar-nav-link'
                }
              >
                {({ isActive }) => renderContent(isActive)}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: More Menu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          {showMoreMenu && (
            <div
              className="modal-enter"
              style={{
                position: 'absolute',
                bottom: '56px',
                left: '0px',
                width: '240px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 300,
              }}
            >
              <button
                onClick={() => {
                  toggleTheme();
                  setShowMoreMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  textAlign: 'left',
                }}
                className="nav-item-hover"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                <span>{isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}</span>
              </button>

              {user ? (
                <>
                  <button
                    onClick={() => {
                      navigate(`/${user.username}?tab=saved`);
                      setShowMoreMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    className="nav-item-hover"
                  >
                    <Bookmark size={18} />
                    <span>저장됨</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate('/accounts/edit');
                      setShowMoreMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    className="nav-item-hover"
                  >
                    <Settings size={18} />
                    <span>설정</span>
                  </button>

                  {(user.is_admin || user.isAdmin) && (
                    <button
                      onClick={() => {
                        navigate('/admin');
                        setShowMoreMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        color: 'var(--ig-danger)',
                        fontWeight: 600,
                        fontSize: '14px',
                        textAlign: 'left',
                      }}
                      className="nav-item-hover"
                    >
                      <ShieldCheck size={18} />
                      <span>관리자 콘솔</span>
                    </button>
                  )}

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                  <button
                    onClick={() => {
                      logout();
                      setShowMoreMenu(false);
                      navigate('/login');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: 'var(--ig-danger)',
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    className="nav-item-hover"
                  >
                    <LogOut size={18} />
                    <span>로그아웃</span>
                  </button>
                </>
              ) : (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      navigate('/login');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: 'var(--ig-primary-button)',
                      fontWeight: 600,
                      fontSize: '14px',
                      textAlign: 'left',
                    }}
                    className="nav-item-hover"
                  >
                    <LogIn size={18} />
                    <span>로그인</span>
                  </button>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="sidebar-nav-link"
            style={{ width: '100%' }}
          >
            <div className="sidebar-nav-item-content">
              <div className="sidebar-icon-box">
                <Menu size={24} strokeWidth={showMoreMenu ? 3 : 2} />
              </div>
              <span
                className="sidebar-nav-label"
                style={{
                  fontWeight: showMoreMenu ? 700 : 500,
                }}
              >
                더 보기
              </span>
            </div>
          </button>
        </div>
      </div>

      <style>{`
        /* Sidebar container base */
        .desktop-sidebar-container {
          width: var(--sidebar-width-expanded);
          border-right: 1px solid var(--border-color);
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 20px 12px;
          background-color: var(--bg-primary);
          z-index: 100;
          box-sizing: border-box;
          transition: width 0.25s cubic-bezier(0.2, 0, 0, 1);
        }

        /* Collapsed State on desktop (>1264px) */
        .desktop-sidebar-container.is-collapsed {
          width: var(--sidebar-width-collapsed);
        }

        /* Logo styling and smooth cross-fade */
        .sidebar-brand-wordmark {
          opacity: 1;
          transform: scale(1);
          transform-origin: left center;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .sidebar-brand-icon {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.9);
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .desktop-sidebar-container.is-collapsed .sidebar-brand-wordmark {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.85);
        }
        .desktop-sidebar-container.is-collapsed .sidebar-brand-icon {
          opacity: 1;
          pointer-events: auto;
          transform: scale(1);
        }

        /* Nav links & items */
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
          cursor: pointer;
          width: 100%;
          overflow: hidden;
          transition: background-color var(--transition-fast);
        }
        .sidebar-nav-link:hover,
        .nav-item-hover:hover {
          background-color: var(--border-subtle);
        }

        .sidebar-nav-item-content {
          display: flex;
          align-items: center;
          width: 100%;
          height: 48px;
          position: relative;
        }

        /* 48px Stationary Icon Box - Center stays precisely at x=36px */
        .sidebar-icon-box {
          width: 48px;
          min-width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Smooth text slide & fade */
        .sidebar-nav-label {
          font-size: 16px;
          margin-left: 8px;
          white-space: nowrap;
          overflow: hidden;
          opacity: 1;
          max-width: 160px;
          transform: translateX(0);
          transition: opacity 0.15s ease, max-width 0.25s cubic-bezier(0.2, 0, 0, 1), transform 0.15s ease;
        }
        .desktop-sidebar-container.is-collapsed .sidebar-nav-label {
          opacity: 0 !important;
          max-width: 0 !important;
          margin-left: 0 !important;
          transform: translateX(-8px);
          pointer-events: none;
        }

        /* Responsive Breakpoints */
        /* Screen width <= 1264px: Always collapsed */
        @media (max-width: 1264px) {
          .desktop-sidebar-container {
            width: var(--sidebar-width-collapsed) !important;
          }
          .sidebar-brand-wordmark {
            opacity: 0 !important;
            pointer-events: none !important;
          }
          .sidebar-brand-icon {
            opacity: 1 !important;
            pointer-events: auto !important;
            transform: scale(1) !important;
          }
          .sidebar-nav-label {
            opacity: 0 !important;
            max-width: 0 !important;
            margin-left: 0 !important;
            pointer-events: none !important;
          }
        }

        /* Screen width <= 768px: Hidden (Mobile navigation active) */
        @media (max-width: 768px) {
          .desktop-sidebar-container {
            display: none !important;
          }
        }
      `}</style>
    </aside>
  );
};
