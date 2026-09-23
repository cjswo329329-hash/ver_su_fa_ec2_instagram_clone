import React, { useState } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { HeartAnimation } from '../common/HeartAnimation';
import ReelsCommentsBox from './ReelsCommentsBox';
import { useReelVideo } from '../../hooks/useReelVideo';
import { ReelDesktopMeta } from './ReelDesktopMeta';
import { ReelActionSidebar } from './ReelActionSidebar';
import { ReelMobileOverlay } from './ReelMobileOverlay';
import { ReelOptionsMenu } from './ReelOptionsMenu';
import ReelsShareModal from './ReelsShareModal';

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
  onSyncCommentCount,
  onToggleBookmark,
}) {
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    videoRef,
    videoSrc,
    isPlaying,
    setIsPlaying,
    progress,
    showPlayBadge,
    playBadgeIcon,
    showHeartBurst,
    handleContainerClick,
    handleTimeUpdate,
    handleVideoError,
  } = useReelVideo({ reel, isActive, isMuted, onToggleLike });

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
      {/* 1. Desktop Left Meta Info (비디오 좌측 하단에 정렬 - 스크린샷 100% 일치) */}
      <ReelDesktopMeta 
        reel={reel} 
        onToggleFollow={onToggleFollow} 
      />

      {/* 2. Video Player Container (Center 9:16 Viewport) */}
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
            poster={reel?.posterUrl || reel?.poster_url}
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
            src={reel?.posterUrl || reel?.poster_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
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

        {/* Mobile Info Overlay & Actions (Shown on screens < 1024px) */}
        <ReelMobileOverlay
          reel={reel}
          isPlaying={isPlaying}
          onToggleFollow={onToggleFollow}
          onToggleLike={onToggleLike}
          onOpenComments={onOpenComments}
          onToggleBookmark={onToggleBookmark}
          onOpenShare={() => setShowShareModal(true)}
          onOpenOptionsMenu={() => setShowOptionsMenu(true)}
        />
      </div>

      {/* 3. Action Sidebar & Desktop Comments Box Anchor */}
      <div 
        className="reel-actions-wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginLeft: '16px',
          paddingBottom: '12px',
          flexShrink: 0,
        }}
      >
        <ReelActionSidebar
          reel={reel}
          isPlaying={isPlaying}
          onToggleLike={onToggleLike}
          onOpenComments={onOpenComments}
          onToggleBookmark={onToggleBookmark}
          onOpenShare={() => setShowShareModal(true)}
          onOpenOptionsMenu={() => setShowOptionsMenu(true)}
        />

        {/* 4. Desktop Floating Comments Box (액션바 우측에 바닥선 맞춰서 바로 옆에 렌더링!) */}
        {isCommentsOpen && !isMobileViewport && (
          <div 
            className="reel-desktop-comments-wrapper"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <ReelsCommentsBox
              isOpen={isCommentsOpen}
              onClose={onCloseComments}
              reel={reel}
              onAddComment={onAddComment}
              onSyncCommentCount={onSyncCommentCount}
              isMobile={false}
            />
          </div>
        )}
      </div>

      {/* 5. Mobile Comments Bottom Sheet */}
      {isCommentsOpen && isMobileViewport && (
        <div 
          className="reel-mobile-comments-portal"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <ReelsCommentsBox
            isOpen={isCommentsOpen}
            onClose={onCloseComments}
            reel={reel}
            onAddComment={onAddComment}
            onSyncCommentCount={onSyncCommentCount}
            isMobile={true}
          />
        </div>
      )}

      {/* Options Dialog Menu */}
      <ReelOptionsMenu
        isOpen={showOptionsMenu}
        onClose={() => setShowOptionsMenu(false)}
        reel={reel}
        onToggleFollow={onToggleFollow}
      />

      {/* Share Dialog Sheet */}
      <ReelsShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        reel={reel}
      />
    </div>
  );
}

export default React.memo(ReelCard);
