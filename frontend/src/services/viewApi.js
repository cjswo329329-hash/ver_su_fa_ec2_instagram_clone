import api from './api';

export const viewApi = {
  recordView: async ({
    postId = null,
    reelId = null,
    durationMs = 3000,
    watchRatio = 0.0,
    completed = false,
    notInterested = false,
    source = 'reels'
  }) => {
    const payload = {
      post_id: postId,
      reel_id: reelId,
      duration_ms: durationMs,
      watch_ratio: watchRatio,
      completed,
      not_interested: notInterested,
      source
    };
    const response = await api.post('/views', payload);
    return response.data;
  },

  getMyViews: async (limit = 50) => {
    const response = await api.get('/views/my', { params: { limit } });
    return response.data;
  }
};

export default viewApi;
