import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Copy, Bookmark, Camera } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';

export const PostGrid = ({ posts, tab = 'posts', isMe = true }) => {
  const { openPostDetail, openCreatePost } = useModal();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePostClick = (post) => {
    if (!user) {
      navigate('/login');
      return;
    }
    openPostDetail(post);
  };

  // Render authentic Instagram empty states
  if (!posts || posts.length === 0) {
    if (tab === 'saved') {
      return (
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '360px', margin: '0 auto' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '2px solid var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Bookmark size={30} strokeWidth={1.5} color="var(--text-primary)" />
          </div>
          <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
            저장
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            다시 보고 싶은 사진과 동영상을 저장하세요. 저장한 콘텐츠는 회원님만 볼 수 있으며 다른 사람에게는 공개되지 않습니다.
          </p>
        </div>
      );
    }

    // Default posts tab empty state
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '360px', margin: '0 auto' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '2px solid var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Camera size={30} strokeWidth={1.5} color="var(--text-primary)" />
        </div>
        <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
          사진 공유
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
          사진을 공유하면 회원님의 프로필에 표시됩니다.
        </p>
        {isMe && (
          <button
            onClick={() => openCreatePost()}
            style={{
              color: 'var(--ig-primary-button)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            첫 사진 공유하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
        width: '100%',
      }}
      className="post-grid-container"
    >
      {posts.map((post) => {
        const coverUrl =
          post.media?.[0]?.media_url ||
          post.media?.[0]?.mediaUrl ||
          post.media_url ||
          post.mediaUrl ||
          post.poster_url ||
          post.posterUrl ||
          post.video_url ||
          post.videoUrl;
        const isMultiple = (post.media && post.media.length > 1) || post.isMultiple;
        const isVideo =
          post.isVideo ||
          post.media?.[0]?.media_type === 'video' ||
          post.media?.[0]?.mediaType === 'video' ||
          !!post.video_url ||
          !!post.videoUrl;
        const likes = post.likes_count ?? post.likesCount ?? post.likes?.length ?? 0;
        const comments = post.comments_count ?? post.commentsCount ?? post.comments?.length ?? 0;

        return (
          <div
            key={post.id}
            onClick={() => handlePostClick(post)}
            style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              backgroundColor: '#1a1a1a',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
            className="grid-item-card"
          >
            <img
              src={coverUrl}
              alt="Grid thumbnail"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transition: 'transform 0.2s ease',
              }}
              loading="lazy"
            />

            {/* Multiple media indicator */}
            {isMultiple && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  color: '#ffffff',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                  pointerEvents: 'none',
                }}
              >
                <Copy size={18} />
              </div>
            )}

            {/* Hover overlay with like and comment stats */}
            <div
              className="grid-hover-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                color: '#ffffff',
                opacity: 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '16px' }}>
                <Heart size={20} fill="#ffffff" />
                <span>{likes.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '16px' }}>
                <MessageCircle size={20} fill="#ffffff" />
                <span>{comments.toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        .grid-item-card:hover .grid-hover-overlay {
          opacity: 1 !important;
        }
        .grid-item-card:hover img {
          transform: scale(1.02);
        }
        @media (min-width: 768px) {
          .post-grid-container {
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};
