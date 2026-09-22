import React from 'react';
import { reportApi, viewApi } from '../../services';

export const ReelOptionsMenu = ({ isOpen, onClose, reel, onToggleFollow }) => {
  if (!isOpen) return null;

  const handleReport = async () => {
    const reason = window.prompt("릴스 신고 사유를 입력해주세요 (예: 부적절한 콘텐츠, 스팸, 폭력성):", "부적절한 콘텐츠");
    if (!reason) return;

    try {
      await reportApi.createReport({
        targetType: 'reel',
        targetId: reel.id,
        reason: reason.trim(),
      });
      alert("신고가 정상 접수되었습니다. 검토 후 신속히 조치하겠습니다.");
    } catch (err) {
      console.error("Report reel error:", err);
      const msg = err.response?.data?.detail || "신고 접수에 실패했습니다.";
      alert(msg);
    } finally {
      onClose();
    }
  };

  const handleNotInterested = async () => {
    try {
      await viewApi.recordView({
        reelId: reel.id,
        notInterested: true,
        source: 'reels'
      });
      alert('관심 없음으로 설정되었습니다. 이와 비슷한 콘텐츠가 덜 추천됩니다.');
    } catch (err) {
      console.warn('notInterested view tracking failed:', err);
      alert('이 게시물과 비슷한 콘텐츠가 덜 추천됩니다.');
    } finally {
      onClose();
    }
  };

  return (
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
      onClick={onClose}
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
          onClick={handleReport}
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
            if (reel?.author?.id && onToggleFollow) {
              onToggleFollow(reel.author.id);
            }
            onClose();
          }}
          style={{
            padding: '14px 0',
            fontWeight: 600,
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border-color)',
            cursor: 'pointer',
          }}
        >
          {reel?.author?.isFollowing ? '팔로우 취소' : '팔로우'}
        </button>
        <button 
          onClick={handleNotInterested}
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
              navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel?.id}`);
            }
            alert('릴스 링크가 클립보드에 복사되었습니다.');
            onClose();
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
          onClick={onClose}
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
  );
};

export default ReelOptionsMenu;
