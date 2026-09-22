import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useProfileForm = (showToast) => {
  const { user, updateProfile, updateAvatar } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gender, setGender] = useState(user?.gender || 'not_specified');
  const [showSuggestions, setShowSuggestions] = useState(() => {
    const saved = localStorage.getItem('ig_show_suggestions');
    return saved !== null ? saved === 'true' : (user?.show_suggestions ?? true);
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.profile_image_url || user?.profileImageUrl || '');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize form state when user changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setWebsite(user.website || '');
      setBio(user.bio || '');
      setGender(user.gender || 'not_specified');
      setAvatarUrl(user.profile_image_url || user.profileImageUrl || '');
      if (user.show_suggestions !== undefined) {
        setShowSuggestions(user.show_suggestions);
        localStorage.setItem('ig_show_suggestions', String(user.show_suggestions));
      }
    }
  }, [user]);

  const handleSuggestionToggle = (val) => {
    setShowSuggestions(val);
    localStorage.setItem('ig_show_suggestions', String(val));
  };

  const handleProfileSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await updateProfile({
        full_name: fullName,
        username,
        website,
        bio,
        gender,
        show_suggestions: showSuggestions,
        profile_image_url: avatarUrl,
      });
      if (res.success) {
        if (showToast) showToast('프로필이 저장되었습니다.');
      } else {
        alert(res.error || '프로필 저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      alert('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarChange = async (newUrl) => {
    try {
      setAvatarUrl(newUrl);
      if (updateAvatar) {
        await updateAvatar(newUrl);
      } else {
        await updateProfile({ profile_image_url: newUrl });
      }
      if (showToast) showToast('프로필 사진이 성공적으로 변경되었습니다.');
    } catch (err) {
      console.error('Failed to change avatar:', err);
      if (showToast) showToast('프로필 사진 변경 중 오류가 발생했습니다.');
    }
  };

  return {
    user,
    fullName,
    setFullName,
    username,
    setUsername,
    website,
    setWebsite,
    bio,
    setBio,
    gender,
    setGender,
    showSuggestions,
    handleSuggestionToggle,
    avatarUrl,
    isAvatarModalOpen,
    setIsAvatarModalOpen,
    isSubmitting,
    handleProfileSubmit,
    handleAvatarChange,
  };
};

export default useProfileForm;
