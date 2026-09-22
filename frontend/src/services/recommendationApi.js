import api from './api';

export const recommendationApi = {
  // 현재 로그인 유저의 추천 취향 분석 리포트 조회
  getMyTasteProfile: async () => {
    const response = await api.get('/recommendations/my-taste');
    return response.data;
  },

  // 취향 프로필 캐시 강제 무효화 및 즉시 재계산
  refreshMyTasteProfile: async () => {
    const response = await api.post('/recommendations/refresh-taste');
    return response.data;
  },

  // 개인화 추천 게시물 전용 조회
  getRecommendedPosts: async (limit = 10, cursor = null) => {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const response = await api.get('/recommendations/posts', { params });
    return response.data;
  },
};

export default recommendationApi;
