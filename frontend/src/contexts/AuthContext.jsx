import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialUsers } from '../data/mockData';
import { authApi, userApi } from '../services';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ig_current_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [allUsers, setAllUsers] = useState(() => {
    const saved = localStorage.getItem('ig_all_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [loading, setLoading] = useState(true);

  // Re-fetch current user profile from backend on app load if token exists
  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return null;
    }
    try {
      const userData = await authApi.getMe();
      setUser(userData);
      localStorage.setItem('ig_current_user', JSON.stringify(userData));
      return userData;
    } catch (err) {
      console.error('Failed to restore session:', err);
      // If token invalid, clear
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('ig_current_user');
        setUser(null);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch initial suggestions for sidebar
  const loadSuggestions = useCallback(async (limit = 5) => {
    try {
      const suggestions = await userApi.getSuggestions(limit);
      if (suggestions && suggestions.length > 0) {
        setAllUsers(suggestions);
        localStorage.setItem('ig_all_users', JSON.stringify(suggestions));
      }
      return suggestions || [];
    } catch (err) {
      console.warn('Could not load suggestions from backend:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshMe();
    loadSuggestions();
  }, [refreshMe, loadSuggestions]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ig_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ig_current_user');
    }
  }, [user]);

  const extractErrorMessage = (err, defaultMsg) => {
    if (!err) return defaultMsg;
    if (!err.response) {
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !err.status) {
        return '백엔드 서버(FastAPI: 8000 포트)에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      }
      return err.message || '네트워크 연결 상태를 확인해주세요.';
    }
    const data = err.response.data;
    if (!data) return defaultMsg;
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const firstErr = data.detail[0];
      const field = firstErr.loc ? firstErr.loc[firstErr.loc.length - 1] : '';
      const fieldNameMap = {
        username: '사용자 이름',
        email: '이메일',
        password: '비밀번호',
        full_name: '성명'
      };
      const fieldKorean = fieldNameMap[field] || field;
      let msg = firstErr.msg || '입력 형식이 올바르지 않습니다.';
      if (typeof msg === 'string') {
        if (msg.toLowerCase().includes('valid email')) {
          msg = '올바른 이메일 주소 형식을 입력해주세요.';
        } else if (msg.toLowerCase().includes('field required')) {
          msg = '필수 입력 항목입니다.';
        } else if (msg.toLowerCase().includes('at least')) {
          msg = '비밀번호 또는 글자 수 기준을 충족해야 합니다.';
        }
      }
      return `${fieldKorean ? fieldKorean + ': ' : ''}${msg}`;
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
    return defaultMsg;
  };

  const login = async (credentials) => {
    try {
      const res = await authApi.login(credentials);
      if (res.access_token) {
        localStorage.setItem('access_token', res.access_token);
        if (res.refresh_token) {
          localStorage.setItem('refresh_token', res.refresh_token);
        }
      }
      const profile = await authApi.getMe();
      setUser(profile);
      loadSuggestions();
      return { success: true, user: profile };
    } catch (err) {
      console.error('Login error:', err);
      const message = extractErrorMessage(err, '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
      return { success: false, error: message };
    }
  };

  const signup = async (userData) => {
    try {
      const res = await authApi.register(userData);
      if (res.access_token) {
        localStorage.setItem('access_token', res.access_token);
        if (res.refresh_token) {
          localStorage.setItem('refresh_token', res.refresh_token);
        }
      }
      const profile = await authApi.getMe();
      setUser(profile);
      loadSuggestions();
      return { success: true, user: profile };
    } catch (err) {
      console.error('Signup error:', err);
      const message = extractErrorMessage(err, '회원가입에 실패했습니다.');
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('ig_current_user');
    localStorage.removeItem('ig_posts');
    localStorage.removeItem('ig_stories');
    localStorage.removeItem('ig_direct_conversations_v2');
    localStorage.removeItem('ig_direct_conversations_guest');

    // 사용자의 1:1 대화 캐시 완전 초기화 (프라이버시 보호 및 계정 전환 시 격리)
    if (user?.id) {
      localStorage.removeItem(`ig_direct_conversations_${user.id}`);
    }
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ig_direct_conversations_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Silently handle storage iteration errors
    }

    setUser(null);
  };

  const updateProfile = async (updatedFields) => {
    try {
      const updated = await userApi.updateProfile(updatedFields);
      setUser(prev => {
        const next = { ...prev, ...updated };
        localStorage.setItem('ig_current_user', JSON.stringify(next));
        return next;
      });
      return { success: true, user: updated };
    } catch (err) {
      console.error('Update profile error:', err);
      const message = err.response?.data?.detail || '프로필 업데이트에 실패했습니다.';
      return { success: false, error: message };
    }
  };

  const updateAvatar = async (imageUrl) => {
    try {
      const res = await userApi.updateProfileImage(imageUrl);
      const newUrl = res.profile_image_url || res.profileImageUrl || imageUrl;
      setUser(prev => {
        const next = { ...prev, profile_image_url: newUrl, profileImageUrl: newUrl };
        localStorage.setItem('ig_current_user', JSON.stringify(next));
        return next;
      });
      return { success: true, user: res };
    } catch (err) {
      console.warn('updateProfileImage failed, fallback to updateProfile:', err);
      return await updateProfile({ profile_image_url: imageUrl });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        signup,
        logout,
        updateProfile,
        updateAvatar,
        refreshMe,
        allUsers,
        setAllUsers,
        loadSuggestions,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
