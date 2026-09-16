import React, { useState, useEffect, useCallback } from 'react';
import { 
  ClipboardList, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Filter, 
  ShieldCheck,
  Globe
} from 'lucide-react';
import { adminApi } from '../../services';

const ACTION_BADGES = {
  DELETE_USER: { label: '회원 영구 탈퇴', color: '#ed4956', bg: 'rgba(237, 73, 86, 0.12)' },
  SUSPEND_USER: { label: '계정 이용 정지', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  UNSUSPEND_USER: { label: '계정 정지 해제', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  BULK_SUSPEND_USERS: { label: '일괄 계정 정지', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  DELETE_POST: { label: '게시물 강제 삭제', color: '#ed4956', bg: 'rgba(237, 73, 86, 0.12)' },
  BULK_DELETE_POSTS: { label: '게시물 일괄 삭제', color: '#ed4956', bg: 'rgba(237, 73, 86, 0.12)' },
  DELETE_REEL: { label: '릴스 강제 삭제', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  BULK_DELETE_REELS: { label: '릴스 일괄 삭제', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  RESOLVE_REPORT_RESOLVED: { label: '신고 승인 및 조치', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  RESOLVE_REPORT_DISMISSED: { label: '신고 기각(반려)', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

export const AdminAuditLogManagement = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAuditLogs({
        page,
        pageSize,
        action: actionFilter,
      });
      setLogs(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 헤더 및 필터 컨트롤러 */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={20} color="var(--ig-primary-button)" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            관리자 행위 감사 추적 로그 (ISMS-P 준수)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
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
            <option value="">모든 조치 유형</option>
            <option value="DELETE_USER">회원 영구 탈퇴</option>
            <option value="SUSPEND_USER">계정 이용 정지</option>
            <option value="UNSUSPEND_USER">계정 정지 해제</option>
            <option value="DELETE_POST">게시물 강제 삭제</option>
            <option value="DELETE_REEL">릴스 강제 삭제</option>
            <option value="BULK_DELETE_POSTS">게시물 일괄 삭제</option>
            <option value="BULK_DELETE_REELS">릴스 일괄 삭제</option>
            <option value="RESOLVE_REPORT_RESOLVED">신고 승인 및 조치</option>
            <option value="RESOLVE_REPORT_DISMISSED">신고 기각(반려)</option>
          </select>
          <button
            onClick={fetchAuditLogs}
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

      {/* 감사 로그 테이블 */}
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
                <th style={{ padding: '14px 16px' }}>발생 일시 (KST)</th>
                <th style={{ padding: '14px 16px' }}>관리자 계정</th>
                <th style={{ padding: '14px 16px' }}>수행 조치</th>
                <th style={{ padding: '14px 16px' }}>조치 대상</th>
                <th style={{ padding: '14px 16px' }}>사유 및 비고</th>
                <th style={{ padding: '14px 16px' }}>접속 IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    감사 로그 데이터를 조회하고 있습니다...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    기록된 감사 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = ACTION_BADGES[log.action] || {
                    label: log.action,
                    color: 'var(--text-primary)',
                    bg: 'var(--border-subtle)',
                  };

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                      }}
                      className="admin-table-row"
                    >
                      {/* 일시 */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.created_at)}
                      </td>

                      {/* 관리자 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={14} color="var(--ig-danger)" />
                          <strong style={{ color: 'var(--text-primary)' }}>@{log.admin_username}</strong>
                        </div>
                      </td>

                      {/* 조치 액션 뱃지 */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* 조치 대상 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {log.target_type}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {log.target_identifier || (log.target_id ? `#${log.target_id}` : '-')}
                          </span>
                        </div>
                      </td>

                      {/* 사유 */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)', maxWidth: '320px' }}>
                        {log.reason || '-'}
                      </td>

                      {/* 접속 IP */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                          <Globe size={12} />
                          <span>{log.ip_address || '127.0.0.1'}</span>
                        </div>
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
            총 <strong>{total}</strong>건의 감사 기록 (페이지 {page} / {totalPages})
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
    </div>
  );
};

export default AdminAuditLogManagement;
