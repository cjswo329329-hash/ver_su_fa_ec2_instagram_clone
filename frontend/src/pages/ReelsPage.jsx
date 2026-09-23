import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReelCard from '../components/reels/ReelCard';
import { ChevronUp, ChevronDown, Send } from 'lucide-react';
import { reelApi, followApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useAuthGuard } from '../hooks/useAuthGuard';

// Supabase Storage 49종 실제 릴스 비디오 기반 안전 폴백 데이터 (백엔드 지연/장애 시 빈 화면 원천 차단)
const FALLBACK_REELS = [
  {
    id: 1,
    videoUrl: 'https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels/reel1.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
    author: {
      id: 18,
      username: 'interior_하윤_16',
      fullName: '황하윤',
      profileImageUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
      isVerified: false,
      isFollowing: false
    },
    caption: 'AI Creates Your Perfect Morning Routine 🤯 #knowledge_daily #reels #viral',
    category: 'knowledge_daily',
    durationMs: 15000,
    audio: { title: 'Iron Beats - Heavy Lift', coverUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80' },
    likesCount: 12,
    isLiked: false,
    commentsCount: 2,
    sharesCount: 157,
    repostsCount: 61,
    isBookmarked: false,
    comments: []
  },
  {
    id: 2,
    videoUrl: 'https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels/reel2.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
    author: {
      id: 19,
      username: 'cafe_민서_17',
      fullName: '안민서',
      profileImageUrl: 'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=300&auto=format&fit=crop&q=80',
      isVerified: false,
      isFollowing: false
    },
    caption: '오늘의 모닝 커피 브루잉 루틴 ☕️ #cafe #reels #viral',
    category: 'cafe',
    durationMs: 18000,
    audio: { title: 'Gym Motivation - No Pain No Gain', coverUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80' },
    likesCount: 24,
    isLiked: false,
    commentsCount: 2,
    sharesCount: 86,
    repostsCount: 52,
    isBookmarked: false,
    comments: []
  },
  {
    id: 3,
    videoUrl: 'https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels/reel3.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80',
    author: {
      id: 102,
      username: 'food_채원_100',
      fullName: '홍채원',
      profileImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
      isVerified: false,
      isFollowing: false
    },
    caption: '직장인 월요병 현실 공감 #comedy #일상 #추천',
    category: 'comedy',
    durationMs: 20000,
    audio: { title: 'Golden Retriever - Happy Tail Wag', coverUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80' },
    likesCount: 38,
    isLiked: false,
    commentsCount: 1,
    sharesCount: 51,
    repostsCount: 38,
    isBookmarked: false,
    comments: []
  }
];

// 릴스 탭 재진입 시 0초 즉시 렌더링을 위한 전역 모듈 캐시
let _reelsCache = {
  items: null,
  offset: 0,
  seed: null,
};

export default function ReelsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { fetchFeed, fetchStories } = useModal();
  const { requireAuth } = useAuthGuard();

  // 세션 시드: 캐시가 있으면 유지, 없으면 1회 생성
  const [sessionSeed, setSessionSeed] = useState(() => _reelsCache.seed || Math.floor(Math.random() * 1000000));
  // 캐시가 있으면 즉시(0초) 렌더링
  const [reels, setReels] = useState(() => _reelsCache.items || []);
  const [loading, setLoading] = useState(!_reelsCache.items || _reelsCache.items.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentReel, setCommentReel] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(_reelsCache.offset || 0);
  const loadingRef = useRef(false);

  // Fetch initial batch of reels from backend with automatic retry and safety fallback
  const loadInitialReels = useCallback(async (isRetry = false) => {
    if (isRetry || !_reelsCache.items || _reelsCache.items.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await reelApi.getReels({ limit: 10, offset: 0, seed: sessionSeed });
      if (data && data.length > 0) {
        setReels(data);
        offsetRef.current = data.length;
        _reelsCache.items = data;
        _reelsCache.offset = data.length;
        _reelsCache.seed = sessionSeed;
      } else if (!_reelsCache.items || _reelsCache.items.length === 0) {
        // 백엔드 응답이 빈 배열일 때 안전 폴백 데이터 적용
        setReels(FALLBACK_REELS);
        _reelsCache.items = FALLBACK_REELS;
        _reelsCache.offset = FALLBACK_REELS.length;
      }
    } catch (err) {
      console.warn('Could not load reels from backend:', err);
      if (!_reelsCache.items || _reelsCache.items.length === 0) {
        // 네트워크 에러/서버 지연 시에도 사용자에게 빈 화면이 노출되지 않도록 폴백 제공
        setReels(FALLBACK_REELS);
        _reelsCache.items = FALLBACK_REELS;
        _reelsCache.offset = FALLBACK_REELS.length;
        setError('최신 릴스를 불러오는 데 지연이 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionSeed]);

  // 사이드바 또는 바텀바에서 릴스를 한 번 더 눌렀을 때: 최신 추천 알고리즘을 반영한 새로운 릴스 스트림 로드
  const refreshReels = useCallback(async () => {
    setIsRefreshing(true);
    setCommentReel(null); // 열린 댓글창 닫기

    // 화면 최상단(0번 릴스)으로 스크롤 이동
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setActiveIndex(0);

    // 새로운 랜덤 시드 생성하여 피드 셔플
    const newSeed = Math.floor(Math.random() * 1000000);
    setSessionSeed(newSeed);

    // 캐시 초기화
    _reelsCache.items = null;
    _reelsCache.offset = 0;
    _reelsCache.seed = newSeed;

    try {
      // refresh: true를 주어 백엔드에서 사용자 취향 프로필을 최신화하고 선호 카테고리 가중치 재계산
      const data = await reelApi.getReels({
        limit: 10,
        offset: 0,
        seed: newSeed,
        refresh: true,
      });

      if (data && data.length > 0) {
        setReels(data);
        offsetRef.current = data.length;
        _reelsCache.items = data;
        _reelsCache.offset = data.length;
      }
    } catch (err) {
      console.warn('Could not refresh reels from backend:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 700);
    }
  }, []);

  // 전역 'ig_reels_refresh' 이벤트 구독
  useEffect(() => {
    const handleReelsRefreshEvent = () => {
      refreshReels();
    };

    window.addEventListener('ig_reels_refresh', handleReelsRefreshEvent);
    return () => {
      window.removeEventListener('ig_reels_refresh', handleReelsRefreshEvent);
    };
  }, [refreshReels]);

  // 전역 'ig_post_activity' 이벤트 구독 (댓글 등록, 좋아요 변경 등 실시간 반영)
  useEffect(() => {
    const handleActivity = (e) => {
      const { postId, reelId, type, liked, likesCount, serverComment } = e.detail || {};
      const targetReelId = reelId || postId;
      if (!targetReelId) return;

      setReels((prev) => {
        let changed = false;
        const updated = prev.map((r) => {
          if (r.id === targetReelId) {
            const nextReel = { ...r };
            if (type === 'like' && liked !== undefined) {
              changed = true;
              nextReel.isLiked = liked;
              if (likesCount !== undefined) {
                nextReel.likesCount = likesCount;
              } else {
                nextReel.likesCount = Math.max(0, (nextReel.likesCount || 0) + (liked ? 1 : -1));
              }
            } else if (type === 'comment') {
              changed = true;
              const newCount = (nextReel.commentsCount ?? nextReel.comments_count ?? 0) + 1;
              nextReel.commentsCount = newCount;
              nextReel.comments_count = newCount;
              if (serverComment) {
                nextReel.comments = [serverComment, ...(nextReel.comments || [])];
              }
            }
            return nextReel;
          }
          return r;
        });
        if (changed) {
          _reelsCache.items = updated;
          return updated;
        }
        return prev;
      });
    };

    window.addEventListener('ig_post_activity', handleActivity);
    return () => window.removeEventListener('ig_post_activity', handleActivity);
  }, []);

  useEffect(() => {
    loadInitialReels();
  }, [loadInitialReels]);

  // Infinite scroll: load next random batch via seeded offset pagination
  const loadMoreReels = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const currentOffset = offsetRef.current;
      // 최근 본 40개 ID만 전달하여 URL 길이 및 파싱 오버헤드 최소화하면서 중복 방지
      const existingIds = reels.slice(-40).map(r => r.id).join(',');
      const moreData = await reelApi.getReels({
        limit: 10,
        offset: currentOffset,
        seed: sessionSeed,
        exclude_ids: existingIds
      });

      if (moreData && moreData.length > 0) {
        setReels((prev) => {
          const prevIdSet = new Set(prev.map(p => p.id));
          const uniqueNew = moreData.filter(item => !prevIdSet.has(item.id));
          const updated = [...prev, ...uniqueNew];
          _reelsCache.items = updated;
          return updated;
        });
        const newOffset = currentOffset + moreData.length;
        offsetRef.current = newOffset;
        _reelsCache.offset = newOffset;
      }
    } catch (err) {
      console.warn('Could not load more reels:', err);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [sessionSeed, reels]);

  // Trigger loadMore when user scrolls near the end (여유 있게 6개 전부터 사전 로딩)
  useEffect(() => {
    if (reels.length > 0 && activeIndex >= reels.length - 6 && !loadingMore) {
      loadMoreReels();
    }
  }, [activeIndex, reels.length, loadingMore, loadMoreReels]);

  // Global Audio Persistence
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('ig_reels_muted');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const containerRef = useRef(null);
  const reelRefs = useRef([]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ig_reels_muted', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const wheelCooldownRef = useRef(false);

  // IntersectionObserver to detect active reel in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.index);
            if (!isNaN(index)) {
              setActiveIndex(index);
              _reelsCache.activeIndex = index;
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.55,
      }
    );

    reelRefs.current = reelRefs.current.slice(0, reels.length);
    reelRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [reels]);

  // Scroll to index helper
  const scrollToIndex = useCallback((index) => {
    if (index >= 0 && index < reels.length) {
      const targetElement = reelRefs.current[index];
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveIndex(index);
      }
    }
  }, [reels.length]);

  // Desktop Mouse Wheel Glide: 1 smooth wheel flick = 1 reel glide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // 댓글 모달창 내부에서 발생한 휠 이벤트는 릴스 전환을 차단하여 댓글창 자체 스크롤 보장
      if (
        e.target.closest('.reels-comments-box-card') ||
        e.target.closest('.reel-desktop-comments-wrapper') ||
        e.target.closest('.reel-mobile-comments-portal') ||
        e.target.closest('.custom-comments-scrollbar')
      ) {
        return;
      }

      // Ignore subtle trackpad micro-movements
      if (Math.abs(e.deltaY) < 30) return;
      if (wheelCooldownRef.current) {
        e.preventDefault();
        return;
      }

      if (e.deltaY > 0) {
        // Wheel Down -> Next Reel
        if (activeIndex < reels.length - 1) {
          e.preventDefault();
          wheelCooldownRef.current = true;
          scrollToIndex(activeIndex + 1);
          setTimeout(() => {
            wheelCooldownRef.current = false;
          }, 350);
        }
      } else if (e.deltaY < 0) {
        // Wheel Up -> Prev Reel
        if (activeIndex > 0) {
          e.preventDefault();
          wheelCooldownRef.current = true;
          scrollToIndex(activeIndex - 1);
          setTimeout(() => {
            wheelCooldownRef.current = false;
          }, 350);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [activeIndex, reels.length, scrollToIndex]);

  // Keyboard navigation (j/k, ArrowUp/ArrowDown, M for mute)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, scrollToIndex, handleToggleMute]);

  // Toggle Follow
  const handleToggleFollow = useCallback(async (authorId) => {
    requireAuth(async () => {
      setReels((prevReels) =>
        prevReels.map((r) => {
          if (r.author.id === authorId) {
            return {
              ...r,
              author: { ...r.author, isFollowing: !r.author.isFollowing },
            };
          }
          return r;
        })
      );
      try {
        const res = await followApi.toggleFollow(authorId);
        setReels((prevReels) =>
          prevReels.map((r) => {
            if (r.author.id === authorId) {
              return {
                ...r,
                author: { ...r.author, isFollowing: res.following },
              };
            }
            return r;
          })
        );
        if (fetchFeed) fetchFeed();
        if (fetchStories) fetchStories();
      } catch (err) {
        console.error('Failed to toggle follow:', err);
      }
    }, { actionType: 'follow' });
  }, [requireAuth]);

  // Toggle Like
  const handleToggleLike = useCallback(async (reelId) => {
    requireAuth(async () => {
      setReels((prev) =>
        prev.map((r) => {
          if (r.id === reelId) {
            const nextLiked = !r.isLiked;
            return {
              ...r,
              isLiked: nextLiked,
              likesCount: nextLiked ? r.likesCount + 1 : Math.max(0, r.likesCount - 1),
            };
          }
          return r;
        })
      );
      try {
        const res = await reelApi.toggleReelLike(reelId);
        if (res && typeof res.likes_count === 'number') {
          setReels(prev => prev.map(r => r.id === reelId ? { ...r, isLiked: res.liked, likesCount: res.likes_count } : r));
        }
      } catch (err) {
        console.error('Failed to toggle reel like:', err);
      }
    }, { actionType: 'like' });
  }, [requireAuth]);

  // Toggle Bookmark
  const handleToggleBookmark = useCallback(async (reelId, nextBookmarked) => {
    requireAuth(async () => {
      setReels((prev) =>
        prev.map((r) => {
          if (r.id === reelId) {
            return {
              ...r,
              isBookmarked: nextBookmarked !== undefined ? nextBookmarked : !r.isBookmarked,
            };
          }
          return r;
        })
      );
      try {
        await reelApi.toggleReelBookmark(reelId);
        window.dispatchEvent(new CustomEvent('ig_bookmark_updated', { detail: { reelId } }));
      } catch (err) {
        console.error('Failed to toggle reel bookmark:', err);
      }
    }, { actionType: 'bookmark' });
  }, [requireAuth]);

  // Add Comment
  const handleAddComment = useCallback((reelId, newComment) => {
    setReels((prev) => {
      const updated = prev.map((r) => {
        if (r.id === reelId) {
          const nextCount = (r.commentsCount ?? r.comments_count ?? 0) + 1;
          return {
            ...r,
            commentsCount: nextCount,
            comments_count: nextCount,
            comments: [newComment, ...(r.comments || [])],
          };
        }
        return r;
      });
      _reelsCache.items = updated;
      return updated;
    });
  }, []);

  // Sync Comment Count from Comments Box
  const handleSyncCommentCount = useCallback((reelId, count) => {
    setReels((prev) => {
      let changed = false;
      const updated = prev.map((r) => {
        if (r.id === reelId && (r.commentsCount !== count || r.comments_count !== count)) {
          changed = true;
          return {
            ...r,
            commentsCount: count,
            comments_count: count,
          };
        }
        return r;
      });
      if (changed) {
        _reelsCache.items = updated;
        return updated;
      }
      return prev;
    });
  }, []);

  const handleOpenComments = useCallback((r) => {
    setCommentReel((prev) => (prev?.id === r.id ? null : r));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: { pathname: '/reels' } } });
    }
  }, [user, authLoading, navigate]);

  return (
    <div 
      className="reels-page-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 릴스 추천 알고리즘 갱신 인디케이터 배너 */}
      {isRefreshing && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            zIndex: 100,
            backgroundColor: 'rgba(38, 38, 38, 0.92)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: '#ffffff',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <span>맞춤 추천 릴스를 새로 불러왔습니다</span>
        </div>
      )}

      {/* Snap Scroll Reels Stream */}
      {loading && reels.length === 0 ? (
        /* 릴스 전용 스켈레톤 UI (첫 진입 시 우아하게 노출되어 빈 화면 차단) */
        <div
          style={{
            position: 'relative',
            height: 'calc(100vh - 36px)',
            maxHeight: '750px',
            aspectRatio: '9 / 16',
            width: 'auto',
            borderRadius: '12px',
            backgroundColor: '#0a0a0a',
            overflow: 'hidden',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '24px 20px',
            boxSizing: 'border-box',
            animation: 'reels-skeleton-pulse 1.4s infinite ease-in-out',
          }}
        >
          {/* Left bottom user & caption skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#262626' }} />
            <div style={{ width: '110px', height: '14px', borderRadius: '4px', backgroundColor: '#262626' }} />
          </div>
          <div style={{ width: '85%', height: '13px', borderRadius: '4px', backgroundColor: '#262626', marginBottom: '8px' }} />
          <div style={{ width: '55%', height: '13px', borderRadius: '4px', backgroundColor: '#262626' }} />

          {/* Right sidebar action buttons skeleton */}
          <div
            style={{
              position: 'absolute',
              right: '-64px',
              bottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#262626',
                  animation: 'reels-skeleton-pulse 1.4s infinite ease-in-out',
                }}
              />
            ))}
          </div>
        </div>
      ) : reels.length === 0 ? (
        /* 로딩 완료 후에도 데이터가 없을 때의 빈 화면 방지 안내 UI */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            textAlign: 'center',
            padding: '32px',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0 }}>
            {error || '표시할 릴스가 없습니다.'}
          </p>
          <button
            onClick={() => loadInitialReels(true)}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--ig-primary-button)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="reels-snap-container no-scrollbar"
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {reels.map((reel, index) => {
            // 슬라이딩 윈도우: 현재 활성 릴스 ± 2 (총 5개)를 마운트하여 스냅 스크롤 시 빈 박스 깜빡임 완전 방지
            const isNearby = Math.abs(index - activeIndex) <= 2;

            return (
              <div
                key={`${reel.id}-${index}`}
                ref={(el) => (reelRefs.current[index] = el)}
                data-index={index}
                className="reels-snap-item"
                style={{
                  boxSizing: 'border-box',
                  width: '100%',
                  height: '100%',
                  maxHeight: '100vh',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 0',
                }}
              >
                <ReelCard
                  reel={reel}
                  isActive={activeIndex === index}
                  isNearby={isNearby}
                  isMuted={isMuted}
                  onToggleMute={handleToggleMute}
                  onToggleFollow={handleToggleFollow}
                  onToggleLike={handleToggleLike}
                  onOpenComments={handleOpenComments}
                  isCommentsOpen={commentReel?.id === reel.id}
                  onCloseComments={() => setCommentReel(null)}
                  onAddComment={handleAddComment}
                  onSyncCommentCount={handleSyncCommentCount}
                  onToggleBookmark={handleToggleBookmark}
                />
              </div>
            );
          })}

        {/* Bottom Loading Indicator */}
        {loadingMore && (
          <div
            style={{
              padding: '24px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '2px solid var(--border-color)',
                borderTopColor: 'var(--ig-primary-button)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>다음 릴스 불러오는 중...</span>
          </div>
        )}
      </div>
      )}

      {/* Desktop Floating Navigation Up/Down Arrows */}
      <div className="reels-nav-arrows">
        <button
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="이전 릴스"
          className="reels-arrow-btn"
        >
          <ChevronUp size={20} strokeWidth={2.2} />
        </button>

        <button
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === reels.length - 1}
          aria-label="다음 릴스"
          className="reels-arrow-btn"
        >
          <ChevronDown size={20} strokeWidth={2.2} />
        </button>
      </div>

      {/* Floating Direct Message Pill Button */}
      <button
        onClick={() => navigate('/direct')}
        aria-label="다이렉트 메시지"
        className="reels-floating-message-btn"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={18} strokeWidth={2.2} style={{ transform: 'rotate(-12deg)' }} />
          <span style={{ fontWeight: 600, fontSize: '13.5px' }}>메시지</span>
        </div>

        {/* 3 Overlapping friend avatars from screenshot */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80"
            alt="friend 1"
            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-elevated)', marginLeft: '0px' }}
          />
          <img
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&auto=format&fit=crop&q=80"
            alt="friend 2"
            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-elevated)', marginLeft: '-8px' }}
          />
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&auto=format&fit=crop&q=80"
            alt="friend 3"
            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bg-elevated)', marginLeft: '-8px' }}
          />
        </div>
      </button>
      <style>{`
        @keyframes reels-skeleton-pulse {
          0% { opacity: 0.45; }
          50% { opacity: 0.9; }
          100% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
