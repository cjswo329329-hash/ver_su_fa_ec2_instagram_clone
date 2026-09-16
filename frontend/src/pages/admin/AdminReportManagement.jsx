import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertOctagon, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  ShieldAlert,
  UserX,
  Trash2,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { adminApi } from '../../services';

const REASON_LABELS = {
  spam: '스팸 / 도배',
  nudity: '음란물 / 성적 행위',
  violence: '폭력 / 위험 콘텐츠',
  harassment: '괴롭힘 / 사이버 불링',
  hate_speech: '혐오 발언 / 차별',
  copyright: '저작권 침해',
  other: '기타 정책 위반'
};

export const AdminReportManagement = ({ onDataChange }) => {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // 신고 처리 모달 상태
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolveAction, setResolveAction] = useState('none'); // 'none' | 'delete_content' | 'suspend_user'
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getReports({
        page,
        pageSize,
        status: statusFilter,
        targetType: targetTypeFilter,
      });
      setReports(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, targetTypeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResolveSubmit = async (status) => {
    if (!selectedReport) return;
    setSubmitting(true);
    try {
      const res = await adminApi.resolveReport(selectedReport.id, {
        status,
        action: resolveAction,
        resolutionNotes,
      });
      setActionSuccess(res.message || '신고가 정상 처리되었습니다.');
      setSelectedReport(null);
      setResolutionNotes('');
      setResolveAction('none');
      fetchReports();
      if (onDataChange) onDataChange();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to resolve report:', err);
      alert(err.response?.data?.detail || '신고 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 필터 컨트롤러 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-elevated)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'pending', label: '미처리 대기중' },
            { id: 'resolved', label: '처리 완료' },
            { id: 'dismissed', label: '반려/기각' },
            { id: '', label: '전체 신고' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === tab.id ? 'var(--ig-primary-button)' : 'var(--bg-primary)',
                color: statusFilter === tab.id ? '#ffffff' : 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">모든 대상 유형</option>
            <option value="post">게시물</option>
            <option value="reel">릴스</option>
            <option value="user">회원 계정</option>
            <option value="comment">댓글</option>
          </select>
          <button
            onClick={fetchReports}
            title="새로고침"
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      {/* 신고 테이블 */}
      <div
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '14px 16px' }}>상태</th>
                <th style={{ padding: '14px 16px' }}>신고 대상</th>
                <th style={{ padding: '14px 16px' }}>신고 사유</th>
                <th style={{ padding: '14px 16px' }}>신고자</th>
                <th style={{ padding: '14px 16px' }}>신고 일시</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    신고 데이터를 조회하고 있습니다...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    접수된 신고 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isPending = r.status === 'pending';
                  const isResolved = r.status === 'resolved';

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isPending ? 'rgba(237, 73, 86, 0.02)' : 'transparent',
                      }}
                      className="admin-table-row"
                    >
                      {/* 상태 */}
                      <td style={{ padding: '14px 16px' }}>
                        {isPending && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              backgroundColor: 'rgba(237, 73, 86, 0.12)',
                              color: 'var(--ig-danger)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={12} />
                            대기중
                          </span>
                        )}
                        {isResolved && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={12} />
                            조치완료
                          </span>
                        )}
                        {r.status === 'dismissed' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              backgroundColor: 'var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            <XCircle size={12} />
                            기각됨
                          </span>
                        )}
                      </td>

                      {/* 신고 대상 */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {r.target_type}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {r.target_preview || `#${r.target_id}`}
                          </span>
                        </div>
                      </td>

                      {/* 신고 사유 */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--ig-danger)' }}>
                          {REASON_LABELS[r.reason] || r.reason}
                        </div>
                        {r.details && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.details}
                          </div>
                        )}
                      </td>

                      {/* 신고자 */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={r.reporter?.profile_image_url} size="xs" />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {r.reporter?.username || `User #${r.reporter_id}`}
                          </span>
                        </div>
                      </td>

                      {/* 일시 */}
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(r.created_at)}
                      </td>

                      {/* 처리 버튼 */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {isPending ? (
                          <button
                            onClick={() => setSelectedReport(r)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: 'var(--ig-primary-button)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            신고 심사
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedReport(r)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'transparent',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            상세 내역
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            총 <strong>{total}</strong>건의 신고 (페이지 {page} / {totalPages})
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
              }}
            >
              <ChevronLeft size={16} /> 이전
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '13px',
              }}
            >
              다음 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 신고 심사 / 조치 모달 */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <ShieldAlert size={24} color="var(--ig-danger)" />
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                신고 심사 및 조치 (ID #{selectedReport.id})
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              <div><strong>신고 대상:</strong> [{selectedReport.target_type}] {selectedReport.target_preview || selectedReport.target_id}</div>
              <div><strong>신고 사유:</strong> {REASON_LABELS[selectedReport.reason] || selectedReport.reason}</div>
              {selectedReport.details && <div><strong>상세 내용:</strong> {selectedReport.details}</div>}
              <div><strong>신고자:</strong> @{selectedReport.reporter?.username || selectedReport.reporter_id}</div>
              <div><strong>신고 일시:</strong> {formatDateTime(selectedReport.created_at)}</div>
              {selectedReport.status !== 'pending' && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', color: '#10b981' }}>
                  <strong>처리 담당자:</strong> @{selectedReport.resolver?.username || '관리자'} | {formatDateTime(selectedReport.resolved_at)}
                  {selectedReport.resolution_notes && <div><strong>처리 메모:</strong> {selectedReport.resolution_notes}</div>}
                </div>
              )}
            </div>

            {selectedReport.status === 'pending' ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                    연계 제재 조치 선택:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolveAction"
                        value="none"
                        checked={resolveAction === 'none'}
                        onChange={(e) => setResolveAction(e.target.value)}
                      />
                      <span>추가 조치 없음 (단순 승인 기록)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolveAction"
                        value="delete_content"
                        checked={resolveAction === 'delete_content'}
                        onChange={(e) => setResolveAction(e.target.value)}
                      />
                      <span style={{ color: 'var(--ig-danger)', fontWeight: 600 }}>해당 콘텐츠 즉시 강제 삭제</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="resolveAction"
                        value="suspend_user"
                        checked={resolveAction === 'suspend_user'}
                        onChange={(e) => setResolveAction(e.target.value)}
                      />
                      <span style={{ color: 'var(--ig-danger)', fontWeight: 600 }}>해당 작성자/유저 계정 이용 정지</span>
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    조치 사유 및 운영자 메모:
                  </label>
                  <input
                    type="text"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="예: 이용약관 제14조(음란물 금지) 위반으로 확인되어 삭제 처리함"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setSelectedReport(null)}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => handleResolveSubmit('dismissed')}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    신고 기각(반려)
                  </button>
                  <button
                    onClick={() => handleResolveSubmit('resolved')}
                    disabled={submitting}
                    style={{
                      flex: 1.5,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--ig-danger)',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? '처리 중...' : '신고 승인 및 제재'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReportManagement;
