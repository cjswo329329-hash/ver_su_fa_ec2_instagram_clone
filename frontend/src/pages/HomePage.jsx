import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { StoryTray } from '../components/feed/StoryTray';
import { PostCard } from '../components/feed/PostCard';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { SuggestionsModal } from '../components/feed/SuggestionsModal';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { followApi } from '../services';

export const HomePage = () => {
  const { user, allUsers, loadSuggestions } = useAuth();
  const { posts, loadMoreFeed, hasMoreFeed, loadingMoreFeed, fetchFeed, fetchStories } = useModal();
  const { requireAuth } = useAuthGuard();
  const [followingMap, setFollowingMap] = useState({});
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const navigate = useNavigate();
  const feedSentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = feedSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreFeed && !loadingMoreFeed) {
          loadMoreFeed();
        }
      },
      { rootMargin: '1200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreFeed, hasMoreFeed, loadingMoreFeed]);

  const toggleFollow = async (userId) => {
    requireAuth(async () => {
      const current = !followingMap[userId];
      setFollowingMap(prev => ({
        ...prev,
        [userId]: !current
      }));
      try {
        const res = await followApi.toggleFollow(userId);
        setFollowingMap(prev => ({
          ...prev,
          [userId]: res.following
        }));

        // 팔로우 즉시 홈 피드와 스토리 실시간 새로고침!
        await fetchFeed();
        await fetchStories();
        if (loadSuggestions) {
          loadSuggestions();
        }
      } catch (err) {
        console.error('Follow error:', err);
        setFollowingMap(prev => ({
          ...prev,
          [userId]: current
        }));
      }
    }, { actionType: 'follow' });
  };

  // Filter recommendations: other users
  const suggestions = allUsers.filter(u => u.id !== user?.id).slice(0, 5);

  const footerLinks = [
    '소개', '도움말', '홍보 센터', 'API', '채용 정보',
    '개인정보처리방침', '약관', '위치', '언어', 'Meta Verified'
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      }}
    >
      {/* Feed and Sidebar Area */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '24px',
          gap: '64px',
          width: '100%',
        }}
        className="home-feed-sidebar-wrapper"
      >
        {/* Center Feed Area (max 630px) */}
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--feed-max-width)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <StoryTray />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          <div
            ref={feedSentinelRef}
            style={{
              padding: '24px 0 40px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '13px',
            }}
          >
            {loadingMoreFeed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--border-color)', borderTopColor: 'var(--ig-primary-button)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>게시물을 불러오는 중...</span>
              </div>
            )}
            {!hasMoreFeed && posts.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>✓ 모든 최신 게시물을 확인했습니다.</span>
            )}
          </div>
        </div>

        {/* Right Sidebar Suggestions (Width 320px, visible on >= 1200px) */}
        <aside
          style={{
            width: 'var(--right-sidebar-width)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '16px',
          }}
          className="home-right-sidebar"
        >
          {/* User Profile Card or Guest Login Card */}
          {user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <NavLink to={`/${user.username}`}>
                  <Avatar src={user.profile_image_url} size="md" />
                </NavLink>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <NavLink
                    to={`/${user.username}`}
                    style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    {user.username}
                  </NavLink>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {user.full_name}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '18px 16px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                marginBottom: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Instagram에 로그인하세요
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  로그인하여 다양한 크리에이터의 최신 소식을 확인하고 좋아요와 댓글을 남겨보세요.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth={true}
                  onClick={() => navigate('/login')}
                  style={{ borderRadius: '8px', padding: '8px 0' }}
                >
                  로그인
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={true}
                  onClick={() => navigate('/signup')}
                  style={{ borderRadius: '8px', padding: '8px 0' }}
                >
                  가입하기
                </Button>
              </div>
            </div>
          )}

          {/* Suggestions for You Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              회원님을 위한 추천
            </span>
            <button
              onClick={() => setIsSuggestionsModalOpen(true)}
              style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              모두 보기
            </button>
          </div>

          {/* Suggestions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
            {suggestions.map((sug) => {
              const isFollowing = !!followingMap[sug.id];

              return (
                <div
                  key={sug.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <NavLink to={`/${sug.username}`}>
                      <Avatar src={sug.profile_image_url} size="sm" />
                    </NavLink>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <NavLink
                        to={`/${sug.username}`}
                        style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}
                      >
                        {sug.username}
                      </NavLink>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {sug.followers_count ? `${sug.followers_count.toLocaleString()}명이 팔로우 중` : '인기 크리에이터'}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="text"
                    size="sm"
                    onClick={() => toggleFollow(sug.id)}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isFollowing ? 'var(--text-primary)' : 'var(--ig-primary-button)'
                    }}
                  >
                    {isFollowing ? '팔로잉' : '팔로우'}
                  </Button>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Site Info Footer (Moved to Bottom of Page) */}
      <footer
        style={{
          width: '100%',
          maxWidth: '960px',
          marginTop: '60px',
          padding: '24px 16px 40px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          {footerLinks.map((link, idx) => (
            <span
              key={idx}
              style={{
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '12px',
              }}
              className="footer-link-hover"
            >
              {link}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          © 2026 INSTAGRAM FROM META
        </div>
      </footer>

      <SuggestionsModal
        isOpen={isSuggestionsModalOpen}
        onClose={() => {
          setIsSuggestionsModalOpen(false);
          if (loadSuggestions) loadSuggestions();
        }}
      />

      <style>{`
        .footer-link-hover:hover {
          color: var(--text-primary) !important;
          text-decoration: underline;
        }
        @media (max-width: 1199px) {
          .home-right-sidebar {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .home-feed-sidebar-wrapper {
            padding-top: 0 !important;
            gap: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
