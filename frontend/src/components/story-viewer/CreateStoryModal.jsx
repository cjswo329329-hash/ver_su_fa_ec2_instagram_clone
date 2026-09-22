import React, { useState, useRef } from 'react';
import { X, ArrowLeft, Film, Loader2, Sparkles, Plus } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { uploadApi, storyApi } from '../../services';
import { Avatar } from '../common/Avatar';

export const CreateStoryModal = () => {
  const { isCreateStoryOpen, closeCreateStory, fetchStories } = useModal();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image' | 'video'
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // High quality portrait sample stories for instant testing
  const sampleStories = [
    {
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80',
      type: 'image',
      label: '포트레이트 1'
    },
    {
      url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&auto=format&fit=crop&q=80',
      type: 'image',
      label: '포트레이트 2'
    },
    {
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&auto=format&fit=crop&q=80',
      type: 'image',
      label: '풍경 1'
    },
    {
      url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
      type: 'video',
      label: '비디오(바다)'
    }
  ];

  if (!isCreateStoryOpen) return null;

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setMediaType('image');
    setIsUploading(false);
    setError(null);
  };

  const handleClose = () => {
    if (isUploading) return;
    resetState();
    closeCreateStory();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(url);
    setMediaType(isVideo ? 'video' : 'image');
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(url);
    setMediaType(isVideo ? 'video' : 'image');
    setError(null);
  };

  const handleSelectSample = (sample) => {
    setSelectedFile(null);
    setPreviewUrl(sample.url);
    setMediaType(sample.type);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!previewUrl) return;

    try {
      setIsUploading(true);
      setError(null);

      let finalMediaUrl = previewUrl;

      // If real file selected, upload via media upload service
      if (selectedFile) {
        const uploadRes = await uploadApi.uploadMedia(selectedFile, 'stories');
        if (uploadRes && uploadRes.url) {
          finalMediaUrl = uploadRes.url;
        }
      }

      // Create story via backend API
      await storyApi.createStory(finalMediaUrl, mediaType);

      // Refresh stories tray in feed
      await fetchStories();

      handleClose();
    } catch (err) {
      console.error('Failed to post story:', err);
      const msg = err.response?.data?.detail || err.message || '스토리 등록 중 오류가 발생했습니다.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleClose}
    >
      {/* Modal Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '90vh',
          backgroundColor: '#262626',
          color: '#ffffff',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            height: '52px',
            borderBottom: '1px solid #363636',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            position: 'relative',
          }}
        >
          {previewUrl ? (
            <button
              onClick={() => {
                if (isUploading) return;
                setPreviewUrl('');
                setSelectedFile(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px',
              }}
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={{ width: '32px' }} />
          )}

          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, textAlign: 'center' }}>
            {previewUrl ? '스토리 미리보기' : '새 스토리 만들기'}
          </h2>

          <button
            onClick={handleClose}
            disabled={isUploading}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              padding: '6px',
              opacity: isUploading ? 0.5 : 1,
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            alignItems: 'center',
            justifyContent: previewUrl ? 'flex-start' : 'center',
            padding: previewUrl ? '16px' : '32px 24px',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {!previewUrl ? (
            /* Upload / Drop Step */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 8px 20px rgba(220, 39, 67, 0.3)',
                }}
              >
                <Sparkles size={38} color="#ffffff" />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                24시간 동안 공유할 스토리
              </h3>
              <p style={{ fontSize: '13px', color: '#a8a8a8', marginBottom: '24px', lineHeight: 1.4 }}>
                사진이나 동영상을 업로드하여 팔로워와 일상을 생생하게 나눠보세요.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  backgroundColor: '#0095f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease',
                  marginBottom: '24px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1877f2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0095f6')}
              >
                <Plus size={18} />
                기기에서 미디어 선택
              </button>

              {/* Sample Story Choices */}
              <div
                style={{
                  width: '100%',
                  borderTop: '1px solid #363636',
                  paddingTop: '20px',
                  marginTop: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: '#8e8e8e',
                    display: 'block',
                    marginBottom: '12px',
                    fontWeight: 500,
                  }}
                >
                  또는 샘플 스토리 바로 올리기:
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  {sampleStories.map((sample, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSample(sample)}
                      style={{
                        position: 'relative',
                        width: '64px',
                        height: '96px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid transparent',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.borderColor = '#0095f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      {sample.type === 'video' ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#121212',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Film size={22} color="#ffffff" />
                        </div>
                      ) : (
                        <img
                          src={sample.url}
                          alt={sample.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '2px',
                          background: 'rgba(0,0,0,0.6)',
                          fontSize: '10px',
                          textAlign: 'center',
                        }}
                      >
                        {sample.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Preview Step (9:16 vertical ratio) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '280px',
                  aspectRatio: '9 / 16',
                  backgroundColor: '#000000',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {/* Header overlay on preview */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 2,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  <Avatar
                    src={user?.profile_image_url}
                    size="xs"
                    alt={user?.username || 'user'}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    {user?.username || '내 스토리'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>방금</span>
                </div>

                {mediaType === 'video' ? (
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="스토리 미리보기"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              {error && (
                <div
                  style={{
                    marginTop: '12px',
                    color: '#ed4956',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(237, 73, 86, 0.1)',
                    borderRadius: '6px',
                    width: '100%',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions when preview is active */}
        {previewUrl && (
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #363636',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1f1f1f',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar
                src={user?.profile_image_url}
                size="sm"
                alt={user?.username || 'user'}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>내 스토리</span>
                <span style={{ fontSize: '11px', color: '#a8a8a8' }}>모든 팔로워에게 공개</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isUploading}
              style={{
                backgroundColor: '#0095f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isUploading ? 0.7 : 1,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  공유 중...
                </>
              ) : (
                '공유'
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .spin-animate {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
