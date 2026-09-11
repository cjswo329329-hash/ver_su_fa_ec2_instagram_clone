import api from './api';

export const reelApi = {
  getReels: async (optsOrLimit = 20, legacyCursor = null) => {
    let params;
    if (typeof optsOrLimit === 'object' && optsOrLimit !== null) {
      const { limit = 20, offset = 0, seed = null, cursor = null, exclude_ids = null } = optsOrLimit;
      params = { limit, offset };
      if (seed !== null && seed !== undefined) params.seed = seed;
      if (cursor) params.cursor = cursor;
      if (exclude_ids) params.exclude_ids = exclude_ids;
    } else {
      params = { limit: optsOrLimit };
      if (legacyCursor) params.cursor = legacyCursor;
    }
    const response = await api.get('/reels', { params });
    return response.data;
  },

  getReelDetail: async (reelId) => {
    const response = await api.get(`/reels/${reelId}`);
    return response.data;
  },

  createReel: async (reelData) => {
    const response = await api.post('/reels', reelData);
    return response.data;
  },

  toggleReelLike: async (reelId) => {
    const response = await api.post(`/reels/${reelId}/likes`);
    return response.data;
  },

  toggleReelBookmark: async (reelId) => {
    const response = await api.post(`/reels/${reelId}/bookmarks`);
    return response.data;
  },

  getReelComments: async (reelId) => {
    const response = await api.get(`/reels/${reelId}/comments`);
    return response.data;
  },

  addReelComment: async (reelId, content, parentId = null) => {
    const payload = { content };
    if (parentId) payload.parent_id = parentId;
    const response = await api.post(`/reels/${reelId}/comments`, payload);
    return response.data;
  },

  shareReel: async (reelId) => {
    const response = await api.post(`/reels/${reelId}/share`);
    return response.data;
  },

  repostReel: async (reelId) => {
    const response = await api.post(`/reels/${reelId}/repost`);
    return response.data;
  },
};

export default reelApi;
