import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { MediaCarousel } from './MediaCarousel';
import { PostActions } from './PostActions';
import { CommentSection } from './CommentSection';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { viewApi } from '../../services';

export const PostCard = ({ post }) => {
  const { user } = useAuth();
  const {
    toggleLikePost,
    toggleBookmarkPost,
    addCommentToPost,
    openPostDetail,
    openOptions
  } = useModal();
  const { requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  const cardRef = useRef(null);
  const commentInputRef = useRef(null);
  const viewRecordedRef = useRef(false);

  // 3초 이상 체류 시 시청 완료 기록 (로그인 유저의 Seen Filter 연동)
  useEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl || !post?.id || viewRecordedRef.current || !user) return;

    let timer = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !viewRecordedRef.current) {
          timer = setTimeout(async () => {
            if (!viewRecordedRef.current) {
              viewRecordedRef.current = true;
              try {
                await viewApi.recordView({
                  postId: post.id,
                  durationMs: 3000,
                  completed: true,
                  source: 'feed'
                });
              } catch (e) {
                // Silently handle
              }
            }
          }, 3000);
        } else {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(cardEl);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [post?.id]);

  const handleFocusComment = () => {
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  return (
    <article
      ref={cardRef}
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
      className="post-card-container"
    >
      {/* Post Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar
            src={post.author?.profileImageUrl || post.author?.profile_image_url}
            size="sm"
            alt={post.author?.username}
            onClick={() => {
              if (post.author?.username) navigate(`/${post.author.username}`);
            }}
            style={{ cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                onClick={() => {
                  if (post.author?.username) navigate(`/${post.author.username}`);
                }}
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {post.author?.username}
              </span>
              {post.author.isVerified && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#0095f6',
                    borderRadius: '50%',
                    color: '#fff',
                    fontSize: '8px',
                    textAlign: 'center',
                    lineHeight: '12px',
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            {post.location && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {post.location}
              </span>
            )}
          </div>
        </div>

        {/* Options Menu Button */}
        <button
          onClick={() => openOptions(post)}
          style={{ color: 'var(--text-primary)', padding: '4px' }}
          aria-label="More options"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Media Carousel */}
      <MediaCarousel
        media={post.media}
        onDoubleTap={() => requireAuth(() => toggleLikePost(post.id), { actionType: 'like' })}
        onImageClick={() => openPostDetail(post)}
      />

      {/* Post Actions (Like, Comment, Bookmark) */}
      <PostActions
        isLiked={post.isLiked ?? post.is_liked ?? false}
        isBookmarked={post.isBookmarked ?? post.is_bookmarked ?? false}
        likesCount={post.likesCount ?? post.likes_count ?? 0}
        commentsCount={post.commentsCount ?? post.comments_count ?? post.comments?.length ?? 0}
        showCounts={true}
        onLike={() => requireAuth(() => toggleLikePost(post.id), { actionType: 'like' })}
        onComment={() => openPostDetail(post, { focusComment: true })}
        onBookmark={() => requireAuth(() => toggleBookmarkPost(post.id), { actionType: 'bookmark' })}
      />

      {/* Comments & Caption */}
      <CommentSection
        post={post}
        onOpenDetail={() => openPostDetail(post)}
        onAddComment={addCommentToPost}
        inputRef={commentInputRef}
      />

      <style>{`
        @media (max-width: 768px) {
          .post-card-container {
            border: none !important;
            border-bottom: 1px solid var(--border-color) !important;
            border-radius: 0 !important;
            margin-bottom: 12px !important;
          }
        }
      `}</style>
    </article>
  );
};
