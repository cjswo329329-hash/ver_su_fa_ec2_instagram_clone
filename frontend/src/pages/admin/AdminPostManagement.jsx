import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Heart, 
  MessageCircle, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  X, 
  MapPin, 
  Image as ImageIcon,
  Download
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { adminApi } from '../../services';

export const AdminPostManagement = ({ onDataChange }) => {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const postsCountRef = useRef(0);
  postsCountRef.current = posts.length;

  // 다중 선택 상태 (Bulk Actions)
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // 단일 삭제 대상
  const [targetPost, setTargetPost] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // 미디어 미리보기 모달 상태
  const [previewMedia, setPreviewMedia] = useState(null);

  const fetchPosts = useCallback(async (options = {}) => {
    const isSilent = options?.silent === true;
    const hasExistingData = postsCountRef.current > 0;

    if (!isSilent) {
      if (hasExistingData) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    try {
      const data = await adminApi.getPosts({
        page,
        pageSize,
        q: searchTerm,
        sortBy,
      });
      setPosts(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      if (!isSilent) {
        setSelectedPostIds([]);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, pageSize, searchTerm, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
  const exportPostsToCSV = () => {
    if (!posts || posts.length === 0) return;
    const headers = ['ID', '작성자', '캡션내용', '위치', '좋아요수', '댓글수', '미디어수', '작성일시'];
    const rows = posts.map(p => [
      p.id,
      p.author?.username || '',
      `"${(p.caption || '').replace(/"/g, '""')}"`,
      `"${(p.location || '').replace(/"/g, '""')}"`,
      p.likes_count,
      p.comments_count,
      p.media_urls?.length || 0,
      p.created_at
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `instagram_posts_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 다중 선택 토글
  const handleToggleSelectAll = () => {
    if (selectedPostIds.length === posts.length) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(posts.map(p => p.id));
    }
  };

  const handleToggleSelectPost = (postId) => {
    setSelectedPostIds(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  // 게시물 단일 강제 삭제 실행 (낙관적 UI 적용)
  const handleConfirmDelete = async () => {
    if (!targetPost) return;
    const postToDelete = targetPost;
    const previousPosts = [...posts];
    const previousTotal = total;

    // 1. 낙관적 UI 업데이트: 목록에서 즉시 제거
    setPosts(prev => prev.filter(p => p.id !== postToDelete.id));
    setTotal(prev => Math.max(0, prev - 1));
    setSelectedPostIds(prev => prev.filter(id => id !== postToDelete.id));
    setTargetPost(null);
    setActionSuccess(`게시물 (ID: ${postToDelete.id})이 성공적으로 삭제되었습니다.`);

    setDeleting(true);
    try {
      const res = await adminApi.deletePost(postToDelete.id);
      if (res.message) setActionSuccess(res.message);
      fetchPosts({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Delete post failed:', err);
      // 실패 시 롤백
      setPosts(previousPosts);
      setTotal(previousTotal);
      alert(err.response?.data?.detail || '게시물 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // 게시물 일괄 삭제 실행 (낙관적 UI 적용)
  const handleConfirmBulkDelete = async () => {
    if (selectedPostIds.length === 0) return;
    const targetIds = [...selectedPostIds];
    const previousPosts = [...posts];
    const previousTotal = total;
    const prevSelected = [...selectedPostIds];

    // 1. 낙관적 UI 업데이트: 선택된 게시물들 즉시 제거
    setPosts(prev => prev.filter(p => !targetIds.includes(p.id)));
    setTotal(prev => Math.max(0, prev - targetIds.length));
    setShowBulkDeleteModal(false);
    setSelectedPostIds([]);
    setActionSuccess(`${targetIds.length}개 게시물이 일괄 삭제되었습니다.`);

    setDeleting(true);
    try {
      const res = await adminApi.bulkDeletePosts(targetIds);
      if (res.message) setActionSuccess(res.message);
      fetchPosts({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Bulk delete posts failed:', err);
      // 실패 시 롤백
      setPosts(previousPosts);
      setTotal(previousTotal);
      setSelectedPostIds(prevSelected);
      alert(err.response?.data?.detail || '일괄 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const isAllSelected = posts.length > 0 && selectedPostIds.length === posts.length;

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
            placeholder="캡션 본문, 작성자 아이디 검색..."
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
            </select>
          </div>

          <button
            onClick={exportPostsToCSV}
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
      {selectedPostIds.length > 0 && (
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
            총 <strong>{selectedPostIds.length}</strong>개의 게시물이 선택되었습니다.
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
              선택 항목 일괄 강제 삭제
            </button>
            <button
              onClick={() => setSelectedPostIds([])}
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

      {/* 게시물 목록 테이블 */}
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
                <th style={{ padding: '14px 16px', width: '70px' }}>미디어</th>
                <th style={{ padding: '14px 16px' }}>작성자</th>
                <th style={{ padding: '14px 16px', minWidth: '220px' }}>캡션 내용</th>
                <th style={{ padding: '14px 16px' }}>작성 일시</th>
                <th style={{ padding: '14px 16px' }}>반응 통계</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>삭제 관리</th>
              </tr>
            </thead>
            <tbody>
              {loading && posts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    게시물 목록을 불러오는 중입니다...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {searchTerm ? '검색어와 일치하는 게시물이 없습니다.' : '등록된 게시물이 없습니다.'}
                  </td>
                </tr>
              ) : (
                posts.map((post) => {
                  const firstMedia = post.media_urls?.[0];
                  const isSelected = selectedPostIds.includes(post.id);

                  return (
                    <tr
                      key={post.id}
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
                          onChange={() => handleToggleSelectPost(post.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* 미디어 썸네일 */}
                      <td style={{ padding: '10px 16px' }}>
                        <div
                          onClick={() => setPreviewMedia(post)}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="미리보기 클릭"
                        >
                          {firstMedia ? (
                            <img
                              src={firstMedia}
                              alt="Thumbnail"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={18} color="var(--text-muted)" />
                          )}
                          {post.media_urls?.length > 1 && (
                            <span
                              style={{
                                position: 'absolute',
                                right: '2px',
                                bottom: '2px',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                color: '#ffffff',
                                fontSize: '9px',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                fontWeight: 700,
                              }}
                            >
                              +{post.media_urls.length - 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 작성자 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={post.author?.profile_image_url} size="xs" />
                          <div>
                            <a
                              href={`/${post.author?.username}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                fontSize: '13px',
                              }}
                            >
                              {post.author?.username || 'unknown'}
                            </a>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              ID #{post.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 캡션 본문 */}
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
                          {post.caption || <span style={{ color: 'var(--text-muted)' }}>(본문 내용 없음)</span>}
                        </div>
                        {post.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <MapPin size={11} /> {post.location}
                          </div>
                        )}
                      </td>

                      {/* 작성 일시 */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {formatDateTime(post.created_at)}
                      </td>

                      {/* 반응 통계 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ed4956', fontSize: '12px', fontWeight: 600 }}>
                            <Heart size={12} fill="#ed4956" /> {post.likes_count}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#0095f6', fontSize: '12px', fontWeight: 600 }}>
                            <MessageCircle size={12} /> {post.comments_count}
                          </span>
                        </div>
                      </td>

                      {/* 삭제 버튼 */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setTargetPost(post)}
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
            총 <strong>{total}</strong>개의 게시물 (페이지 {page} / {totalPages})
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
      {targetPost && (
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
              게시물 강제 삭제
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              <strong>ID #{targetPost.id}</strong> (작성자: @{targetPost.author?.username}) 게시물을 삭제하시겠습니까?
              <br />
              서버에 업로드된 미디어 파일과 연관 알림 및 좋아요가 영구 삭제됩니다.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setTargetPost(null)}
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
              게시물 일괄 강제 삭제 ({selectedPostIds.length}개)
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              선택한 <strong>{selectedPostIds.length}개</strong>의 게시물을 모두 삭제하시겠습니까?
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

      {/* 3. 미디어 미리보기 모달 */}
      {previewMedia && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setPreviewMedia(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '14px' }}>
                게시물 미디어 미리보기 (ID #{previewMedia.id})
              </span>
              <button
                onClick={() => setPreviewMedia(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ maxHeight: '450px', overflowY: 'auto', backgroundColor: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {previewMedia.media_urls?.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Media ${idx + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              ))}
            </div>

            <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>
              <strong>@{previewMedia.author?.username}</strong>: {previewMedia.caption || '(내용 없음)'}
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

export default AdminPostManagement;
