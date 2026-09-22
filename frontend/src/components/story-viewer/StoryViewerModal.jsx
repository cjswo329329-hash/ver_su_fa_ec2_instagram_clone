import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Heart, Send, Volume2, VolumeX } from 'lucide-react';
import { StoryProgressBar } from './StoryProgressBar';
import { Avatar } from '../common/Avatar';
import { useModal } from '../../contexts/ModalContext';

export const StoryViewerModal = () => {
  const navigate = useNavigate();
  const { activeStory, closeStoryViewer, markStoryViewed, stories, openStoryViewer } = useModal();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const duration = 5000; // 5 seconds per story
  const intervalTime = 50;

  const currentItem = activeStory?.stories?.[currentIndex];

  useEffect(() => {
    if (activeStory) {
      setCurrentIndex(activeStory.initialIndex || 0);
      setProgress(0);
      setHasLiked(false);
      setToastMessage('');
    }
  }, [activeStory]);

  // Mark story as viewed on backend & sync state when viewing current item
  useEffect(() => {
    if (activeStory && currentItem && currentItem.id) {
      if (!currentItem.isViewed && markStoryViewed) {
        markStoryViewed(activeStory.userId || activeStory.username, currentItem.id);
      }
    }
  }, [activeStory?.userId, activeStory?.username, currentItem?.id, currentItem?.isViewed, markStoryViewed]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      return;
    }

    // Move to previous user's story if available in tray
    if (stories && stories.length > 0 && activeStory) {
      const currentStoryUserIndex = stories.findIndex(
        s => (s.userId && activeStory.userId && String(s.userId) === String(activeStory.userId)) ||
             (s.username && activeStory.username && s.username === activeStory.username)
      );
      if (currentStoryUserIndex > 0) {
        const prevUserStory = stories[currentStoryUserIndex - 1];
        if (prevUserStory?.stories?.length > 0) {
          openStoryViewer(prevUserStory, prevUserStory.stories.length - 1);
          return;
        }
      }
    }
  }, [currentIndex, stories, activeStory, openStoryViewer]);

  const handleNext = useCallback(() => {
    if (activeStory && currentIndex < activeStory.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      return;
    }

    // Move to next user's story if available in tray
    if (stories && stories.length > 0 && activeStory) {
      const currentStoryUserIndex = stories.findIndex(
        s => (s.userId && activeStory.userId && String(s.userId) === String(activeStory.userId)) ||
             (s.username && activeStory.username && s.username === activeStory.username)
      );
      if (currentStoryUserIndex !== -1 && currentStoryUserIndex < stories.length - 1) {
        const nextUserStory = stories[currentStoryUserIndex + 1];
        if (nextUserStory?.stories?.length > 0) {
          openStoryViewer(nextUserStory, 0);
          return;
        }
      }
    }

    // No more stories in tray
    closeStoryViewer();
  }, [activeStory, currentIndex, stories, openStoryViewer, closeStoryViewer]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    if (!activeStory) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeStoryViewer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStory, handleNext, handlePrev, closeStoryViewer]);

  // Story playback timer
  useEffect(() => {
    if (!activeStory || isPaused) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + (intervalTime / duration) * 100;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStory, isPaused, handleNext]);

  if (!activeStory || !currentItem) return null;

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setToastMessage(`'${activeStory.username}'님에게 답장을 보냈습니다 💬`);
    setReplyText('');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleLike = () => {
    const nextState = !hasLiked;
    setHasLiked(nextState);
    if (nextState) {
      setToastMessage('스토리에 좋아요를 남겼습니다 ❤️');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#1a1a1a',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Instagram logo top-left */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '24px',
          zIndex: 100,
        }}
      >
        <span className="brand-logo" style={{ color: '#ffffff', fontSize: '2rem' }}>
          Instagram
        </span>
      </div>

      {/* Top action buttons (Mute & Close) */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 100,
        }}
      >
        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            color: '#ffffff',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={26} /> : <Volume2 size={26} />}
        </button>

        <button
          onClick={closeStoryViewer}
          style={{
            color: '#ffffff',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
          aria-label="Close stories"
        >
          <X size={32} />
        </button>
      </div>

      {/* Story Viewer Phone Shell */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '92vh',
          maxHeight: '820px',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#000000',
          boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Toast Feedback Pill */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              zIndex: 60,
              pointerEvents: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              whiteSpace: 'nowrap',
            }}
          >
            {toastMessage}
          </div>
        )}

        {/* Progress bar */}
        <StoryProgressBar
          count={activeStory.stories.length}
          currentIndex={currentIndex}
          progress={progress}
        />

        {/* Top User Header */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: 0,
            right: 0,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 30,
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (activeStory.username) {
                closeStoryViewer();
                navigate(`/${activeStory.username}`);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Avatar src={activeStory.profileImage} size="sm" />
            <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600 }}>
              {activeStory.username}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
              {currentItem?.timeAgo || '3시간 전'}
            </span>
          </div>
        </div>

        {/* Click Areas for Navigation */}
        <div
          onClick={handlePrev}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '35%',
            height: '80%',
            zIndex: 10,
            cursor: 'pointer',
          }}
          aria-label="Previous story"
        />
        <div
          onClick={handleNext}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '65%',
            height: '80%',
            zIndex: 10,
            cursor: 'pointer',
          }}
          aria-label="Next story"
        />

        {/* Story Media (Image or Video) */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
          }}
        >
          {currentItem?.mediaType === 'video' || currentItem?.media_type === 'video' ? (
            <video
              src={currentItem?.mediaUrl || currentItem?.media_url}
              autoPlay
              playsInline
              muted={isMuted}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                userSelect: 'none',
              }}
              onPlay={() => setIsPaused(false)}
              onPause={() => setIsPaused(true)}
            />
          ) : (
            <img
              src={currentItem?.mediaUrl || currentItem?.media_url}
              alt="Story content"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* Bottom Reply Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '14px 16px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          }}
        >
          <form
            onSubmit={handleSendReply}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '24px',
              padding: '8px 16px',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <input
              type="text"
              placeholder={`${activeStory.username}님에게 답장 보내기...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{
                flex: 1,
                color: '#ffffff',
                fontSize: '14px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
              }}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            />
            {replyText && (
              <button
                type="submit"
                style={{
                  color: '#0095f6',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                보내기
              </button>
            )}
          </form>

          <button
            onClick={toggleLike}
            style={{
              color: hasLiked ? '#ed4956' : '#ffffff',
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            aria-label="Like story"
          >
            <Heart size={26} fill={hasLiked ? '#ed4956' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  );
};
