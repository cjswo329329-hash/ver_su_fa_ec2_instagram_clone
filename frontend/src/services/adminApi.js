import api from './api';

export const adminApi = {
  // 통계 대시보드 데이터 조회
  getStats: async () => {
    const res = await api.get('/admin/stats');
    return res.data;
  },

  // 회원 관리 목록 조회 (가입날짜, 검색, 정렬, 페이징)
  getUsers: async ({ page = 1, pageSize = 15, q = '', sortBy = 'created_at_desc' } = {}) => {
    const params = { page, page_size: pageSize, sort_by: sortBy };
    if (q && q.trim()) {
      params.q = q.trim();
    }
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  // 회원 계정 정지 (Suspension)
  suspendUser: async (userId, reason = '') => {
    const res = await api.post(`/admin/users/${userId}/suspend`, { reason });
    return res.data;
  },

  // 회원 계정 정지 해제
  unsuspendUser: async (userId) => {
    const res = await api.post(`/admin/users/${userId}/unsuspend`);
    return res.data;
  },

  // 회원 일괄 정지
  bulkSuspendUsers: async (userIds, reason = '') => {
    const res = await api.post('/admin/users/bulk-suspend', { user_ids: userIds, reason });
    return res.data;
  },

  // 회원 탈퇴 처리 / 계정 삭제
  deleteUser: async (userId) => {
    const res = await api.delete(`/admin/users/${userId}`);
    return res.data;
  },

  // 게시물 관리 목록 조회
  getPosts: async ({ page = 1, pageSize = 15, q = '', sortBy = 'created_at_desc' } = {}) => {
    const params = { page, page_size: pageSize, sort_by: sortBy };
    if (q && q.trim()) {
      params.q = q.trim();
    }
    const res = await api.get('/admin/posts', { params });
    return res.data;
  },

  // 게시물 관리자 권한 강제 삭제
  deletePost: async (postId) => {
    const res = await api.delete(`/admin/posts/${postId}`);
    return res.data;
  },

  // 게시물 일괄 삭제
  bulkDeletePosts: async (postIds) => {
    const res = await api.post('/admin/posts/bulk-delete', { post_ids: postIds });
    return res.data;
  },

  // 릴스 관리 목록 조회
  getReels: async ({ page = 1, pageSize = 15, q = '', sortBy = 'created_at_desc' } = {}) => {
    const params = { page, page_size: pageSize, sort_by: sortBy };
    if (q && q.trim()) {
      params.q = q.trim();
    }
    const res = await api.get('/admin/reels', { params });
    return res.data;
  },

  // 릴스 동영상 관리자 권한 강제 삭제
  deleteReel: async (reelId) => {
    const res = await api.delete(`/admin/reels/${reelId}`);
    return res.data;
  },

  // 릴스 일괄 삭제
  bulkDeleteReels: async (reelIds) => {
    const res = await api.post('/admin/reels/bulk-delete', { reel_ids: reelIds });
    return res.data;
  },

  // 관리자 감사 로그 조회
  getAuditLogs: async ({ page = 1, pageSize = 20, action = '' } = {}) => {
    const params = { page, page_size: pageSize };
    if (action && action.trim()) {
      params.action = action.trim();
    }
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  },

  // 신고 목록 조회
  getReports: async ({ page = 1, pageSize = 15, status = '', targetType = '' } = {}) => {
    const params = { page, page_size: pageSize };
    if (status && status.trim()) {
      params.status_filter = status.trim();
    }
    if (targetType && targetType.trim()) {
      params.target_type = targetType.trim();
    }
    const res = await api.get('/admin/reports', { params });
    return res.data;
  },

  // 신고 처리
  resolveReport: async (reportId, { status = 'resolved', action = 'none', resolutionNotes = '' } = {}) => {
    const res = await api.post(`/admin/reports/${reportId}/resolve`, {
      status,
      action,
      resolution_notes: resolutionNotes,
    });
    return res.data;
  },

  // 일반 유저 신고 생성
  createReport: async ({ targetType, targetId, reason, details }) => {
    const res = await api.post('/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
    });
    return res.data;
  },
};

export default adminApi;
