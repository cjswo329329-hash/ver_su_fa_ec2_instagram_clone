import React from 'react';
import { Modal } from './Modal';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { reportApi } from '../../services';

export const OptionsModal = () => {
  const { activeOptionsPost, closeOptions, deletePost } = useModal();
  const { user } = useAuth();

  if (!activeOptionsPost) return null;

  const isOwner = user && (
    user.id === activeOptionsPost.user_id ||
    user.id === activeOptionsPost.userId ||
    user.id === activeOptionsPost.author?.id ||
    user.is_admin ||
    user.isAdmin
  );

  const handleReport = async () => {
    const reason = window.prompt("신고 사유를 입력해주세요 (예: 스팸, 부적절한 콘텐츠, 권리 침해):", "부적절한 콘텐츠");
    if (!reason) return;

    try {
      await reportApi.createReport({
        targetType: 'post',
        targetId: activeOptionsPost.id,
        reason: reason.trim(),
      });
      alert("신고가 정상 접수되었습니다. 검토 후 신속히 조치하겠습니다.");
    } catch (err) {
      console.error("Report post error:", err);
      const msg = err.response?.data?.detail || "신고 접수에 실패했습니다.";
      alert(msg);
    } finally {
      closeOptions();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.origin + `/post/${activeOptionsPost.id}`);
    alert("게시물 링크가 클립보드에 복사되었습니다!");
    closeOptions();
  };

  const handleDelete = () => {
    if (window.confirm("게시물을 정말 삭제하시겠습니까?")) {
      deletePost(activeOptionsPost.id);
      closeOptions();
    }
  };

  return (
    <Modal
      isOpen={!!activeOptionsPost}
      onClose={closeOptions}
      maxWidth="400px"
      width="85%"
      showCloseButton={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!isOwner && (
          <button
            onClick={handleReport}
            style={{
              padding: '14px',
              color: 'var(--ig-danger)',
              fontWeight: 700,
              fontSize: '14px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            신고
          </button>
        )}

        {isOwner && (
          <button
            onClick={handleDelete}
            style={{
              padding: '14px',
              color: 'var(--ig-danger)',
              fontWeight: 700,
              fontSize: '14px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            삭제
          </button>
        )}

        <button
          onClick={handleCopyLink}
          style={{
            padding: '14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          링크 복사
        </button>

        <button
          onClick={() => {
            alert("공유창이 열립니다.");
            closeOptions();
          }}
          style={{
            padding: '14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          공유 대상...
        </button>

        <button
          onClick={closeOptions}
          style={{
            padding: '14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
          }}
        >
          취소
        </button>
      </div>
    </Modal>
  );
};
