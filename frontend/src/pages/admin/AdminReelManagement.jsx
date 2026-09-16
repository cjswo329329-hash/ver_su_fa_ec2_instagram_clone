import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Heart, 
  MessageCircle, 
  Share2, 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  X, 
  Music, 
  Film,
  Download
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { adminApi } from '../../services';

export const AdminReelManagement = ({ onDataChange }) => {
  const [reels, setReels] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reelsCountRef = useRef(0);
  reelsCountRef.current = reels.length;

  // 다중 선택 상태 (Bulk Actions)
  const [selectedReelIds, setSelectedReelIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // 단일 삭제 대상
  const [targetReel, setTargetReel] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // 비디오 미리보기 재생 모달 상태
  const [previewVideo, setPreviewVideo] = useState(null);

  const fetchReels = useCallback(async (options = {}) => {
    const isSilent = options?.silent === true;
    const hasExistingData = reelsCountRef.current > 0;

    if (!isSilent) {
      if (hasExistingData) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    try {
      const data = await adminApi.getReels({
        page,
        pageSize,
        q: searchTerm,
        sortBy,
      });
      setReels(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      if (!isSilent) {
        setSelectedReelIds([]);
      }
    } catch (err) {
      console.error('Failed to fetch reels:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, pageSize, searchTerm, sortBy]);

  useEffect(() => {
    fetchReels();
  }, [fetchReels]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // CSV 데이터 내보내기
  const exportReelsToCSV = () => {
    if (!reels || reels.length === 0) return;
    const headers = ['ID', '작성자', '캡션내용', '음원제목', '좋아요수', '댓글수', '공유수', '작성일시'];
    const rows = reels.map(r => [
      r.id,
      r.author?.username || '',
      `"${(r.caption || '').replace(/"/g, '""')}"`,
      `"${(r.audio_title || '').replace(/"/g, '""')}"`,
      r.likes_count,
      r.comments_count,
      r.shares_count,
      r.created_at
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `instagram_reels_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 다중 선택 토글
  const handleToggleSelectAll = () => {
    if (selectedReelIds.length === reels.length) {
      setSelectedReelIds([]);
    } else {
      setSelectedReelIds(reels.map(r => r.id));
    }
  };

  const handleToggleSelectReel = (reelId) => {
    setSelectedReelIds(prev => 
      prev.includes(reelId) ? prev.filter(id => id !== reelId) : [...prev, reelId]
    );
  };

  // 릴스 단일 삭제 실행 (낙관적 UI 적용)
  const handleConfirmDelete = async () => {
    if (!targetReel) return;
    const reelToDelete = targetReel;
    const previousReels = [...reels];
    const previousTotal = total;

    // 1. 낙관적 UI 업데이트: 목록에서 즉각 제거
    setReels(prev => prev.filter(r => r.id !== reelToDelete.id));
    setTotal(prev => Math.max(0, prev - 1));
    setSelectedReelIds(prev => prev.filter(id => id !== reelToDelete.id));
    setTargetReel(null);
    setActionSuccess(`릴스 (ID: ${reelToDelete.id})이 성공적으로 삭제되었습니다.`);

    setDeleting(true);
    try {
      const res = await adminApi.deleteReel(reelToDelete.id);
      if (res.message) setActionSuccess(res.message);
      fetchReels({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Delete reel failed:', err);
      // 실패 시 롤백
      setReels(previousReels);
      setTotal(previousTotal);
      alert(err.response?.data?.detail || '릴스 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // 릴스 일괄 삭제 실행 (낙관적 UI 적용)
  const handleConfirmBulkDelete = async () => {
    if (selectedReelIds.length === 0) return;
    const targetIds = [...selectedReelIds];
    const previousReels = [...reels];
    const previousTotal = total;
    const prevSelected = [...selectedReelIds];

    // 1. 낙관적 UI 업데이트: 선택된 릴스들 즉시 제거
    setReels(prev => prev.filter(r => !targetIds.includes(r.id)));
    setTotal(prev => Math.max(0, prev - targetIds.length));
    setShowBulkDeleteModal(false);
    setSelectedReelIds([]);
    setActionSuccess(`${targetIds.length}개 릴스가 일괄 삭제되었습니다.`);

    setDeleting(true);
    try {
      const res = await adminApi.bulkDeleteReels(targetIds);
      if (res.message) setActionSuccess(res.message);
      fetchReels({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Bulk delete reels failed:', err);
      // 실패 시 롤백
      setReels(previousReels);
      setTotal(previousTotal);
      setSelectedReelIds(prevSelected);
      alert(err.response?.data?.detail || '일괄 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const isAllSelected = reels.length > 0 && selectedReelIds.length === reels.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 액션 성공 알림 */}
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
          <CheckCircle size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 필터 및 검색 바 */}
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
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="캡션, 작성자, 음원 제목 검색..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '2px',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={15} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={sortBy}
              onChange={handleSortChange}
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
              <option value="created_at_desc">최신 등록순</option>
              <option value="created_at_asc">오래된 등록순</option>
              <option value="likes_desc">좋아요 많은순</option>
              <option value="comments_desc">댓글 많은순</option>
              <option value="shares_desc">공유 많은순</option>
            </select>
          </div>

          <button
            onClick={exportReelsToCSV}
            title="현재 목록 CSV 다운로드"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={15} />
            <span>CSV 내보내기</span>
          </button>
        </div>
      </div>

      {/* 다중 선택 일괄 삭제 바 */}
      {selectedReelIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'rgba(237, 73, 86, 0.08)',
            border: '1px solid rgba(237, 73, 86, 0.3)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--ig-danger)' }}>
            총 <strong>{selectedReelIds.length}</strong>개의 릴스가 선택되었습니다.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--ig-danger)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
              선택 릴스 일괄 강제 삭제
            </button>
            <button
              onClick={() => setSelectedReelIds([])}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              선택 취소
            </button>
          </div>
        </div>
      )}

      {/* 릴스 목록 테이블 */}
      <div
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* 상단 미세 새로고침 인디케이터 바 */}
        <div
          style={{
            height: '3px',
            width: '100%',
            backgroundColor: isRefreshing ? 'rgba(0, 149, 246, 0.12)' : 'transparent',
            position: 'relative',
            overflow: 'hidden',
            transition: 'background-color 0.2s',
          }}
        >
          {isRefreshing && (
            <div
              className="admin-smooth-progress-bar"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                backgroundColor: '#0095f6',
                borderRadius: '2px',
              }}
            />
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
              opacity: isRefreshing ? 0.72 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
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
                <th style={{ padding: '14px 12px', width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '14px 16px', width: '80px' }}>비디오</th>
                <th style={{ padding: '14px 16px' }}>작성자</th>
                <th style={{ padding: '14px 16px', minWidth: '220px' }}>캡션 및 오디오</th>
                <th style={{ padding: '14px 16px' }}>등록 일시</th>
                <th style={{ padding: '14px 16px' }}>반응 지표</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>삭제 관리</th>
              </tr>
            </thead>
            <tbody>
              {loading && reels.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    릴스 목록을 불러오는 중입니다...
                  </td>
                </tr>
              ) : reels.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {searchTerm ? '검색어와 일치하는 릴스가 없습니다.' : '등록된 릴스가 없습니다.'}
                  </td>
                </tr>
              ) : (
                reels.map((reel) => {
                  const isSelected = selectedReelIds.includes(reel.id);

                  return (
                    <tr
                      key={reel.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(237, 73, 86, 0.04)' : 'transparent',
                      }}
                      className="admin-table-row"
                    >
                      {/* 체크박스 */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectReel(reel.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* 썸네일 & 재생 */}
                      <td style={{ padding: '10px 16px' }}>
                        <div
                          onClick={() => setPreviewVideo(reel)}
                          style={{
                            width: '48px',
                            height: '68px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            backgroundColor: '#000000',
                            position: 'relative',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="재생 미리보기"
                        >
                          {reel.poster_url ? (
                            <img
                              src={reel.poster_url}
                              alt="Poster"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Film size={20} color="#ffffff" />
                          )}
                          <div
                            style={{
                              position: 'absolute',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0,0,0,0.55)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                            }}
                          >
                            <Play size={12} fill="#ffffff" />
                          </div>
                        </div>
                      </td>

                      {/* 작성자 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={reel.author?.profile_image_url} size="xs" />
                          <div>
                            <a
                              href={`/${reel.author?.username}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                fontSize: '13px',
                              }}
                            >
                              {reel.author?.username || 'unknown'}
                            </a>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              ID #{reel.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 캡션 & 오디오 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{
                            maxWidth: '360px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {reel.caption || <span style={{ color: 'var(--text-muted)' }}>(캡션 내용 없음)</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#8b5cf6', marginTop: '3px' }}>
                          <Music size={11} /> {reel.audio_title || '원본 오디오'}
                        </div>
                      </td>

                      {/* 등록 일시 */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(reel.created_at)}
                      </td>

                      {/* 반응 지표 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ed4956', fontSize: '12px', fontWeight: 600 }}>
                            <Heart size={12} fill="#ed4956" /> {reel.likes_count}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#0095f6', fontSize: '12px', fontWeight: 600 }}>
                            <MessageCircle size={12} /> {reel.comments_count}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                            <Share2 size={12} /> {reel.shares_count}
                          </span>
                        </div>
                      </td>

                      {/* 삭제 버튼 */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setTargetReel(reel)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--ig-danger)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} /> 삭제
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 바 */}
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
            총 <strong>{total}</strong>개의 릴스 (페이지 {page} / {totalPages})
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

      {/* 1. 단일 삭제 모달 */}
      {targetReel && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(237, 73, 86, 0.1)',
                color: 'var(--ig-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              릴스 동영상 강제 삭제
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              <strong>ID #{targetReel.id}</strong> (작성자: @{targetReel.author?.username}) 릴스를 삭제하시겠습니까?
              <br />
              비디오 원본 파일과 연관 알림 및 좋아요가 영구 삭제됩니다.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setTargetReel(null)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--ig-danger)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? '삭제 중...' : '네, 삭제합니다'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 일괄 삭제 모달 */}
      {showBulkDeleteModal && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(237, 73, 86, 0.1)',
                color: 'var(--ig-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              릴스 일괄 강제 삭제 ({selectedReelIds.length}개)
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              선택한 <strong>{selectedReelIds.length}개</strong>의 릴스를 모두 삭제하시겠습니까?
              <br />
              이 작업은 즉시 실행되며 복구할 수 없습니다.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmBulkDelete}
                disabled={deleting}
                style={{
                  flex: 1.2,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--ig-danger)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? '일괄 삭제 중...' : '일괄 삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 비디오 재생 모달 */}
      {previewVideo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setPreviewVideo(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '16px',
              maxWidth: '420px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '14px' }}>
                릴스 재생 미리보기 (ID #{previewVideo.id})
              </span>
              <button
                onClick={() => setPreviewVideo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ backgroundColor: '#000000', display: 'flex', justifyContent: 'center', maxHeight: '500px' }}>
              <video
                src={previewVideo.video_url}
                controls
                autoPlay
                style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>
              <strong>@{previewVideo.author?.username}</strong>: {previewVideo.caption || '(내용 없음)'}
            </div>
          </div>
        </div>
      )}

      {/* 부드러운 진행 바 키프레임 애니메이션 */}
      <style>{`
        @keyframes adminSmoothProgress {
          0% { left: -35%; width: 35%; }
          50% { left: 30%; width: 50%; }
          100% { left: 100%; width: 35%; }
        }
        .admin-smooth-progress-bar {
          animation: adminSmoothProgress 1.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default AdminReelManagement;
