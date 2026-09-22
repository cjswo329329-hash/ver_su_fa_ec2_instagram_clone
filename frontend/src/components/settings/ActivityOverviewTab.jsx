import React from 'react';
import { useModal } from '../../contexts/ModalContext';

export const ActivityOverviewTab = ({ onSelectTab }) => {
  const { posts } = useModal();

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>
        내 활동
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div
          onClick={() => onSelectTab('saved')}
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔖</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>저장된 게시물</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            회원님이 컬렉션에 보관한 {posts?.filter(p => p.isBookmarked)?.length || 0}개의 콘텐츠
          </div>
        </div>

        <div
          onClick={() => onSelectTab('liked-posts')}
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>❤️</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>좋아요한 콘텐츠</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            회원님이 공감한 {posts?.filter(p => p.isLiked)?.length || 0}개의 게시물
          </div>
        </div>

        <div
          onClick={() => onSelectTab('search-history')}
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>최근 검색 내역</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            과거 검색 기록 및 지우기
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏱️</div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>일일 평균 이용 시간</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            지난 7일간 평균 42분 이용
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityOverviewTab;
