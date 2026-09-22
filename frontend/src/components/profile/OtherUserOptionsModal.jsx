import React from 'react';
import { Modal } from '../common/Modal';
import { reportApi } from '../../services';

export const OtherUserOptionsModal = ({ isOpen, onClose, profileUser }) => {
  if (!isOpen || !profileUser) return null;

  const handleReport = async () => {
    const reason = window.prompt(
      `@${profileUser.username} 사용자를 신고하는 사유를 입력해주세요 (예: 스팸, 사칭, 부적절한 게시물, 괴롭힘):`,
      '스팸 또는 부적절한 사용자'
    );
    if (!reason) return;

    try {
      await reportApi.createReport({
        targetType: 'user',
        targetId: profileUser.id,
        reason: reason.trim(),
      });
      alert('신고가 정상 접수되었습니다. 검토 후 신속히 조치하겠습니다.');
    } catch (err) {
      console.error('Report user error:', err);
      const msg = err.response?.data?.detail || '신고 접수에 실패했습니다.';
      alert(msg);
    } finally {
      onClose();
    }
  };

  const handleBlock = () => {
    if (window.confirm(`정말 @${profileUser.username}님을 차단하시겠습니까? 서로의 게시물이나 스토리를 더 이상 볼 수 없습니다.`)) {
      alert(`@${profileUser.username}님이 차단되었습니다.`);
      onClose();
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin + `/${profileUser.username}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      alert('프로필 링크가 클립보드에 복사되었습니다.');
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="400px"
      width="85%"
      showCloseButton={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
        <button
          onClick={handleReport}
          style={{
            padding: '14px',
            color: 'var(--ig-danger)',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
            background: 'none',
            border: 'none',
            borderBottomStyle: 'solid',
            borderBottomWidth: '1px',
            cursor: 'pointer',
          }}
        >
          신고
        </button>

        <button
          onClick={handleBlock}
          style={{
            padding: '14px',
            color: 'var(--ig-danger)',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
            background: 'none',
            border: 'none',
            borderBottomStyle: 'solid',
            borderBottomWidth: '1px',
            cursor: 'pointer',
          }}
        >
          차단
        </button>

        <button
          onClick={handleCopyLink}
          style={{
            padding: '14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            borderBottom: '1px solid var(--border-color)',
            background: 'none',
            border: 'none',
            borderBottomStyle: 'solid',
            borderBottomWidth: '1px',
            cursor: 'pointer',
          }}
        >
          프로필 링크 복사
        </button>

        <button
          onClick={onClose}
          style={{
            padding: '14px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
    </Modal>
  );
};

export default OtherUserOptionsModal;
