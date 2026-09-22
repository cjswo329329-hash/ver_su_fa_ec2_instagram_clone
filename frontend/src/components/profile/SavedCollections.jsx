import React, { useState } from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { PostGrid } from './PostGrid';

export const SavedCollections = ({ savedPosts = [], isMe = true }) => {
  const [selectedCollection, setSelectedCollection] = useState(null);

  // 저장된 콘텐츠가 없는 경우 빈 상태 표시
  if (!savedPosts || savedPosts.length === 0) {
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

  // 컬렉션 상세 보기 화면 (카드 클릭 시 3열 그리드로 전환)
  if (selectedCollection) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => setSelectedCollection(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: '15px',
              fontWeight: 600,
              padding: '6px 8px',
              borderRadius: '6px',
            }}
          >
            <ArrowLeft size={20} />
            <span>저장됨</span>
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>/</span>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
            {selectedCollection.title}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {selectedCollection.posts.length}개
          </span>
        </div>

        <PostGrid posts={selectedCollection.posts} tab="posts" isMe={isMe} />
      </div>
    );
  }

  // 썸네일 URL 추출 헬퍼
  const getThumbnail = (post) => {
    return (
      post.media?.[0]?.media_url ||
      post.media?.[0]?.mediaUrl ||
      post.media_url ||
      post.mediaUrl ||
      post.poster_url ||
      post.posterUrl ||
      post.video_url ||
      post.videoUrl ||
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500'
    );
  };

  // 컬렉션 구성: "모든 게시물" (전체) 및 "오디오/동영상" (릴스 또는 비디오)
  const allThumbnails = savedPosts.slice(0, 4).map(getThumbnail);
  const videoPosts = savedPosts.filter(
    (p) => p.isVideo || p.category === 'reel' || p.media?.[0]?.media_type === 'video'
  );
  const videoThumbnails = videoPosts.slice(0, 4).map(getThumbnail);

  const collections = [
    {
      id: 'all',
      title: '모든 게시물',
      thumbnails: allThumbnails,
      posts: savedPosts,
      count: savedPosts.length,
    },
    ...(videoPosts.length > 0
      ? [
          {
            id: 'audio',
            title: '오디오',
            thumbnails: videoThumbnails.length >= 4 ? videoThumbnails : allThumbnails,
            posts: videoPosts,
            count: videoPosts.length,
          },
        ]
      : []),
  ];

  return (
    <div style={{ width: '100%' }} className="saved-collections-root">
      {/* 1. 상단 안내 문구 및 뷰 전환 버튼 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            letterSpacing: '-0.2px',
          }}
        >
          저장한 내용은 회원님만 볼 수 있습니다
        </div>
        <button
          onClick={() => setSelectedCollection(collections[0])}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ig-primary-button, #0095f6)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          모든 게시물 직접 보기 ({savedPosts.length})
        </button>
      </div>

      {/* 2. 컬렉션 카드 그리드 (2열 쿼드 콜라주 카드) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 320px))',
          gap: '24px',
        }}
        className="collections-grid"
      >
        {collections.map((col) => {
          // 4개의 썸네일 슬롯 채우기
          const slots = [0, 1, 2, 3].map((idx) => col.thumbnails[idx] || col.thumbnails[0] || null);

          return (
            <div
              key={col.id}
              onClick={() => setSelectedCollection(col)}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: '#1a1a1a',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              className="collection-card"
            >
              {/* 2x2 쿼드 썸네일 콜라주 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  width: '100%',
                  height: '100%',
                  gap: '2px',
                  backgroundColor: '#000000',
                }}
              >
                {slots.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      width: '100%',
                      height: '100%',
                      overflow: 'hidden',
                      backgroundColor: '#262626',
                    }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`${col.title} ${i + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#262626',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* 하단 그라디언트 및 타이틀 오버레이 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '40px 16px 16px 16px',
                  background:
                    'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '-0.3px',
                    textShadow: '0 2px 6px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {col.title}
                </span>
                <span
                  style={{
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textShadow: '0 1px 4px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {col.count}개
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .collection-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18) !important;
        }
        @media (max-width: 640px) {
          .collections-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SavedCollections;
