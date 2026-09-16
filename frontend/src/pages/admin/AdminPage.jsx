import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  FileText, 
  ShieldCheck, 
  ArrowLeft, 
  LogOut, 
  RefreshCw,
  Sun,
  Moon,
  Film,
  AlertOctagon,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../../components/common/Avatar';
import { adminApi } from '../../services';

import { AdminStatsDashboard } from './AdminStatsDashboard';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminPostManagement } from './AdminPostManagement';
import { AdminReelManagement } from './AdminReelManagement';
import { AdminReportManagement } from './AdminReportManagement';
import { AdminAuditLogManagement } from './AdminAuditLogManagement';

export const AdminPage = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 현재 활성화된 탭 (dashboard | users | posts | reels | reports | audit)
  const currentTab = searchParams.get('tab') || 'dashboard';

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const isStatsStaleRef = useRef(false);

  const fetchStats = useCallback(async (options = {}) => {
    const isSilent = options?.silent === true;
    if (!isSilent) {
      setStatsLoading(true);
    }
    try {
      const data = await adminApi.getStats();
      setStats(data);
      isStatsStaleRef.current = false;
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      if (!isSilent) {
        setStatsLoading(false);
      }
    }
  }, []);

  // 통계 대시보드 탭일 때만 최신 데이터 조회 (불필요한 중복 호출 방지)
  useEffect(() => {
    if (currentTab === 'dashboard') {
      if (!stats || isStatsStaleRef.current) {
        fetchStats({ silent: !!stats });
      }
    }
  }, [fetchStats, currentTab, stats]);

  // 자식 컴포넌트에서 이벤트 발생 시 통계 무효화 및 필요 시에만 조용히 갱신
  const handleDataChange = useCallback(() => {
    if (currentTab !== 'dashboard') {
      // 대시보드가 아닐 때는 무거운 통계 API를 즉시 부르지 않고 플래그만 설정
      isStatsStaleRef.current = true;
      return;
    }
    // 대시보드일 때도 로딩 스피너로 화면을 흔들지 않고 조용히 갱신
    fetchStats({ silent: true });
  }, [currentTab, fetchStats]);

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. 상단 관리자 전용 네비게이션 헤더 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 20px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* 좌측 로고 및 어드민 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              className="brand-logo"
              style={{
                fontSize: '24px',
                lineHeight: 1,
                color: 'var(--text-primary)',
              }}
            >
              Instagram
            </span>
            <span
              style={{
                backgroundColor: 'rgba(237, 73, 86, 0.12)',
                color: 'var(--ig-danger)',
                padding: '3px 7px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={13} />
              ADMIN CONSOLE
            </span>
          </div>

          {/* 탭 네비게이션 */}
          <nav
            style={{
              display: 'flex',
              gap: '4px',
              marginLeft: '16px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
            }}
            className="admin-nav-tabs"
          >
            <button
              onClick={() => handleTabChange('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'dashboard' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'dashboard' ? 'var(--ig-primary-button)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'dashboard' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <BarChart3 size={16} />
              <span>통계 대시보드</span>
            </button>

            <button
              onClick={() => handleTabChange('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'users' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'users' ? 'var(--ig-primary-button)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'users' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <Users size={16} />
              <span>회원 관리</span>
            </button>

            <button
              onClick={() => handleTabChange('posts')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'posts' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'posts' ? 'var(--ig-primary-button)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'posts' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <FileText size={16} />
              <span>게시물 관리</span>
            </button>

            <button
              onClick={() => handleTabChange('reels')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'reels' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'reels' ? 'var(--ig-primary-button)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'reels' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <Film size={16} />
              <span>릴스 관리</span>
            </button>

            <button
              onClick={() => handleTabChange('reports')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'reports' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'reports' ? 'var(--ig-danger)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'reports' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <AlertOctagon size={16} />
              <span>신고 관리</span>
            </button>

            <button
              onClick={() => handleTabChange('audit')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: currentTab === 'audit' ? 'var(--border-subtle)' : 'transparent',
                color: currentTab === 'audit' ? 'var(--ig-primary-button)' : 'var(--text-secondary)',
                fontWeight: currentTab === 'audit' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <ClipboardList size={16} />
              <span>감사 로그</span>
            </button>
          </nav>
        </div>

        {/* 우측 관리자 정보 및 액션 버튼들 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {currentTab === 'dashboard' && (
            <button
              onClick={fetchStats}
              title="통계 새로고침"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="hover-bg"
            >
              <RefreshCw size={17} className={statsLoading ? 'spin-icon' : ''} />
            </button>
          )}

          {/* 테마 토글 버튼 */}
          <button
            onClick={toggleTheme}
            title={isDark ? '라이트 모드' : '다크 모드'}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hover-bg"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* 인스타그램 메인으로 이동 */}
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            className="hover-bg"
          >
            <ArrowLeft size={15} />
            <span>앱으로 복귀</span>
          </button>

          {/* 관리자 프로필 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
            }}
          >
            <Avatar src={user?.profile_image_url} size="xs" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.username}
            </span>
          </div>

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            title="로그아웃"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ig-danger)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hover-bg"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main
        style={{
          flex: 1,
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 20px 60px 20px',
          boxSizing: 'border-box',
        }}
      >
        {currentTab === 'dashboard' && (
          <AdminStatsDashboard
            stats={stats}
            loading={statsLoading}
            onRefresh={fetchStats}
          />
        )}

        {currentTab === 'users' && <AdminUserManagement onDataChange={handleDataChange} />}

        {currentTab === 'posts' && <AdminPostManagement onDataChange={handleDataChange} />}

        {currentTab === 'reels' && <AdminReelManagement onDataChange={handleDataChange} />}

        {currentTab === 'reports' && <AdminReportManagement onDataChange={handleDataChange} />}

        {currentTab === 'audit' && <AdminAuditLogManagement />}
      </main>

      <style>{`
        .hover-bg:hover {
          background-color: var(--border-subtle) !important;
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .admin-nav-tabs {
            margin-left: 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminPage;
