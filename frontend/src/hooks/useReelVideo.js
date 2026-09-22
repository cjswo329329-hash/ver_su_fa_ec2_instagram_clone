import { useRef, useState, useEffect, useCallback } from 'react';
import { viewApi } from '../services';

const SUPABASE_STORAGE_REELS_URL = 'https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels';

export const getSafeVideoUrl = (rawUrl, id) => {
  if (rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('http') || rawUrl.startsWith('/videos/'))) {
    return rawUrl;
  }
  const idx = ((Math.abs(Number(id) || 1) - 1) % 49) + 1;
  return `${SUPABASE_STORAGE_REELS_URL}/reel${idx}.mp4`;
};

export const useReelVideo = ({ reel, isActive, isMuted, onToggleLike }) => {
  const videoRef = useRef(null);
  const clickTimerRef = useRef(null);
  const viewRecordedRef = useRef(false);
  const activeStartTimeRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayBadge, setShowPlayBadge] = useState(false);
  const [playBadgeIcon, setPlayBadgeIcon] = useState('pause'); // 'play' | 'pause'
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [progress, setProgress] = useState(0);

  const initialUrl = getSafeVideoUrl(reel?.videoUrl || reel?.video_url, reel?.id);
  const [videoSrc, setVideoSrc] = useState(initialUrl);

  // Sync video source whenever reel prop updates
  useEffect(() => {
    setVideoSrc(getSafeVideoUrl(reel?.videoUrl || reel?.video_url, reel?.id));
  }, [reel?.id, reel?.videoUrl, reel?.video_url]);

  // Video error recovery handler (Supabase Storage 49 real shorts fallback)
  const handleVideoError = useCallback(() => {
    const fallbackNum = ((Math.abs(Number(reel?.id) || 1) - 1) % 49) + 1;
    const safeFallback = `${SUPABASE_STORAGE_REELS_URL}/reel${fallbackNum}.mp4`;
    if (videoSrc !== safeFallback) {
      console.warn('Reel video failed to load, switching to Supabase Storage asset:', safeFallback);
      setVideoSrc(safeFallback);
    }
  }, [reel?.id, videoSrc]);

  // Play/pause based on active reel status (Lifecycle)
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

  // Reset viewRecorded status and start time when reel id or active status changes
  useEffect(() => {
    viewRecordedRef.current = false;
    activeStartTimeRef.current = isActive ? Date.now() : null;
  }, [reel?.id, isActive]);

  // Record view to backend after 3 seconds of active playback (Constitution & Recommendation Algorithm)
  useEffect(() => {
    if (!isActive || !reel?.id || viewRecordedRef.current) return;

    const timer = setTimeout(async () => {
      if (!viewRecordedRef.current && isActive && reel?.id) {
        viewRecordedRef.current = true;
        try {
          const video = videoRef.current;
          const ratio = (video && video.duration > 0) ? (video.currentTime / video.duration) : 0.2;
          const durationMs = activeStartTimeRef.current ? Math.max(3000, Date.now() - activeStartTimeRef.current) : 3000;
          await viewApi.recordView({
            reelId: reel.id,
            durationMs,
            watchRatio: Math.min(1.0, Math.round(ratio * 100) / 100),
            completed: ratio >= 0.9,
            source: 'reels'
          });
        } catch {
          // Silently handle background view recording error
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isActive, reel?.id]);

  const triggerPlayBadge = () => {
    setShowPlayBadge(true);
    setTimeout(() => {
      setShowPlayBadge(false);
    }, 500);
  };

  const handleSingleTap = useCallback(() => {
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
  }, []);

  const handleDoubleTap = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!reel?.isLiked && onToggleLike) {
      onToggleLike(reel?.id);
    }
    setShowHeartBurst(true);
    setTimeout(() => {
      setShowHeartBurst(false);
    }, 900);
  }, [reel?.isLiked, reel?.id, onToggleLike]);

  // Single-tap vs Double-tap gesture discriminator
  const handleContainerClick = useCallback((e) => {
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
  }, [handleDoubleTap, handleSingleTap]);

  // Track playback progress
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  }, []);

  return {
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
  };
};

export default useReelVideo;
