import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Heart, MessageCircle, Send } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import { useAuth } from '../contexts/AuthContext';
import { exploreApi } from '../services';

// 돋보기 탭 재진입 시 0초 렌더링 및 번쩍임 방지를 위한 모듈 레벨 메모리 캐시
let _exploreCache = {
  items: null,
  hasMore: true,
  query: '',
};

export const ExplorePage = () => {
  const { openPostDetail } = useModal();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  // 캐시가 있으면 즉시(0초) 렌더링, 없으면 빈 배열로 시작 (더미 데이터로 인한 번쩍임 원천 차단)
  const [exploreItems, setExploreItems] = useState(() => _exploreCache.items || []);
  const [loading, setLoading] = useState(!_exploreCache.items);
  const [hasMore, setHasMore] = useState(_exploreCache.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const exploreSentinelRef = useRef(null);

  // Redirect guest to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/explore' } } });
    }
  }, [user, authLoading, navigate]);

  // 모달 등에서 발생한 좋아요, 북마크, 댓글 변경 사항을 탐색 피드 아이템 및 캐시에 즉시 동기화
  useEffect(() => {
    const handleActivity = (e) => {
      const { postId, isVideo, isLiked, likesCount, newComment, incrementCommentCount, tempId, serverComment } = e.detail;
      setExploreItems(prev => {
        const updated = prev.map(item => {
          const isItemVideo = Boolean(item.is_video || item.isVideo);
          const isMatch = item.id === postId && (isVideo === undefined || isItemVideo === Boolean(isVideo));
          if (isMatch) {
            const nextItem = { ...item };
            if (typeof isLiked === 'boolean') {
              nextItem.isLiked = isLiked;
              nextItem.is_liked = isLiked;
            }
            if (typeof likesCount === 'number') {
              nextItem.likesCount = likesCount;
              nextItem.likes_count = likesCount;
            }
            if (newComment) {
              const prevComments = nextItem.comments || [];
              nextItem.comments = [...prevComments, newComment];
              const newCount = (nextItem.commentsCount ?? nextItem.comments_count ?? prevComments.length) + 1;
              nextItem.commentsCount = newCount;
              nextItem.comments_count = newCount;
            } else if (incrementCommentCount) {
              const newCount = (nextItem.commentsCount ?? nextItem.comments_count ?? 0) + 1;
              nextItem.commentsCount = newCount;
              nextItem.comments_count = newCount;
            }
            if (tempId && serverComment && nextItem.comments) {
              nextItem.comments = nextItem.comments.map(c => c.id === tempId ? { ...c, id: serverComment.id } : c);
            }
            return nextItem;
          }
          return item;
        });
        if (_exploreCache.items) {
          _exploreCache.items = updated;
        }
        return updated;
      });
    };

    window.addEventListener('ig_post_activity', handleActivity);
    return () => window.removeEventListener('ig_post_activity', handleActivity);
  }, []);

  const handlePostClick = (post) => {
    if (!user) {
      navigate('/login');
      return;
    }
    // exploreItems에서 최신 상태의 post를 가져와 전달 (모달 내 변경 사항이 완벽히 반영된 최신 객체)
    const currentPost = exploreItems.find(
      item => item.id === post.id && Boolean(item.is_video ?? item.isVideo) === Boolean(post.is_video ?? post.isVideo)
    ) || post;
    openPostDetail(currentPost);
  };

  // Initial fetch / search query fetch
  useEffect(() => {
    let isCancelled = false;
    const isSearching = Boolean(searchQuery.trim());

    // 이미 캐시가 있고 검색어가 없는 첫 마운트인 경우 백그라운드 갱신
    const shouldShowSkeleton = isSearching ? true : !_exploreCache.items;

    const fetchExplore = async () => {
      try {
        if (shouldShowSkeleton) {
          setLoading(true);
        }
        const data = await exploreApi.getExplore(searchQuery, 24, 0);
        if (!isCancelled) {
          if (data && data.length > 0) {
            setExploreItems(data);
            setHasMore(data.length >= 24);
            if (!isSearching) {
              _exploreCache = { items: data, hasMore: data.length >= 24, query: '' };
            }
          } else {
            setExploreItems([]);
            setHasMore(false);
            if (!isSearching) {
              _exploreCache = { items: [], hasMore: false, query: '' };
            }
          }
        }
      } catch (err) {
        console.warn('Backend explore fetch error:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const timer = setTimeout(fetchExplore, isSearching ? 300 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Load more explore items
  const loadMoreExplore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || exploreItems.length === 0) return;
    try {
      setLoadingMore(true);
      const nextOffset = exploreItems.length;
      const data = await exploreApi.getExplore(searchQuery, 24, nextOffset);
      if (data && data.length > 0) {
        setExploreItems(prev => {
          const existingIds = new Set(prev.map(item => `${item.is_video ? 'reel' : 'post'}-${item.id}`));
          const uniqueNew = data.filter(item => !existingIds.has(`${item.is_video ? 'reel' : 'post'}-${item.id}`));
          const updated = [...prev, ...uniqueNew];
          if (!searchQuery.trim()) {
            _exploreCache.items = updated;
            _exploreCache.hasMore = data.length >= 24;
          }
          return updated;
        });
        setHasMore(data.length >= 24);
      } else {
        setHasMore(false);
        if (!searchQuery.trim()) {
          _exploreCache.hasMore = false;
        }
      }
    } catch (err) {
      console.warn('Failed to load more explore items:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, exploreItems.length, searchQuery]);

  // Observer for explore sentinel (400px 사전 로딩으로 안정적 무한 스크롤)
  useEffect(() => {
    const sentinel = exploreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && exploreItems.length > 0) {
        loadMoreExplore();
      }
    }, { rootMargin: '400px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreExplore, hasMore, loadingMore, loading, exploreItems.length]);

  const displayedPosts = exploreItems;

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
      {loading && displayedPosts.length === 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '2px',
            width: '100%',
          }}
          className="explore-grid-container"
        >
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                aspectRatio: '4 / 5',
                backgroundColor: 'var(--border-subtle, #262626)',
                borderRadius: '0px',
                overflow: 'hidden',
                animation: 'explore-shimmer 1.5s infinite ease-in-out',
              }}
            />
          ))}
        </div>
      ) : displayedPosts.length === 0 ? (
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
            const coverUrl = post.mediaUrl || post.media_url || post.media?.[0]?.mediaUrl || post.media?.[0]?.media_url;
            const itemKey = `${post.is_video || post.isVideo ? 'reel' : 'post'}-${post.id}`;

            return (
              <div
                key={itemKey}
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
                    <span>{((post.likesCount ?? post.likes_count) || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '15px' }}>
                    <MessageCircle size={20} fill="#ffffff" />
                    <span>{((post.commentsCount ?? post.comments_count ?? post.comments?.length) || 0).toLocaleString()}</span>
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
        @keyframes explore-shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 0.9; }
          100% { opacity: 0.5; }
        }
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
