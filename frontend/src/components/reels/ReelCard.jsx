import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart,
  MessageCircle,
  MoreHorizontal, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Music,
  CheckCircle2,
  User,
  Repeat,
  Send,
  Bookmark
} from 'lucide-react';
import { HeartAnimation } from '../common/HeartAnimation';
import ReelsCommentsBox from './ReelsCommentsBox';

function ReelCard({
  reel,
  isActive,
  isNearby = true,
  isMuted,
  onToggleMute,
  onToggleFollow,
  onToggleLike,
  onOpenComments,
  isCommentsOpen = false,
  onCloseComments,
  onAddComment,
  onToggleBookmark,
}) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const clickTimerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayBadge, setShowPlayBadge] = useState(false);
  const [playBadgeIcon, setPlayBadgeIcon] = useState('pause'); // 'play' | 'pause'
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showHoverCard, setShowHoverCard] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(Boolean(reel.isSaved || reel.isBookmarked));
  const [isReposted, setIsReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(() => reel.repostsCount || reel.sharesCount || Math.floor(((reel.likesCount || 12) * 0.08) + 1));
  const hoverTimeoutRef = useRef(null);

  const getSafeVideoUrl = (rawUrl, id) => {
    const url = rawUrl || reel?.video_url || reel?.videoUrl;
    if (url && typeof url === 'string' && (url.startsWith('/videos/') || url.startsWith('http'))) {
      return url;
    }
    const idx = ((Math.abs(Number(id || reel?.id) || 1) - 1) % 160) + 1;
    return `/videos/reel${idx}.mp4`;
  };

  const [videoSrc, setVideoSrc] = useState(() => getSafeVideoUrl(reel?.videoUrl || reel?.video_url, reel?.id));

  // Sync video source whenever reel prop updates
  useEffect(() => {
    setVideoSrc(getSafeVideoUrl(reel?.videoUrl || reel?.video_url, reel?.id));
  }, [reel?.id, reel?.videoUrl, reel?.video_url]);

  // Video error recovery handler (160 unique reels fallback)
  const handleVideoError = () => {
    const fallbackNum = ((Math.abs(Number(reel?.id) || 1) - 1) % 160) + 1;
    const safeFallback = `/videos/reel${fallbackNum}.mp4`;
    if (videoSrc !== safeFallback) {
      console.warn('Reel video failed to load, switching to fallback asset:', safeFallback);
      setVideoSrc(safeFallback);
    }
  };

  const handleMouseEnterProfile = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowHoverCard(true);
    }, 250);
  };

  const handleMouseLeaveProfile = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowHoverCard(false);
    }, 200);
  };

  // Play/pause based on active reel status (Section 2.2 Lifecycle)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;

    if (isActive) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn('Autoplay failed, attempting muted retry:', err);
            // Browser autoplay policy retry with muted = true
            video.muted = true;
            video.play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch((e) => {
                console.warn('Autoplay waiting for user interaction:', e);
                setIsPlaying(false);
              });
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive, isMuted, videoSrc]);


  // Single-tap vs Double-tap gesture discriminator
  const handleContainerClick = (e) => {
    if (clickTimerRef.current) {
      // Second tap within 240ms -> Double-tap Heart Burst!
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleDoubleTap(e);
    } else {
      // First tap: wait 240ms before treating as single-tap play/pause
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        handleSingleTap();
      }, 240);
    }
  };

  const handleDoubleTap = (e) => {
    e.stopPropagation();
    if (!reel.isLiked && onToggleLike) {
      onToggleLike(reel.id);
    }
    setShowHeartBurst(true);
    setTimeout(() => {
      setShowHeartBurst(false);
    }, 900);
  };

  const handleSingleTap = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setPlayBadgeIcon('play');
        triggerPlayBadge();
      }).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      setPlayBadgeIcon('pause');
      triggerPlayBadge();
    }
  };

  const triggerPlayBadge = () => {
    setShowPlayBadge(true);
    setTimeout(() => {
      setShowPlayBadge(false);
    }, 500);
  };

  // Track playback progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const formatCount = (num) => {
    if (num === undefined || num === null) return '0';
    if (num >= 10000) {
      return (num / 10000).toFixed(1).replace(/\.0$/, '') + '만';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + '천';
    }
    return num.toLocaleString();
  };

  // Render caption with styled tags and mentions
  const renderCaptionText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') || part.startsWith('@')) {
        return (
          <span key={i} style={{ color: 'var(--ig-link)', cursor: 'pointer' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div 
      className={`reel-card-wrapper ${isCommentsOpen ? 'comments-open' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        userSelect: 'none',
        width: '100%',
        maxWidth: '100%',
        padding: '0 8px',
      }}
    >
      {/* 1. Desktop Left Meta Info (Visible on desktop >= 1024px) */}
      <div 
        className="reel-desktop-meta"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          width: '280px',
          paddingRight: '24px',
          paddingBottom: '12px',
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        {/* Creator Row with Profile Hover Card */}
        <div 
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
          onMouseEnter={handleMouseEnterProfile}
          onMouseLeave={handleMouseLeaveProfile}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (reel.author?.username) navigate(`/${reel.author.username}`);
            }}
            style={{ flexShrink: 0, cursor: 'pointer' }}
          >
            <img 
              src={reel.author.profileImageUrl} 
              alt={reel.author.username} 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                display: 'block',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                if (reel.author?.username) navigate(`/${reel.author.username}`);
              }}
              style={{
                fontWeight: 700,
                fontSize: '14px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {reel.author.username}
            </span>

            {reel.author.isVerified && (
              <CheckCircle2 size={14} color="var(--ig-primary-button)" fill="var(--ig-primary-button)" />
            )}

            <span style={{ color: 'var(--ig-primary-button)', fontSize: '13px', fontWeight: 600 }}>•</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow(reel.author.id);
              }}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: reel.author.isFollowing ? 'var(--text-secondary)' : 'var(--ig-primary-button)',
                cursor: 'pointer',
              }}
            >
              {reel.author.isFollowing ? '팔로잉' : '팔로우'}
            </button>
          </div>

          {/* Profile Popover Hover Card */}
          {showHoverCard && (
            <div 
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '12px',
                width: '300px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: '12px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-color)',
                padding: '16px',
                zIndex: 50,
                color: 'var(--text-primary)',
                pointerEvents: 'auto',
              }}
              onMouseEnter={handleMouseEnterProfile}
              onMouseLeave={handleMouseLeaveProfile}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                onClick={() => {
                  if (reel.author?.username) navigate(`/${reel.author.username}`);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', cursor: 'pointer' }}
              >
                <img 
                  src={reel.author.profileImageUrl} 
                  alt={reel.author.username} 
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {reel.author.username}
                    </span>
                    {reel.author.isVerified && (
                      <CheckCircle2 size={14} color="var(--ig-primary-button)" fill="var(--ig-primary-button)" />
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {reel.author.fullName || reel.author.username}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>24</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>게시물</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>4.8만</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>팔로워</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>180</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>팔로잉</div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow(reel.author.id);
                }}
                style={{
                  width: '100%',
                  padding: '7px 0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: reel.author.isFollowing ? 'var(--badge-bg)' : 'var(--ig-primary-button)',
                  color: reel.author.isFollowing ? 'var(--text-primary)' : '#ffffff',
                  border: 'none',
                }}
              >
                {reel.author.isFollowing ? '팔로잉' : '팔로우'}
              </button>
            </div>
          )}
        </div>

        {/* Tagged user Row */}
        {reel.taggedUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <User size={13} />
            <span style={{ fontWeight: 500, cursor: 'pointer' }}>
              {reel.taggedUser}
            </span>
          </div>
        )}

        {/* Audio Row */}
        {reel.audio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <Music size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
              {reel.audio.title}
            </span>
          </div>
        )}

        {/* Caption */}
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.45, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
          <p style={{ display: '-webkit-box', WebkitLineClamp: isCaptionExpanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: isCaptionExpanded ? 'visible' : 'hidden' }}>
            {renderCaptionText(reel.caption)}
          </p>
          {reel.caption && reel.caption.length > 50 && (
            <button
              onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
              style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px', cursor: 'pointer' }}
            >
              {isCaptionExpanded ? '접기' : '...더 보기'}
            </button>
          )}
        </div>
      </div>

      {/* 2. Video Player Container (Center 9:16 Viewport - Fluid Scaling) */}
      <div 
        className="reel-video-container"
        style={{
          position: 'relative',
          height: 'calc(100vh - 36px)',
          maxHeight: '750px',
          aspectRatio: '9 / 16',
          width: 'auto',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#000000',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={handleContainerClick}
      >
        {/* DOM Virtualization */}
        {isNearby ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay={isActive}
            playsInline
            webkit-playsinline="true"
            loop
            muted={isMuted}
            preload={isActive ? "auto" : "metadata"}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
            onCanPlay={() => {
              if (isActive && videoRef.current && videoRef.current.paused) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }}
            className="reel-video-element"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <img
            src={reel.posterUrl}
            alt="Reel preview"
            className="reel-video-element"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Play Icon overlay if video is paused */}
        {isActive && !isPlaying && !showPlayBadge && (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              zIndex: 18,
              pointerEvents: 'none',
            }}
          >
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
            >
              <Play size={30} fill="#ffffff" style={{ transform: 'translateX(2px)' }} />
            </div>
          </div>
        )}


        {/* Double-tap Heart Burst Animation */}
        <HeartAnimation show={showHeartBurst} />

        {/* Play / Pause transient flash badge */}
        {showPlayBadge && (
          <div className="reel-play-badge">
            <div className="reel-play-badge-icon">
              {playBadgeIcon === 'play' ? (
                <Play size={30} fill="#ffffff" style={{ transform: 'translateX(2px)' }} />
              ) : (
                <Pause size={30} fill="#ffffff" />
              )}
            </div>
          </div>
        )}

        {/* Mute / Unmute Button (Bottom-right inside the video) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={isMuted ? "음소거 해제" : "음소거"}
          className="reel-mute-btn"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* 2px Video progress line at bottom */}
        <div className="reel-progress-track">
          <div 
            className="reel-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mobile Info Overlay (Shown on screens < 1024px) */}
        <div className="reel-mobile-overlay">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <a href={`/${reel.author.username}`} style={{ flexShrink: 0 }}>
              <img 
                src={reel.author.profileImageUrl} 
                alt={reel.author.username} 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.4)' }}
              />
            </a>
            <span style={{ fontWeight: 700, fontSize: '14px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {reel.author.username}
            </span>
            <span style={{ color: 'var(--ig-primary-button)', fontWeight: 700 }}>•</span>
            <button
              onClick={() => onToggleFollow(reel.author.id)}
              style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ig-primary-button)' }}
            >
              {reel.author.isFollowing ? '팔로잉' : '팔로우'}
            </button>
          </div>

          {reel.taggedUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>
              <User size={11} />
              <span>{reel.taggedUser}</span>
            </div>
          )}

          <p style={{ fontSize: '13px', color: '#ffffff', marginBottom: '6px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {reel.caption}
          </p>

          {reel.audio && (
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
          {/* Like */}
          <button 
            onClick={() => onToggleLike && onToggleLike(reel.id)} 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <Heart 
              size={26} 
              strokeWidth={1.8}
              fill={reel.isLiked ? "#ff3040" : "none"} 
              color={reel.isLiked ? "#ff3040" : "#ffffff"} 
              className={reel.isLiked ? "like-bounce" : ""}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{formatCount(reel.likesCount)}</span>
          </button>

          {/* Comment */}
          <button 
            onClick={() => onOpenComments && onOpenComments(reel)} 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <MessageCircle size={26} strokeWidth={1.8} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{formatCount(reel.commentsCount)}</span>
          </button>

          {/* More */}
          <button 
            onClick={() => setShowOptionsMenu(true)} 
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px' }}
          >
            <MoreHorizontal size={22} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
          </button>
        </div>
      </div>

      {/* 3. Desktop Action Area: Matching official Instagram Reels layout */}
      <div 
        className="reel-desktop-actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginLeft: '16px',
          paddingBottom: '12px',
          gap: '14px',
          flexShrink: 0,
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Like Button */}
        <button 
          onClick={() => onToggleLike && onToggleLike(reel.id)}
          className="reel-action-btn"
          aria-label="좋아요"
        >
          <div style={{ padding: '2px' }}>
            <Heart 
              size={24} 
              strokeWidth={1.8}
              fill={reel.isLiked ? "#ff3040" : "none"} 
              color={reel.isLiked ? "#ff3040" : "var(--text-primary)"} 
              className={reel.isLiked ? "like-bounce" : ""} 
            />
          </div>
          <span className="reel-action-count">{formatCount(reel.likesCount)}</span>
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
          <span className="reel-action-count">{formatCount(reel.commentsCount)}</span>
        </button>

        {/* 3. Repost Button */}
        <button 
          onClick={() => {
            setIsReposted(prev => {
              const next = !prev;
              setRepostsCount(c => next ? c + 1 : Math.max(0, c - 1));
              return next;
            });
          }}
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
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`);
            }
            alert('릴스 링크가 클립보드에 복사되었습니다.');
          }}
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
          onClick={() => {
            setIsBookmarked(prev => {
              const next = !prev;
              if (onToggleBookmark) onToggleBookmark(reel.id, next);
              return next;
            });
          }}
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
          onClick={() => setShowOptionsMenu(true)}
          className="reel-more-btn"
          aria-label="더 보기"
          style={{ padding: '4px' }}
        >
          <MoreHorizontal size={22} strokeWidth={2} />
        </button>

        {/* 7. Audio Cover Thumbnail */}
        {reel.audio && (
          <div style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1.5px solid var(--border-color)', overflow: 'hidden', marginTop: '2px' }}>
            <img 
              src={reel.audio.coverUrl || reel.author.profileImageUrl} 
              alt="Track" 
              className="animate-spin-slow"
              style={{ width: '100%', height: '100%', objectFit: 'cover', animationPlayState: isPlaying ? 'running' : 'paused' }}
            />
          </div>
        )}
      </div>

      {/* 4. Desktop Floating Comments Box (Docked to the right of the action bar matching screenshot) */}
      {isCommentsOpen && (
        <div 
          className="reel-desktop-comments-wrapper"
          onClick={(e) => e.stopPropagation()}
        >
          <ReelsCommentsBox
            isOpen={isCommentsOpen}
            onClose={onCloseComments}
            reel={reel}
            onAddComment={onAddComment}
            isMobile={false}
          />
        </div>
      )}

      {/* 5. Mobile Comments Bottom Sheet (Shown on screens < 1024px) */}
      {isCommentsOpen && (
        <div 
          className="reel-mobile-comments-portal"
          onClick={(e) => e.stopPropagation()}
        >
          <ReelsCommentsBox
            isOpen={isCommentsOpen}
            onClose={onCloseComments}
            reel={reel}
            onAddComment={onAddComment}
            isMobile={true}
          />
        </div>
      )}

      {/* Options Dialog Menu */}
      {showOptionsMenu && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={() => setShowOptionsMenu(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              fontSize: '14px',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => {
                alert('신고가 접수되었습니다.');
                setShowOptionsMenu(false);
              }}
              style={{
                padding: '14px 0',
                fontWeight: 700,
                color: 'var(--ig-danger)',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              신고
            </button>
            <button 
              onClick={() => {
                onToggleFollow(reel.author.id);
                setShowOptionsMenu(false);
              }}
              style={{
                padding: '14px 0',
                fontWeight: 600,
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              {reel.author.isFollowing ? '팔로우 취소' : '팔로우'}
            </button>
            <button 
              onClick={() => {
                alert('이 게시물과 비슷한 콘텐츠가 덜 추천됩니다.');
                setShowOptionsMenu(false);
              }}
              style={{
                padding: '14px 0',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              관심 없음
            </button>
            <button 
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`);
                }
                alert('릴스 링크가 클립보드에 복사되었습니다.');
                setShowOptionsMenu(false);
              }}
              style={{
                padding: '14px 0',
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              링크 복사
            </button>
            <button 
              onClick={() => setShowOptionsMenu(false)}
              style={{
                padding: '14px 0',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(ReelCard);
