import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { Avatar } from '../common/Avatar';

export const StoryTray = () => {
  const { user } = useAuth();
  const { stories, openStoryViewer, openCreateStory } = useModal();
  const { requireAuth } = useAuthGuard();
  const scrollRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 스크롤 좌우 여유분 검사
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, stories]);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // 비로그인(게스트) 사용자에게는 스토리 트레이를 노출하지 않음 (실제 인스타그램 웹 표준)
  if (!user) {
    return null;
  }

  // 1. 내 스토리 데이터 확인 (본인이 올린 스토리가 있는지 조회)
  const myStoryItem = stories.find(
    s => (s.userId && user?.id && String(s.userId) === String(user.id)) ||
         (s.username && user?.username && s.username === user.username)
  );

  // 2. 다른 사람들의 스토리 목록 (현재 로그인한 유저 본인은 제외하여 중복 방지)
  const otherStories = stories.filter(
    s => !( (s.userId && user?.id && String(s.userId) === String(user.id)) ||
            (s.username && user?.username && s.username === user.username) )
  );

  const hasMyStories = Boolean(myStoryItem && myStoryItem.stories?.length > 0);

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '8px',
        padding: '16px 0',
        marginBottom: '20px',
        border: '1px solid var(--border-color)',
      }}
      className="story-tray-wrapper"
    >
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          style={{
            position: 'absolute',
            left: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            zIndex: 10,
            color: '#333333',
            border: 'none',
            cursor: 'pointer',
          }}
          className="story-nav-btn"
          aria-label="이전 스토리 보기"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* Horizontal Tray */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          overflowX: 'auto',
          padding: '0 16px',
        }}
        className="no-scrollbar"
      >
        {/* 1. 맨 앞: 내 스토리 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            flexShrink: 0,
            width: '66px',
          }}
          onClick={() => {
            if (hasMyStories) {
              openStoryViewer(myStoryItem);
            } else {
              openCreateStory();
            }
          }}
          title={hasMyStories ? '내 스토리 보기' : '스토리 만들기'}
        >
          <Avatar
            src={user?.profile_image_url}
            size="lg"
            isAddable={true}
            onAddClick={() => openCreateStory()}
            hasStory={hasMyStories}
            isStoryViewed={Boolean(myStoryItem && !myStoryItem.hasUnseen)}
            alt="내 스토리"
          />
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '64px',
              textAlign: 'center',
            }}
          >
            내 스토리
          </span>
        </div>

        {/* 2. 그 뒤: 팔로우 및 다른 유저들의 스토리 */}
        {otherStories.map((storyItem) => (
          <div
            key={storyItem.userId || storyItem.username}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              flexShrink: 0,
              width: '66px',
            }}
            onClick={() => {
              requireAuth(() => {
                openStoryViewer(storyItem);
              }, {
                actionType: 'story',
                title: '스토리 시청하기',
                description: 'Instagram에 로그인하여 크리에이터들의 24시간 스토리를 확인하세요.'
              });
            }}
            title={`${storyItem.username}님의 스토리 보기`}
          >
            <Avatar
              src={storyItem.profileImage}
              size="lg"
              hasStory={true}
              isStoryViewed={!storyItem.hasUnseen}
              alt={storyItem.username}
            />
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '64px',
                textAlign: 'center',
              }}
            >
              {storyItem.username}
            </span>
          </div>
        ))}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            zIndex: 10,
            color: '#333333',
            border: 'none',
            cursor: 'pointer',
          }}
          className="story-nav-btn"
          aria-label="다음 스토리 보기"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <style>{`
        @media (max-width: 768px) {
          .story-tray-wrapper {
            border: none !important;
            border-radius: 0 !important;
            margin-bottom: 0 !important;
            padding: 10px 0 12px 0 !important;
          }
          .story-nav-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
