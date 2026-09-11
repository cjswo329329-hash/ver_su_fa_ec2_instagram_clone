import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Heart, MessageCircle, Send } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { exploreApi } from '../services';

export const ExplorePage = () => {
  const { explorePosts, openPostDetail } = useModal();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [exploreItems, setExploreItems] = useState(explorePosts || []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const exploreSentinelRef = useRef(null);

  // Redirect guest to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/explore' } } });
    }
  }, [user, authLoading, navigate]);

  const handlePostClick = (post) => {
    if (!user) {
      navigate('/login');
      return;
    }
    openPostDetail(post);
  };

  // Initial fetch / search query fetch
  useEffect(() => {
    let isCancelled = false;
    const fetchExplore = async () => {
      try {
        setLoading(true);
        const data = await exploreApi.getExplore(searchQuery, 24, 0);
        if (!isCancelled) {
          if (data && data.length > 0) {
            setExploreItems(data);
            setHasMore(data.length >= 24);
          } else {
            setExploreItems([]);
            setHasMore(false);
          }
        }
      } catch (err) {
        console.warn('Backend explore fetch error:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const timer = setTimeout(fetchExplore, searchQuery ? 250 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Load more explore items
  const loadMoreExplore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    try {
      setLoadingMore(true);
      const nextOffset = exploreItems.length;
      const data = await exploreApi.getExplore(searchQuery, 24, nextOffset);
      if (data && data.length > 0) {
        setExploreItems(prev => {
          const existingIds = new Set(prev.map(item => `${item.is_video ? 'reel' : 'post'}-${item.id}`));
          const uniqueNew = data.filter(item => !existingIds.has(`${item.is_video ? 'reel' : 'post'}-${item.id}`));
          return [...prev, ...uniqueNew];
        });
        setHasMore(data.length >= 24);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more explore items:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, exploreItems.length, searchQuery]);

  // Observer for explore sentinel (1200px 사전 로딩으로 무한 스크롤 멈춤 현상 제거)
  useEffect(() => {
    const sentinel = exploreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        loadMoreExplore();
      }
    }, { rootMargin: '1200px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreExplore, hasMore, loadingMore, loading]);

  const displayedPosts = exploreItems.length > 0 ? exploreItems : explorePosts;

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '36px 24px 120px 24px',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* 1. Centered Rounded Pill Search Bar with generous spacing */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--border-subtle)',
          borderRadius: '28px',
          padding: '11px 22px',
          maxWidth: '500px',
          margin: '0 auto 36px auto',
          gap: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <Search size={18} color="var(--text-muted)" strokeWidth={2.2} />
        <input
          type="text"
          placeholder="검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            outline: 'none',
            fontSize: '15px',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* 2. Explore 4-Column Media Grid (Ultra-narrow gap: 2px) */}
      {displayedPosts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '100px 20px',
            color: 'var(--text-secondary)',
          }}
        >
          <p style={{ fontSize: '15px' }}>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2px',
            width: '100%',
          }}
          className="explore-grid-container"
        >
          {displayedPosts.map((post) => {
            const coverUrl = post.mediaUrl || post.media?.[0]?.mediaUrl;

            return (
              <div
                key={post.id}
                onClick={() => handlePostClick(post)}
                style={{
                  position: 'relative',
                  aspectRatio: '4 / 5',
                  backgroundColor: '#111111',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
                className="explore-card-item"
              >
                {/* Media Image */}
                <img
                  src={coverUrl}
                  alt={post.title || "Explore media"}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transition: 'transform 0.3s ease',
                  }}
                  loading="lazy"
                  className="explore-card-img"
                />


                {/* Hover Overlay with Likes and Comments */}
                <div
                  className="explore-hover-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    color: '#ffffff',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    zIndex: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '15px' }}>
                    <Heart size={20} fill="#ffffff" />
                    <span>{(post.likesCount || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '15px' }}>
                    <MessageCircle size={20} fill="#ffffff" />
                    <span>{(post.commentsCount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll Sentinel for Explore */}
      <div
        ref={exploreSentinelRef}
        style={{
          padding: '36px 0 20px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}
      >
        {loadingMore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--border-color)', borderTopColor: 'var(--ig-primary-button)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span>탐색 피드를 더 불러오는 중...</span>
          </div>
        )}
        {!hasMore && displayedPosts.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>✓ 모든 탐색 콘텐츠를 확인했습니다.</span>
        )}
      </div>

      {/* 3. Floating "메시지" Widget (Enlarged size & comfortable spacing) */}
      <button
        onClick={() => navigate(user ? '/direct' : '/login')}
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '32px',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '32px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '11px 20px',
          cursor: 'pointer',
          zIndex: 90,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        className="floating-dm-pill"
        title="메시지 확인하기"
      >
        {/* Instagram Paper Airplane */}
        <Send
          size={21}
          strokeWidth={2.2}
          style={{
            color: 'var(--text-primary)',
            transform: 'rotate(-20deg) translate(-1px, 1px)',
          }}
        />

        {/* Text */}
        <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
          메시지
        </span>

        {/* 3 Overlapping Avatars (Enlarged: 26px) */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
          <img
            src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100"
            alt="Friend 1"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '2px solid var(--bg-elevated)',
              objectFit: 'cover',
            }}
          />
          <img
            src="https://images.unsplash.com/photo-1552053831-71594a27632d?w=100"
            alt="Friend 2"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '2px solid var(--bg-elevated)',
              marginLeft: '-9px',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '2px solid var(--bg-elevated)',
              marginLeft: '-9px',
              backgroundColor: '#e4e6eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#737373">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>
      </button>

      <style>{`
        .explore-card-item:hover .explore-hover-overlay {
          opacity: 1 !important;
        }
        .explore-card-item:hover .explore-card-img {
          transform: scale(1.02);
        }
        .floating-dm-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.26) !important;
        }
        @media (max-width: 1024px) {
          .explore-grid-container {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .explore-grid-container {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .floating-dm-pill {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
