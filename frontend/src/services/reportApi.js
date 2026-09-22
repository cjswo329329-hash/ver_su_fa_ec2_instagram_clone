import api from './api';

export const reportApi = {
  // 일반 사용자 신고 등록
  createReport: async ({ targetType, targetId, reason, details = null }) => {
    const res = await api.post('/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
    });
    return res.data;
  },

  // 관리자 신고 목록 조회
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

  // 관리자 신고 처리/해결
  resolveReport: async (reportId, { status = 'resolved', action = 'none', resolutionNotes = '' } = {}) => {
    const res = await api.post(`/admin/reports/${reportId}/resolve`, {
      status,
      action,
      resolution_notes: resolutionNotes,
    });
    return res.data;
  },
};

export default reportApi;
