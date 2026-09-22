import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomBar } from './MobileBottomBar';
import { CreatePostModal } from '../post-create/CreatePostModal';
import { StoryViewerModal } from '../story-viewer/StoryViewerModal';
import { CreateStoryModal } from '../story-viewer/CreateStoryModal';
import { PostDetailModal } from '../post-detail/PostDetailModal';
import { OptionsModal } from '../common/OptionsModal';
import { NotificationsModal } from '../notifications/NotificationsModal';
import { AuthPromptModal } from '../common/AuthPromptModal';
import { GuestStickyBar } from './GuestStickyBar';
import { useModal } from '../../contexts/ModalContext';

export const AppLayout = () => {
  const { isNotificationsOpen, closeNotifications } = useModal();
  const location = useLocation();
  const isDirect = location.pathname.startsWith('/direct');
  const isExplore = location.pathname.startsWith('/explore');
  const isSettings = location.pathname.startsWith('/accounts');
  const isReels = location.pathname.startsWith('/reels');
  const isCollapsed = isDirect || isExplore || isSettings || isReels;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Desktop & Tablet Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
        className={`app-main-content-wrapper ${isCollapsed ? 'is-sidebar-collapsed is-direct-page' : ''}`}
      >
        {!isDirect && !isSettings && !isReels && <MobileHeader />}

        <main
          style={{
            flex: 1,
            height: (isDirect || isSettings || isReels) ? '100vh' : 'auto',
            paddingBottom: (isDirect || isSettings || isReels) ? 0 : '60px',
            overflow: (isDirect || isSettings || isReels) ? 'hidden' : 'visible',
          }}
        >
          <Outlet />
        </main>

        <MobileBottomBar />
      </div>

      {/* Guest Sticky Bar */}
      <GuestStickyBar />

      {/* Global Modals */}
      <CreatePostModal />
      <StoryViewerModal />
      <CreateStoryModal />
      <PostDetailModal />
      <OptionsModal />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={closeNotifications} />
      <AuthPromptModal />

      <style>{`
        @media (min-width: 769px) {
          .app-main-content-wrapper {
            margin-left: var(--sidebar-width-expanded);
            transition: margin-left 0.25s cubic-bezier(0.2, 0, 0, 1);
          }
          .app-main-content-wrapper.is-sidebar-collapsed,
          .app-main-content-wrapper.is-direct-page {
            margin-left: var(--sidebar-width-collapsed);
          }
        }
        @media (min-width: 769px) and (max-width: 1264px) {
          .app-main-content-wrapper {
            margin-left: var(--sidebar-width-collapsed) !important;
          }
        }
        @media (max-width: 768px) {
          .app-main-content-wrapper {
            margin-left: 0;
            padding-bottom: var(--bottom-bar-height-mobile);
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};
