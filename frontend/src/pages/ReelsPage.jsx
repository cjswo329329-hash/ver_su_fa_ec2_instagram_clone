import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { initialReels } from '../data/reelsData';
import ReelCard from '../components/reels/ReelCard';
import { ChevronUp, ChevronDown, Send } from 'lucide-react';
import { reelApi, followApi } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function ReelsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { fetchFeed, fetchStories } = useModal();
  const { requireAuth } = useAuthGuard();
  // Random session seed: created once per page visit so shuffle is stable across scrolling
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [reels, setReels] = useState(() => initialReels || []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentReel, setCommentReel] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  // Fetch initial random batch of reels from backend
  useEffect(() => {
    let cancelled = false;
    const loadInitialReels = async () => {
      try {
        const data = await reelApi.getReels({ limit: 10, offset: 0, seed: sessionSeed });
        if (!cancelled && data && data.length > 0) {
          setReels(data);
          offsetRef.current = data.length;
        } else if (!cancelled && (!reels || reels.length === 0)) {
          setReels(initialReels);
        }
      } catch (err) {
        console.warn('Could not load reels from backend, using fallback:', err);
        if (!cancelled && (!reels || reels.length === 0)) {
          setReels(initialReels);
        }
      }
    };
    loadInitialReels();
    return () => { cancelled = true; };
  }, [sessionSeed]);

  // Infinite scroll: load next random batch via seeded offset pagination
  const loadMoreReels = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const currentOffset = offsetRef.current;
      const existingIds = reels.map(r => r.id).join(',');
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
          return [...prev, ...uniqueNew];
        });
        offsetRef.current = currentOffset + moreData.length;
      }
    } catch (err) {
      console.warn('Could not load more reels:', err);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [sessionSeed]);

  // Trigger loadMore when user scrolls near the end (within 5 reels of bottom)
  useEffect(() => {
    if (reels.length > 0 && activeIndex >= reels.length - 5 && !loadingMore) {
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

  // Add Comment
  const handleAddComment = useCallback((reelId, newComment) => {
    setReels((prev) =>
      prev.map((r) => {
        if (r.id === reelId) {
          return {
            ...r,
            commentsCount: r.commentsCount + 1,
            comments: [newComment, ...(r.comments || [])],
          };
        }
        return r;
      })
    );
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
      {/* Snap Scroll Reels Stream */}
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
          // Virtualization sliding window: active reel ± 2 are mounted with full video
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
    </div>
  );
}
