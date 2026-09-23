import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { StoryHighlights } from '../components/profile/StoryHighlights';
import { ProfileTabs } from '../components/profile/ProfileTabs';
import { PostGrid } from '../components/profile/PostGrid';
import { SavedCollections } from '../components/profile/SavedCollections';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services';

export const ProfilePage = () => {
  const { username } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  // 탭 캐시: { posts: PostResponse[], saved: PostResponse[] }
  const [tabCache, setTabCache] = useState({ posts: null, saved: null });

  const isProfileRoot = !username || username === 'profile';
  let effectiveUsername = isProfileRoot ? (user?.username || 'hong_james') : (username || user?.username || 'hong_james');
  try {
    effectiveUsername = decodeURIComponent(effectiveUsername);
  } catch (e) {
    // fallback to original
  }
  const isMe = isProfileRoot || (user && (username === user.username || effectiveUsername === user.username));

  // 유효한 탭만 허용 (타인 프로필에서는 저장됨 탭 차단)
  const allowedTabs = isMe ? ['posts', 'saved'] : ['posts'];
  const initialTab = allowedTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'posts';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL search parameter if changed externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && allowedTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (tabParam && !allowedTabs.includes(tabParam)) {
      // 잘못된 탭 접근 시 posts로 복구
      setActiveTab('posts');
      setSearchParams({});
    }
  }, [searchParams, isMe]);

  const handleTabChange = (tabId) => {
    if (!allowedTabs.includes(tabId)) return;
    setActiveTab(tabId);
    setSearchParams(tabId === 'posts' ? {} : { tab: tabId });
  };

  // Fetch user profile (supports seamless background refresh without UI flashing)
  const fetchProfile = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const data = await userApi.getUserProfile(effectiveUsername);
      setProfileUser(data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      // Fallback
      if (isMe && user) {
        setProfileUser(user);
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [effectiveUsername, isMe, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Reset state on target username change
  useEffect(() => {
    setProfileUser(null);
    setTabCache({ posts: null, saved: null });
    setActiveTab('posts');
  }, [effectiveUsername]);

  // Fetch posts for active tab with Cache-First strategy
  const fetchTabContent = useCallback(async (tab, forceRefresh = false) => {
    // 캐시가 있고 강제 새로고침이 아니면 즉시 반환 (0초 로딩)
    if (!forceRefresh && tabCache[tab] !== null) {
      return;
    }

    setTabLoading(true);
    try {
      if (tab === 'saved') {
        if (!isMe) {
          setTabCache(prev => ({ ...prev, saved: [] }));
          return;
        }
        const saved = await userApi.getSavedPosts();
        setTabCache(prev => ({ ...prev, saved: saved || [] }));
      } else if (tab === 'posts') {
        const posts = await userApi.getUserPosts(effectiveUsername);
        setTabCache(prev => ({ ...prev, posts: posts || [] }));
      }
    } catch (err) {
      console.error(`Failed to load ${tab}:`, err);
      setTabCache(prev => ({ ...prev, [tab]: [] }));
    } finally {
      setTabLoading(false);
    }
  }, [activeTab, effectiveUsername, isMe, tabCache]);

  useEffect(() => {
    fetchTabContent(activeTab);
  }, [activeTab, effectiveUsername, fetchTabContent]);

  // 외부에서 북마크 토글 이벤트 수신 시 저장됨 탭 캐시 자동 갱신
  useEffect(() => {
    const handleBookmarkUpdate = () => {
      // 저장됨 탭 캐시 무효화 및 활성 탭이 saved면 즉시 재조회
      if (activeTab === 'saved') {
        fetchTabContent('saved', true);
      } else {
        setTabCache(prev => ({ ...prev, saved: null }));
      }
    };

    window.addEventListener('ig_bookmark_updated', handleBookmarkUpdate);
    return () => {
      window.removeEventListener('ig_bookmark_updated', handleBookmarkUpdate);
    };
  }, [activeTab, fetchTabContent]);

  const currentTabPosts = tabCache[activeTab] || [];

  const displayedUser = profileUser
    ? (isMe && user ? { ...profileUser, ...user } : profileUser)
    : (isMe && user
        ? {
            ...user,
            posts_count: user.posts_count || 0,
            followers_count: user.followers_count || 0,
            following_count: user.following_count || 0,
          }
        : {
            username: effectiveUsername,
            full_name: effectiveUsername,
            bio: '',
            profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
            posts_count: 0,
            followers_count: 0,
            following_count: 0,
          });

  const isPrivateLocked = displayedUser?.is_private && !isMe && !displayedUser?.is_following;

  return (
    <div
      style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '30px 16px 60px 16px',
        width: '100%',
      }}
      className="profile-page-container"
    >
      <ProfileHeader profileUser={displayedUser} isMe={isMe} onProfileRefresh={fetchProfile} />

      {isPrivateLocked ? (
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            marginTop: '32px',
            padding: '70px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '2px solid var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            비공개 계정입니다
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: 1.4 }}>
            사진과 동영상을 보려면 팔로우하세요.
          </p>
        </div>
      ) : (
        <>
          <StoryHighlights isMe={isMe} />
          <ProfileTabs activeTab={activeTab} onChangeTab={handleTabChange} isMe={isMe} />
          <div style={{ marginTop: '20px', minHeight: '300px' }}>
            {tabLoading && tabCache[activeTab] === null ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '60px 0',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--text-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              </div>
            ) : activeTab === 'saved' ? (
              <SavedCollections savedPosts={currentTabPosts} isMe={isMe} />
            ) : (
              <PostGrid posts={currentTabPosts} tab="posts" isMe={isMe} />
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .profile-page-container {
            padding: 14px 16px 40px 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
