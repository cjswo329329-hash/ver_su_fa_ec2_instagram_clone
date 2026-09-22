import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, Film, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Avatar } from '../common/Avatar';

export const MobileBottomBar = () => {
  const { user } = useAuth();
  const { openCreatePost, openAuthPromptModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const isReels = location.pathname.startsWith('/reels');

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-bar-height-mobile)',
        backgroundColor: isReels ? 'rgba(0, 0, 0, 0.88)' : 'var(--bg-primary)',
        backdropFilter: isReels ? 'blur(12px)' : 'none',
        borderTop: isReels ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 90,
      }}
      className="mobile-only-bottom"
    >
      <NavLink to="/" style={{ color: isReels ? '#ffffff' : 'var(--text-primary)' }}>
        <Home size={24} />
      </NavLink>

      {/* 돋보기 (Search/Explore) */}
      <button
        onClick={() => {
          if (!user) {
            navigate('/login', { state: { from: { pathname: '/explore' } } });
          } else {
            navigate('/explore');
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          color: isReels ? '#ffffff' : (location.pathname === '/explore' ? 'var(--text-primary)' : 'var(--text-secondary)'),
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Search"
      >
        <Search size={24} strokeWidth={location.pathname === '/explore' ? 2.5 : 2} />
      </button>

      <button
        onClick={() => {
          if (!user) {
            navigate('/login', { state: { from: { pathname: '/' } } });
          } else {
            openCreatePost();
          }
        }}
        style={{ color: isReels ? '#ffffff' : 'var(--text-primary)', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label="Create Post"
      >
        <PlusSquare size={24} />
      </button>

      {/* 릴스 (Reels) */}
      <button
        onClick={() => {
          if (!user) {
            navigate('/login', { state: { from: { pathname: '/reels' } } });
          } else if (isReels) {
            window.dispatchEvent(new CustomEvent('ig_reels_refresh'));
          } else {
            navigate('/reels');
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          color: isReels ? '#ffffff' : (location.pathname === '/reels' ? 'var(--text-primary)' : 'var(--text-secondary)'),
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Reels"
      >
        <Film size={24} strokeWidth={isReels ? 2.5 : 2} />
      </button>
      {user ? (
        <NavLink to={`/${user.username}`}>
          <Avatar src={user.profile_image_url} size="xs" />
        </NavLink>
      ) : (
        <NavLink to="/login" style={{ color: 'var(--text-primary)' }} aria-label="Login">
          <User size={24} />
        </NavLink>
      )}

      <style>{`
        @media (min-width: 769px) {
          .mobile-only-bottom {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
};
