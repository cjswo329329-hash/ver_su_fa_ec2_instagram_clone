import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, MoreHorizontal, User, Music, Send, Bookmark } from 'lucide-react';
import { formatCount } from './ReelActionSidebar';

export const ReelMobileOverlay = ({
  reel,
  isPlaying,
  onToggleFollow,
  onToggleLike,
  onOpenComments,
  onToggleBookmark,
  onOpenShare,
  onOpenOptionsMenu,
}) => {
  const [isBookmarked, setIsBookmarked] = useState(Boolean(reel?.isSaved || reel?.isBookmarked || reel?.is_bookmarked));

  useEffect(() => {
    setIsBookmarked(Boolean(reel?.isSaved || reel?.isBookmarked || reel?.is_bookmarked));
  }, [reel?.isSaved, reel?.isBookmarked, reel?.is_bookmarked]);

  const handleBookmark = () => {
    setIsBookmarked(prev => {
      const next = !prev;
      if (onToggleBookmark && reel?.id) onToggleBookmark(reel.id, next);
      return next;
    });
  };

  const handleShare = () => {
    if (onOpenShare) {
      onOpenShare();
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel?.id}`);
    }
  };

  return (
    <>
      {/* Mobile Info Overlay (Shown on screens < 1024px) */}
      <div className="reel-mobile-overlay" style={{ paddingRight: '64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <a href={`/${reel?.author?.username}`} style={{ flexShrink: 0 }}>
            <img 
              src={reel?.author?.profileImageUrl} 
              alt={reel?.author?.username} 
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.4)' }}
            />
          </a>
          <span style={{ fontWeight: 700, fontSize: '14px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {reel?.author?.username}
          </span>
          <span style={{ color: 'var(--ig-primary-button)', fontWeight: 700 }}>•</span>
          <button
            onClick={() => reel?.author?.id && onToggleFollow && onToggleFollow(reel.author.id)}
            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ig-primary-button)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {reel?.author?.isFollowing ? '팔로잉' : '팔로우'}
          </button>
        </div>

        {reel?.taggedUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
            <User size={11} />
            <span>{reel.taggedUser}</span>
          </div>
        )}

        <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '6px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {reel?.caption}
        </p>

        {reel?.audio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
            <Music size={11} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
              {reel.audio.title}
            </span>
          </div>
        )}
      </div>

      {/* Mobile floating action bar (Only shown on screens < 1024px) */}
      <div 
        className="reel-mobile-actions"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Like */}
        <button 
          onClick={() => onToggleLike && reel?.id && onToggleLike(reel.id)} 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          aria-label="좋아요"
        >
          <Heart 
            size={26} 
            strokeWidth={1.8}
            fill={reel?.isLiked ? "#ff3040" : "none"} 
            color={reel?.isLiked ? "#ff3040" : "#ffffff"} 
            className={reel?.isLiked ? "like-bounce" : ""}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{formatCount(reel?.likesCount ?? reel?.likes_count)}</span>
        </button>

        {/* 2. Comment */}
        <button 
          onClick={() => onOpenComments && onOpenComments(reel)} 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          aria-label="댓글"
        >
          <MessageCircle size={26} strokeWidth={1.8} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{formatCount(reel?.commentsCount ?? reel?.comments_count)}</span>
        </button>

        {/* 3. Share */}
        <button 
          onClick={handleShare}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px' }}
          aria-label="공유"
        >
          <Send size={24} strokeWidth={1.8} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
        </button>

        {/* 4. Bookmark */}
        <button 
          onClick={handleBookmark}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px' }}
          aria-label="저장"
        >
          <Bookmark 
            size={24} 
            strokeWidth={1.8} 
            fill={isBookmarked ? "#ffffff" : "none"}
            color="#ffffff" 
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} 
          />
        </button>

        {/* 5. More */}
        <button 
          onClick={onOpenOptionsMenu} 
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px' }}
          aria-label="더 보기"
        >
          <MoreHorizontal size={22} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
        </button>

        {/* 6. Rotating Audio Cover Thumbnail */}
        {reel?.audio && (
          <div 
            style={{ 
              width: '26px', 
              height: '26px', 
              borderRadius: '6px', 
              border: '1.5px solid rgba(255,255,255,0.7)', 
              overflow: 'hidden', 
              marginTop: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            <img 
              src={reel.audio.coverUrl || reel.author?.profileImageUrl} 
              alt="Track" 
              className="animate-spin-slow"
              style={{ width: '100%', height: '100%', objectFit: 'cover', animationPlayState: isPlaying ? 'running' : 'paused' }}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default ReelMobileOverlay;
