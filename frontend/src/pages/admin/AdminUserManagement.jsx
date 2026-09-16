import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  ShieldCheck, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  X, 
  UserX, 
  UserCheck, 
  Download, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { adminApi } from '../../services';
import { useAuth } from '../../contexts/AuthContext';

export const AdminUserManagement = ({ onDataChange }) => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at_desc');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const usersCountRef = useRef(0);
  usersCountRef.current = users.length;

  // 다중 선택 상태 (Bulk Actions)
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // 모달 상태
  const [targetUser, setTargetUser] = useState(null); // 탈퇴 모달
  const [suspendTarget, setSuspendTarget] = useState(null); // 정지 모달
  const [suspendReason, setSuspendReason] = useState('운영 정책 위반으로 인한 이용 정지');
  const [showBulkSuspendModal, setShowBulkSuspendModal] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchUsers = useCallback(async (options = {}) => {
    const isSilent = options?.silent === true;
    const hasExistingData = usersCountRef.current > 0;

    if (!isSilent) {
      if (hasExistingData) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      const data = await adminApi.getUsers({
        page,
        pageSize,
        q: searchTerm,
        sortBy,
      });
      setUsers(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      if (!isSilent) {
        setSelectedUserIds([]); // 페이지/정렬/검색 변경 시에만 선택 초기화
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      if (!isSilent) {
        setError('회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, pageSize, searchTerm, sortBy]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return '오늘 가입';
      if (diffDays === 1) return '어제 가입';
      if (diffDays < 30) return `${diffDays}일 전`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
      return `${Math.floor(diffDays / 365)}년 전`;
    } catch {
      return '';
    }
  };

  // CSV 데이터 내보내기
  const exportUsersToCSV = () => {
    if (!users || users.length === 0) return;
    const headers = ['ID', '아이디', '이메일', '성명', '역할', '상태', '정지사유', '게시물수', '팔로워수', '가입일시'];
    const rows = users.map(u => [
      u.id,
      u.username,
      u.email,
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      u.is_admin ? '최고관리자' : '일반회원',
      u.is_suspended ? '정지됨' : '정상',
      `"${(u.suspension_reason || '').replace(/"/g, '""')}"`,
      u.posts_count,
      u.followers_count,
      u.created_at
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `instagram_users_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 전체 선택/해제 토글
  const handleToggleSelectAll = () => {
    const selectableUsers = users.filter(u => !u.is_admin);
    if (selectedUserIds.length === selectableUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map(u => u.id));
    }
  };

  const handleToggleSelectUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // 회원 탈퇴 처리 실행 (낙관적 UI 적용)
  const handleConfirmDelete = async () => {
    if (!targetUser) return;
    const userToDelete = targetUser;
    const previousUsers = [...users];
    const previousTotal = total;

    // 1. 낙관적 UI 업데이트: 로컬 목록에서 즉시 제거
    setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    setTotal(prev => Math.max(0, prev - 1));
    setSelectedUserIds(prev => prev.filter(id => id !== userToDelete.id));
    setTargetUser(null);
    setActionSuccess(`'${userToDelete.username}' 회원이 성공적으로 탈퇴 처리되었습니다.`);

    setDeleting(true);
    try {
      const res = await adminApi.deleteUser(userToDelete.id);
      if (res.message) setActionSuccess(res.message);
      // 조용히 백그라운드 데이터 동기화
      fetchUsers({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Delete user failed:', err);
      // 실패 시 상태 롤백
      setUsers(previousUsers);
      setTotal(previousTotal);
      alert(err.response?.data?.detail || '회원 탈퇴 처리에 실패했습니다.');
    } finally {
      setDeleting(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // 계정 정지 처리 실행 (낙관적 UI 적용)
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    const userToSuspend = suspendTarget;
    const reason = suspendReason;
    const previousUsers = [...users];

    // 1. 낙관적 UI 업데이트: 즉각 정지 상태로 표시
    setUsers(prev => prev.map(u => 
      u.id === userToSuspend.id ? { ...u, is_suspended: true, suspension_reason: reason } : u
    ));
    setSuspendTarget(null);
    setActionSuccess(`'${userToSuspend.username}' 회원이 이용 정지되었습니다.`);

    try {
      const res = await adminApi.suspendUser(userToSuspend.id, reason);
      if (res.message) setActionSuccess(res.message);
      fetchUsers({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Suspend user failed:', err);
      // 실패 시 롤백
      setUsers(previousUsers);
      alert(err.response?.data?.detail || '계정 정지 처리에 실패했습니다.');
    } finally {
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // 계정 정지 해제 (낙관적 UI 적용)
  const handleUnsuspend = async (user) => {
    const previousUsers = [...users];

    // 1. 낙관적 UI 업데이트: 즉각 정상 상태로 복구
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, is_suspended: false, suspension_reason: null } : u
    ));
    setActionSuccess(`'${user.username}' 계정 정지가 해제되었습니다.`);

    try {
      const res = await adminApi.unsuspendUser(user.id);
      if (res.message) setActionSuccess(res.message);
      fetchUsers({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Unsuspend user failed:', err);
      // 실패 시 롤백
      setUsers(previousUsers);
      alert(err.response?.data?.detail || '정지 해제에 실패했습니다.');
    } finally {
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // 일괄 정지 처리 실행 (낙관적 UI 적용)
  const handleConfirmBulkSuspend = async () => {
    if (selectedUserIds.length === 0) return;
    const targetIds = [...selectedUserIds];
    const reason = suspendReason;
    const previousUsers = [...users];
    const prevSelected = [...selectedUserIds];

    // 1. 낙관적 UI 업데이트: 선택된 회원들 즉시 정지 상태로 표시
    setUsers(prev => prev.map(u => 
      targetIds.includes(u.id) ? { ...u, is_suspended: true, suspension_reason: reason } : u
    ));
    setShowBulkSuspendModal(false);
    setSelectedUserIds([]);
    setActionSuccess(`${targetIds.length}명 회원이 일괄 정지되었습니다.`);

    try {
      const res = await adminApi.bulkSuspendUsers(targetIds, reason);
      if (res.message) setActionSuccess(res.message);
      fetchUsers({ silent: true });
      if (onDataChange) onDataChange();
    } catch (err) {
      console.error('Bulk suspend users failed:', err);
      // 실패 시 롤백
      setUsers(previousUsers);
      setSelectedUserIds(prevSelected);
      alert(err.response?.data?.detail || '일괄 정지 처리에 실패했습니다.');
    } finally {
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const selectableCount = users.filter(u => !u.is_admin).length;
  const isAllSelected = selectableCount > 0 && selectedUserIds.length === selectableCount;

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

      {/* 필터 및 검색 바 컨트롤러 */}
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
        {/* 검색 인풋 */}
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
            placeholder="아이디, 성명, 이메일 검색..."
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

        {/* 정렬 & 액션 버튼들 */}
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
              <option value="created_at_desc">최신 가입순</option>
              <option value="created_at_asc">오래된 가입순</option>
              <option value="posts_desc">게시물 많은순</option>
              <option value="followers_desc">팔로워 많은순</option>
            </select>
          </div>

          <button
            onClick={exportUsersToCSV}
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

      {/* 다중 선택 일괄 액션 바 */}
      {selectedUserIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'rgba(0, 149, 246, 0.08)',
            border: '1px solid rgba(0, 149, 246, 0.3)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--ig-primary-button)' }}>
            총 <strong>{selectedUserIds.length}</strong>명의 회원이 선택되었습니다.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowBulkSuspendModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <UserX size={14} />
              선택 회원 일괄 정지
            </button>
            <button
              onClick={() => setSelectedUserIds([])}
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

      {/* 회원 목록 테이블 */}
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
                <th style={{ padding: '14px 16px' }}>회원 정보</th>
                <th style={{ padding: '14px 16px' }}>이메일</th>
                <th style={{ padding: '14px 16px' }}>가입 일시</th>
                <th style={{ padding: '14px 16px' }}>활동 현황</th>
                <th style={{ padding: '14px 16px' }}>상태 및 권한</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>관리 조치</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    회원 데이터를 조회하고 있습니다...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {searchTerm ? '검색 결과와 일치하는 회원이 없습니다.' : '등록된 회원이 없습니다.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isProtectedAdmin = u.is_admin;
                  const isSelected = selectedUserIds.includes(u.id);
                  const relative = getRelativeTime(u.created_at);

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(0, 149, 246, 0.04)' : (u.is_suspended ? 'rgba(237, 73, 86, 0.04)' : 'transparent'),
                      }}
                      className="admin-table-row"
                    >
                      {/* 체크박스 */}
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          disabled={isProtectedAdmin}
                          checked={isSelected}
                          onChange={() => handleToggleSelectUser(u.id)}
                          style={{ cursor: isProtectedAdmin ? 'not-allowed' : 'pointer' }}
                        />
                      </td>

                      {/* 프로필 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={u.profile_image_url} size="md" />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <a
                                href={`/${u.username}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                }}
                              >
                                {u.username}
                              </a>
                              {u.is_verified && <span style={{ color: '#0095f6', fontSize: '12px' }}>✓</span>}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {u.full_name || '이름 없음'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 이메일 */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {u.email}
                      </td>

                      {/* 가입 일시 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {formatDateTime(u.created_at)}
                        </div>
                        {relative && (
                          <div style={{ fontSize: '11px', color: '#0095f6', marginTop: '2px', fontWeight: 500 }}>
                            {relative}
                          </div>
                        )}
                      </td>

                      {/* 활동 현황 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          게시물 <strong>{u.posts_count}</strong>개
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          팔로워 {u.followers_count}명
                        </div>
                      </td>

                      {/* 상태 및 권한 뱃지 */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          {u.is_admin ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                backgroundColor: 'rgba(237, 73, 86, 0.1)',
                                color: 'var(--ig-danger)',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              <ShieldCheck size={12} /> 최고 관리자
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                backgroundColor: 'rgba(0, 149, 246, 0.08)',
                                color: '#0095f6',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              <User size={12} /> 일반 회원
                            </span>
                          )}

                          {u.is_suspended ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                backgroundColor: 'rgba(237, 73, 86, 0.12)',
                                color: 'var(--ig-danger)',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                              title={u.suspension_reason || '사유 없음'}
                            >
                              정지됨
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 6px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                              }}
                            >
                              정상
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 관리 조치 */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isProtectedAdmin ? (
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              fontWeight: 600,
                            }}
                          >
                            보호됨 (관리자)
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {u.is_suspended ? (
                              <button
                                onClick={() => handleUnsuspend(u)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  borderRadius: '6px',
                                  color: '#10b981',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <UserCheck size={13} /> 정지 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendTarget(u)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  color: '#f59e0b',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <UserX size={13} /> 정지
                              </button>
                            )}

                            <button
                              onClick={() => setTargetUser(u)}
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
                              <Trash2 size={13} /> 탈퇴
                            </button>
                          </div>
                        )}
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
            총 <strong>{total}</strong>명의 회원 (페이지 {page} / {totalPages})
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

      {/* 1. 회원 탈퇴 확인 모달 */}
      {targetUser && (
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
              회원 강제 탈퇴 처리
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              <strong>@{targetUser.username}</strong> 계정을 정말 탈퇴 처리하시겠습니까?
              <br />
              해당 회원이 업로드한 물리 미디어 파일 및 모든 활동 데이터가 삭제됩니다.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setTargetUser(null)}
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
                {deleting ? '탈퇴 처리 중...' : '네, 탈퇴시킵니다'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 회원 계정 정지 모달 */}
      {suspendTarget && (
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <UserX size={24} color="#f59e0b" />
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                계정 이용 정지 (@{suspendTarget.username})
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              해당 회원의 로그인을 즉시 차단하고 서비스 이용을 정지합니다.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                정지 사유:
              </label>
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
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
                onClick={() => setSuspendTarget(null)}
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
                취소
              </button>
              <button
                onClick={handleConfirmSuspend}
                style={{
                  flex: 1.2,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                계정 정지 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 일괄 정지 모달 */}
      {showBulkSuspendModal && (
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <UserX size={24} color="#f59e0b" />
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                선택 회원 일괄 정지 ({selectedUserIds.length}명)
              </h3>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                일괄 정지 사유:
              </label>
              <input
                type="text"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
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
                onClick={() => setShowBulkSuspendModal(false)}
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
                취소
              </button>
              <button
                onClick={handleConfirmBulkSuspend}
                style={{
                  flex: 1.2,
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                일괄 정지 실행
              </button>
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

export default AdminUserManagement;
