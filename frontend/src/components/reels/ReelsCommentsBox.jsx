import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Smile, MoreHorizontal, User, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { reelApi } from '../../services/reelApi';
import { formatCount } from './ReelActionSidebar';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '방금';
  if (typeof dateStr === 'string' && (dateStr.includes('분') || dateStr.includes('시간') || dateStr.includes('일') || dateStr.includes('방금'))) {
    return dateStr;
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '방금';
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    if (diffSec < 60) return '방금';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}일`;
    const diffWeek = Math.floor(diffDay / 7);
    return `${diffWeek}주`;
  } catch {
    return '방금';
  }
};

const normalizeComment = (c) => {
  if (!c) return null;
  const username = c.author?.username || c.username || 'user';
  const profileImageUrl = c.author?.profile_image_url || c.profile_image_url || c.profileImageUrl || null;
  const text = c.content || c.text || '';
  const timeAgo = formatTimeAgo(c.created_at || c.time_ago || c.timeAgo);
  const likes = c.likes_count ?? c.likes ?? 0;
  const isLiked = Boolean(c.is_liked ?? c.isLiked);
  const replies = Array.isArray(c.replies)
    ? c.replies.map(normalizeComment).filter(Boolean)
    : [];

  return {
    id: c.id,
    username,
    profileImageUrl,
    text,
    timeAgo,
    likes,
    isLiked,
    replies,
    repliesCount: c.replies_count ?? replies.length,
  };
};

// 전역 인메모리 댓글 캐시 (동일 세션 내에서 모달 재오픈 시 네트워크 지연 없이 0ms 즉시 노출)
const _commentsCache = new Map();

export default function ReelsCommentsBox({
  isOpen,
  onClose,
  reel,
  onAddComment,
  isMobile = false,
}) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  
  // 1. 캐시 또는 전달받은 reel.comments로부터 지연 시간 없이(0ms) 즉시 초기 렌더링
  const [comments, setComments] = useState(() => {
    if (!reel?.id) return [];
    if (_commentsCache.has(reel.id)) {
      return _commentsCache.get(reel.id);
    }
    if (Array.isArray(reel.comments) && reel.comments.length > 0) {
      return reel.comments.map(normalizeComment).filter(Boolean);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const boxRef = useRef(null);

  // Prevent background reel navigation when scrolling inside comments modal
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const stopWheel = (e) => {
      e.stopPropagation();
    };
    el.addEventListener('wheel', stopWheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', stopWheel);
    };
  }, [isOpen]);

  // Sync / Fetch comments whenever reel changes or modal opens (SWR 전략)
  useEffect(() => {
    if (!isOpen || !reel?.id) return;

    // 캐시 확인
    const cached = _commentsCache.get(reel.id);
    if (cached && cached.length > 0) {
      setComments(cached);
      setIsLoading(false);
    } else if (Array.isArray(reel.comments) && reel.comments.length > 0) {
      const initial = reel.comments.map(normalizeComment).filter(Boolean);
      setComments(initial);
      _commentsCache.set(reel.id, initial);
      setIsLoading(false);
    } else {
      // 캐시도 없고 초기 데이터도 없을 때만 로딩 표시
      setIsLoading(true);
    }

    let isMounted = true;

    // 백그라운드 최신화 (N+1 쿼리가 제거된 초고속 API 호출)
    const loadComments = async () => {
      try {
        const res = await reelApi.getReelComments(reel.id);
        if (isMounted) {
          if (Array.isArray(res)) {
            const formatted = res.map(normalizeComment).filter(Boolean);
            setComments(formatted);
            _commentsCache.set(reel.id, formatted);
          }
        }
      } catch (err) {
        console.warn('Could not fetch comments from backend:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [isOpen, reel?.id]);

  if (!isOpen || !reel) return null;

  // Toggle comment like
  const handleToggleLike = (commentId) => {
    setCommentLikes((prev) => {
      const current = Boolean(prev[commentId]);
      return { ...prev, [commentId]: !current };
    });
  };

  // Reply to user
  const handleStartReply = (comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.username} `);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Toggle replies expanded
  const handleToggleExpandReplies = (commentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // Submit comment
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    const newComment = {
      id: Date.now(),
      username: user?.username || 'me',
      profileImageUrl: user?.profile_image_url || null,
      text,
      timeAgo: '방금',
      likes: 0,
      isLiked: false,
      replies: [],
      repliesCount: 0,
    };

    // Optimistic local update
    if (replyingTo) {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === replyingTo.id) {
            return {
              ...c,
              replies: [...(c.replies || []), newComment],
              repliesCount: (c.repliesCount || 0) + 1,
            };
          }
          return c;
        })
      );
      setExpandedReplies((prev) => ({ ...prev, [replyingTo.id]: true }));
    } else {
      setComments((prev) => [newComment, ...prev]);
    }

    // 전역 메모리 캐시 동기화
    if (reel?.id) {
      const currentCached = _commentsCache.get(reel.id) || [];
      const updatedCache = replyingTo
        ? currentCached.map((c) =>
            c.id === replyingTo.id
              ? {
                  ...c,
                  replies: [...(c.replies || []), newComment],
                  repliesCount: (c.repliesCount || 0) + 1,
                }
              : c
          )
        : [newComment, ...currentCached];
      _commentsCache.set(reel.id, updatedCache);
    }

    setCommentText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    if (onAddComment) {
      onAddComment(reel.id, newComment);
    }

    // Scroll to top of comment list if top-level comment
    if (!replyingTo && listRef.current) {
      listRef.current.scrollTop = 0;
    }

    // Call API in background
    try {
      await reelApi.addReelComment(reel.id, text, replyingTo ? replyingTo.id : null);
    } catch (err) {
      console.warn('Could not post comment to backend:', err);
    }
  };

  // Insert emoji
  const handleInsertEmoji = (emoji) => {
    setCommentText((prev) => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const quickEmojis = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

  const renderSingleComment = (comment, isReply = false) => {
    const isLiked = Boolean(commentLikes[comment.id] ?? comment.isLiked);
    const displayLikes = (comment.likes || 0) + (commentLikes[comment.id] ? 1 : 0);

    return (
      <div
        key={comment.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          width: '100%',
          marginTop: isReply ? '10px' : '0',
          marginLeft: isReply ? '44px' : '0',
        }}
      >
        {/* Author Avatar */}
        <div style={{ flexShrink: 0 }}>
          {comment.profileImageUrl ? (
            <img
              src={comment.profileImageUrl}
              alt={comment.username}
              style={{
                width: isReply ? '24px' : '32px',
                height: isReply ? '24px' : '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border-color, #efefef)',
              }}
            />
          ) : (
            <div
              style={{
                width: isReply ? '24px' : '32px',
                height: isReply ? '24px' : '32px',
                borderRadius: '50%',
                backgroundColor: '#dbdbdb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <User size={isReply ? 14 : 18} fill="#ffffff" color="#dbdbdb" />
            </div>
          )}
        </div>

        {/* Comment Text & Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--text-primary, #000000)',
                cursor: 'pointer',
                marginRight: '6px',
              }}
            >
              {comment.username}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary, #8e8e8e)',
                fontWeight: 400,
              }}
            >
              {comment.timeAgo}
            </span>
            <div
              style={{
                fontSize: '13.5px',
                color: 'var(--text-primary, #000000)',
                marginTop: '2px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {comment.text}
            </div>
          </div>

          {/* Comment Sub-actions: Likes count, Reply, More */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '4px',
              fontSize: '12px',
              color: 'var(--text-secondary, #8e8e8e)',
            }}
          >
            {displayLikes > 0 && (
              <span style={{ fontWeight: 600, cursor: 'pointer' }}>
                좋아요 {displayLikes}개
              </span>
            )}
            <button
              type="button"
              onClick={() => handleStartReply(comment)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontWeight: 600,
                fontSize: '12px',
                color: 'var(--text-secondary, #8e8e8e)',
                cursor: 'pointer',
              }}
            >
              답글 달기
            </button>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary, #8e8e8e)',
                cursor: 'pointer',
              }}
            >
              번역 보기
            </span>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-secondary, #8e8e8e)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="더 보기"
            >
              <MoreHorizontal size={13} />
            </button>
          </div>

          {/* Sub-replies toggle if any */}
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => handleToggleExpandReplies(comment.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #8e8e8e)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color, #dbdbdb)' }} />
                <span>
                  {expandedReplies[comment.id]
                    ? '답글 숨기기'
                    : `답글 ${comment.replies.length}개 보기`}
                </span>
              </button>

              {expandedReplies[comment.id] && (
                <div style={{ marginTop: '6px' }}>
                  {comment.replies.map((reply) => renderSingleComment(reply, true))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Like Heart Button on Right */}
        <button
          type="button"
          onClick={() => handleToggleLike(comment.id)}
          aria-label="댓글 좋아요"
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: isLiked ? '#ff3040' : 'var(--text-secondary, #8e8e8e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(1.2)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Heart
            size={14}
            strokeWidth={1.8}
            fill={isLiked ? '#ff3040' : 'none'}
            color={isLiked ? '#ff3040' : 'currentColor'}
          />
        </button>
      </div>
    );
  };

  const totalCommentsCount = comments.reduce(
    (acc, c) => acc + 1 + (c.repliesCount || c.replies?.length || 0),
    0
  );

  const boxContent = (
    <div
      ref={boxRef}
      className="reels-comments-box-card"
      style={{
        width: isMobile ? '100%' : '360px',
        height: isMobile ? '72vh' : '530px',
        maxHeight: isMobile ? '80vh' : 'calc(100vh - 100px)',
        backgroundColor: 'var(--bg-elevated, #ffffff)',
        color: 'var(--text-primary, #000000)',
        borderRadius: isMobile ? '16px 16px 0 0' : '16px',
        boxShadow: isMobile
          ? '0 -4px 24px rgba(0, 0, 0, 0.3)'
          : '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid var(--border-color, #dbdbdb)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'text',
      }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* 1. Header: Close button on left, Title "댓글" centered */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '48px',
          padding: '0 16px',
          borderBottom: '1px solid var(--border-color, #efefef)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary, #000000)',
            borderRadius: '50%',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={19} strokeWidth={2.2} />
        </button>

        <h3
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary, #000000)',
            letterSpacing: '-0.2px',
          }}
        >
          댓글{totalCommentsCount > 0 ? ` ${formatCount(totalCommentsCount)}` : ''}
        </h3>
      </div>

      {/* 2. Comments Scrollable List */}
      <div
        ref={listRef}
        className="custom-comments-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overscrollBehavior: 'contain',
        }}
      >
        {/* 2. Comments List / Loading / Empty state */}
        {isLoading && comments.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '30px 0',
              color: 'var(--text-secondary, #8e8e8e)',
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '13px' }}>댓글 불러오는 중...</span>
          </div>
        ) : comments.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary, #8e8e8e)',
              padding: '30px 0',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>아직 댓글이 없습니다.</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>첫 번째 댓글을 남겨보세요.</p>
          </div>
        ) : (
          comments.map((comment) => renderSingleComment(comment))
        )}
      </div>

      {/* 3. Replying indicator banner */}
      {replyingTo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px',
            backgroundColor: 'var(--bg-secondary, #f8f9fa)',
            borderTop: '1px solid var(--border-color, #efefef)',
            fontSize: '12px',
            color: 'var(--text-secondary, #8e8e8e)',
          }}
        >
          <span>
            <strong>@{replyingTo.username}</strong> 님에게 답글 남기는 중
          </span>
          <button
            type="button"
            onClick={() => {
              setReplyingTo(null);
              setCommentText('');
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: 'pointer',
              color: 'var(--text-secondary, #8e8e8e)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. Quick Emoji Picker Bar (shown when smile icon is clicked) */}
      {showEmojiPicker && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-secondary, #f8f9fa)',
            borderTop: '1px solid var(--border-color, #efefef)',
          }}
        >
          {quickEmojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onClick={() => handleInsertEmoji(emoji)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '2px',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* 5. Sticky Bottom Input Form (Exact Pill Shape from Screenshot) */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color, #efefef)',
          backgroundColor: 'var(--bg-elevated, #ffffff)',
          flexShrink: 0,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
          }}
        >
          {/* Current User Avatar */}
          <div style={{ flexShrink: 0 }}>
            {user?.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={user.username || 'My avatar'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--border-color, #efefef)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#dbdbdb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <User size={18} fill="#ffffff" color="#dbdbdb" />
              </div>
            )}
          </div>

          {/* Capsule / Pill Input Container */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary, #f1f2f4)',
              borderRadius: '22px',
              padding: '7px 14px',
              gap: '8px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="댓글 달기..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                color: 'var(--text-primary, #000000)',
                padding: 0,
              }}
            />

            {/* Smile Emoji Icon Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              aria-label="이모티콘 선택"
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: showEmojiPicker
                  ? 'var(--ig-primary-button, #0095f6)'
                  : 'var(--text-secondary, #8e8e8e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Smile size={18} />
            </button>
          </div>

          {/* "게시" Submit Button (Visible when text entered) */}
          {commentText.trim().length > 0 && (
            <button
              type="submit"
              style={{
                background: 'none',
                border: 'none',
                padding: '0 4px',
                fontWeight: 700,
                fontSize: '13.5px',
                color: 'var(--ig-primary-button, #0095f6)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              게시
            </button>
          )}
        </form>
      </div>
    </div>
  );

  // If mobile view, render bottom sheet with dark overlay
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      >
        {boxContent}
      </div>
    );
  }

  // Desktop floating card
  return boxContent;
}
