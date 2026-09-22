import React, { useState } from 'react';
import { Heart, MessageCircle, Repeat, Send, Bookmark, MoreHorizontal } from 'lucide-react';

export const formatCount = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 10000) {
    return (num / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + '천';
  }
  return num.toLocaleString();
};

import { reelApi } from '../../services';

export const ReelActionSidebar = ({
  reel,
  isPlaying,
  onToggleLike,
  onOpenComments,
  onToggleBookmark,
  onOpenShare,
  onOpenOptionsMenu,
}) => {
  const [isBookmarked, setIsBookmarked] = useState(Boolean(reel?.isSaved || reel?.isBookmarked || reel?.is_bookmarked));
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(() => reel?.repostsCount ?? reel?.reposts_count ?? reel?.sharesCount ?? Math.floor(((reel?.likesCount || 12) * 0.08) + 1));

  React.useEffect(() => {
    setIsBookmarked(Boolean(reel?.isSaved || reel?.isBookmarked || reel?.is_bookmarked));
  }, [reel?.isSaved, reel?.isBookmarked, reel?.is_bookmarked]);

  const handleRepost = async () => {
    const next = !isReposted;
    setIsReposted(next);
    setRepostsCount(c => next ? c + 1 : Math.max(0, c - 1));
    if (reel?.id) {
      try {
        const res = await reelApi.repostReel(reel.id);
        if (res?.reposts_count !== undefined) {
          setRepostsCount(res.reposts_count);
        }
      } catch (err) {
        console.warn('Failed to repost reel on backend:', err);
      }
    }
  };

  const handleShare = async () => {
    if (reel?.id) {
      try {
        await reelApi.shareReel(reel.id);
      } catch (err) {
        console.warn('Failed to record reel share on backend:', err);
      }
    }
    if (onOpenShare) {
      onOpenShare();
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel?.id}`);
      alert('릴스 링크가 복사되었습니다.');
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(prev => {
      const next = !prev;
      if (onToggleBookmark && reel?.id) onToggleBookmark(reel.id, next);
      return next;
    });
  };

  return (
    <div 
      className="reel-desktop-actions"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '14px',
        flexShrink: 0,
        zIndex: 10,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Like Button */}
      <button 
        onClick={() => onToggleLike && reel?.id && onToggleLike(reel.id)}
        className="reel-action-btn"
        aria-label="좋아요"
      >
        <div style={{ padding: '2px' }}>
          <Heart 
            size={24} 
            strokeWidth={1.8}
            fill={reel?.isLiked ? "#ff3040" : "none"} 
            color={reel?.isLiked ? "#ff3040" : "var(--text-primary)"} 
            className={reel?.isLiked ? "like-bounce" : ""} 
          />
        </div>
        <span className="reel-action-count">{formatCount(reel?.likesCount ?? reel?.likes_count)}</span>
      </button>

      {/* 2. Comment Button */}
      <button 
        onClick={() => onOpenComments && onOpenComments(reel)}
        className="reel-action-btn"
        aria-label="댓글"
      >
        <div style={{ padding: '2px' }}>
          <MessageCircle 
            size={24} 
            strokeWidth={1.8}
            color="var(--text-primary)" 
          />
        </div>
        <span className="reel-action-count">{formatCount(reel?.commentsCount ?? reel?.comments_count)}</span>
      </button>

      {/* 3. Repost Button */}
      <button 
        onClick={handleRepost}
        className="reel-action-btn"
        aria-label="다시 게시"
      >
        <div style={{ padding: '2px' }}>
          <Repeat 
            size={24} 
            strokeWidth={1.8}
            color={isReposted ? "var(--ig-primary-button)" : "var(--text-primary)"} 
          />
        </div>
        <span className="reel-action-count">{formatCount(repostsCount)}</span>
      </button>

      {/* 4. Share Button */}
      <button 
        onClick={handleShare}
        className="reel-action-btn"
        aria-label="공유"
      >
        <div style={{ padding: '2px' }}>
          <Send 
            size={24} 
            strokeWidth={1.8}
            color="var(--text-primary)" 
          />
        </div>
      </button>

      {/* 5. Bookmark / Save Button */}
      <button 
        onClick={handleBookmark}
        className="reel-action-btn"
        aria-label="저장"
      >
        <div style={{ padding: '2px' }}>
          <Bookmark 
            size={24} 
            strokeWidth={1.8}
            fill={isBookmarked ? "var(--text-primary)" : "none"}
            color="var(--text-primary)" 
          />
        </div>
      </button>

      {/* 6. More Button */}
      <button 
        onClick={onOpenOptionsMenu}
        className="reel-more-btn"
        aria-label="더 보기"
        style={{ padding: '4px' }}
      >
        <MoreHorizontal size={22} strokeWidth={2} />
      </button>

      {/* 7. Audio Cover Thumbnail */}
      {reel?.audio && (
        <div style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1.5px solid var(--border-color)', overflow: 'hidden', marginTop: '2px' }}>
          <img 
            src={reel.audio.coverUrl || reel.author?.profileImageUrl} 
            alt="Track" 
            className="animate-spin-slow"
            style={{ width: '100%', height: '100%', objectFit: 'cover', animationPlayState: isPlaying ? 'running' : 'paused' }}
          />
        </div>
      )}
    </div>
  );
};

export default ReelActionSidebar;
