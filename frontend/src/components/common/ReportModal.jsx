import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export const ReportModal = ({ isOpen, onClose, targetType = '게시물', onSubmit }) => {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ reason, details });
    }
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDetails('');
      onClose();
    }, 1200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="신고" maxWidth="420px">
      {submitted ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="#00ba7c" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>신고가 접수되었습니다</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            회원님의 소중한 제보는 안전하고 쾌적한 커뮤니티를 만드는 데 도움이 됩니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={20} color="#ed4956" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>이 {targetType}을 신고하는 이유가 무엇인가요?</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {[
              { id: 'spam', label: '스팸 또는 사기' },
              { id: 'hate', label: '혐오 발언 또는 노골적인 폭력' },
              { id: 'harassment', label: '괴롭힘 또는 따돌림' },
              { id: 'nudity', label: '성행위 또는 성적인 콘텐츠' },
              { id: 'intellectual_property', label: '지적 재산권 침해' },
              { id: 'other', label: '기타 사유' }
            ].map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: reason === opt.id ? 'var(--bg-secondary)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={opt.id}
                  checked={reason === opt.id}
                  onChange={(e) => setReason(e.target.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" size="sm" type="submit">
              신고 제출
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ReportModal;
