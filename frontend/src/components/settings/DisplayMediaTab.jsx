import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ToggleSwitch } from './ToggleSwitch';

export const DisplayMediaTab = ({ showToast }) => {
  const { isDark, toggleTheme } = useTheme();

  const [highQualityUpload, setHighQualityUpload] = useState(() => {
    const saved = localStorage.getItem('ig_high_quality_upload');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoplayVideos, setAutoplayVideos] = useState(() => {
    const saved = localStorage.getItem('ig_autoplay_videos');
    return saved !== null ? saved === 'true' : true;
  });

  const handleHighQualityToggle = (val) => {
    setHighQualityUpload(val);
    localStorage.setItem('ig_high_quality_upload', String(val));
    if (showToast) {
      showToast(val ? '고화질 업로드가 설정되었습니다.' : '일반 화질 업로드가 설정되었습니다.');
    }
  };

  const handleAutoplayToggle = (val) => {
    setAutoplayVideos(val);
    localStorage.setItem('ig_autoplay_videos', String(val));
    if (showToast) {
      showToast(val ? '동영상 자동 재생이 켜졌습니다.' : '동영상 자동 재생이 꺼졌습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '28px' }}>
        디스플레이 및 미디어
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ paddingBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>화면 모드 테마</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div
              onClick={() => {
                if (isDark) toggleTheme();
              }}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: !isDark ? '2px solid var(--ig-primary-button)' : '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                color: '#262626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Sun size={24} color="#f59e0b" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>라이트 모드</div>
                <div style={{ fontSize: '12px', color: '#737373' }}>밝고 선명한 테마</div>
              </div>
            </div>

            <div
              onClick={() => {
                if (!isDark) toggleTheme();
              }}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: isDark ? '2px solid var(--ig-primary-button)' : '1px solid var(--border-color)',
                backgroundColor: '#121212',
                color: '#f5f5f5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Moon size={24} color="#3b82f6" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>다크 모드</div>
                <div style={{ fontSize: '12px', color: '#a8a8a8' }}>눈이 편안한 테마</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>항상 최고 화질로 업로드</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              네트워크 연결이 느려도 고화질 미디어를 업로드합니다.
            </div>
          </div>
          <ToggleSwitch
            checked={highQualityUpload}
            onChange={handleHighQualityToggle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>동영상 자동 재생</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              피드 및 릴스에서 동영상을 자동으로 재생합니다.
            </div>
          </div>
          <ToggleSwitch
            checked={autoplayVideos}
            onChange={handleAutoplayToggle}
          />
        </div>
      </div>
    </div>
  );
};

export default DisplayMediaTab;
