import React from 'react';
import { 
  Users, 
  FileText, 
  Film, 
  Heart, 
  MessageCircle, 
  TrendingUp, 
  UserPlus, 
  Award,
  Sparkles
} from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { useNavigate } from 'react-router-dom';

export const AdminStatsDashboard = ({ stats, loading, onRefresh }) => {
  const navigate = useNavigate();

  if (loading || !stats) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        대시보드 통계 데이터를 불러오는 중입니다...
      </div>
    );
  }

  const { summary, user_registration_trend = [], post_creation_trend = [], top_users = [], system_health } = stats;

  // 최대값 계산 (차트 높이 정규화용)
  const maxUserCount = Math.max(...user_registration_trend.map(d => d.count), 5);
  const maxPostCount = Math.max(...post_creation_trend.map(d => d.count), 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. 요약 지표 카드 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* 회원 수 카드 */}
        <div className="admin-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 회원수</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {summary.total_users.toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '4px' }}>명</span>
              </div>
            </div>
            <div className="admin-icon-pill" style={{ backgroundColor: 'rgba(0, 149, 246, 0.12)', color: '#0095f6' }}>
              <Users size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <UserPlus size={14} /> +{summary.new_users_this_week}명
            </span>
            <span>최근 7일 신규 가입</span>
          </div>
        </div>

        {/* 게시물 수 카드 */}
        <div className="admin-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 피드 게시물</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {summary.total_posts.toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '4px' }}>개</span>
              </div>
            </div>
            <div className="admin-icon-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <FileText size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>오늘 신규</span>
            <span>{summary.new_posts_today}개 등록됨</span>
          </div>
        </div>

        {/* 릴스 동영상 수 카드 */}
        <div className="admin-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 릴스 영상</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {summary.total_reels.toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '4px' }}>개</span>
              </div>
            </div>
            <div className="admin-icon-pill" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
              <Film size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ color: '#8b5cf6', fontWeight: 700 }}>비디오 콘텐츠</span>
            <span>숏폼 영상 라이브러리</span>
          </div>
        </div>

        {/* 인터랙션 (좋아요/댓글) 카드 */}
        <div className="admin-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 인터랙션 활동</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {(summary.total_likes + summary.total_comments).toLocaleString()}
                <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '4px' }}>건</span>
              </div>
            </div>
            <div className="admin-icon-pill" style={{ backgroundColor: 'rgba(237, 73, 86, 0.12)', color: '#ed4956' }}>
              <Heart size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Heart size={12} color="#ed4956" /> {summary.total_likes.toLocaleString()}
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <MessageCircle size={12} color="#0095f6" /> {summary.total_comments.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 인터랙티브 트렌드 차트 섹션 (최근 14일) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
        }}
      >
        {/* 회원 가입 추이 차트 */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#0095f6" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                최근 14일 신규 회원 가입 추이
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>일별 등록수</span>
          </div>

          <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '24px', position: 'relative' }}>
            {user_registration_trend.map((item, idx) => {
              const heightPercent = Math.max(8, (item.count / maxUserCount) * 100);
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    position: 'relative',
                  }}
                  className="chart-bar-container"
                >
                  {/* Tooltip on hover */}
                  <div className="chart-tooltip">
                    {item.date}: {item.count}명
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '24px',
                      height: `${heightPercent}%`,
                      backgroundColor: item.count > 0 ? '#0095f6' : 'var(--border-subtle)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background-color 0.2s ease',
                      position: 'relative',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 게시물 등록 추이 차트 */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#10b981" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                최근 14일 게시물 작성 추이
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>일별 등록수</span>
          </div>

          <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '24px', position: 'relative' }}>
            {post_creation_trend.map((item, idx) => {
              const heightPercent = Math.max(8, (item.count / maxPostCount) * 100);
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    position: 'relative',
                  }}
                  className="chart-bar-container"
                >
                  <div className="chart-tooltip">
                    {item.date}: {item.count}개
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '24px',
                      height: `${heightPercent}%`,
                      backgroundColor: item.count > 0 ? '#10b981' : 'var(--border-subtle)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease, background-color 0.2s ease',
                      position: 'relative',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. 우수 활동 크리에이터 & 콘텐츠 통계 비율 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {/* 상위 활동 크리에이터 Top 5 */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award size={18} color="#f59e0b" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              가장 활동적인 회원 TOP 5
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {top_users.map((user, idx) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: idx === 0 ? '#f59e0b' : (idx === 1 ? '#94a3b8' : (idx === 2 ? '#b45309' : 'var(--border-color)')),
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <Avatar src={user.profile_image_url} size="sm" />
                  <div>
                    <div
                      onClick={() => navigate(`/${user.username}`)}
                      style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      {user.username}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {user.full_name || 'Instagram User'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0095f6' }}>
                    게시물 {user.posts_count}개
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    팔로워 {user.followers_count}명
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 서비스 콘텐츠 구성 및 플랫폼 상태 */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Sparkles size={18} color="#ec4899" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              콘텐츠 구성 비중 및 건전도
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>피드 게시물 비중</span>
                <span style={{ color: 'var(--text-secondary)' }}>{summary.total_posts}건</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (summary.total_posts / Math.max(1, summary.total_posts + summary.total_reels)) * 100)}%`,
                    height: '100%',
                    backgroundColor: '#0095f6',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>릴스 숏폼 비중</span>
                <span style={{ color: 'var(--text-secondary)' }}>{summary.total_reels}건</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (summary.total_reels / Math.max(1, summary.total_posts + summary.total_reels)) * 100)}%`,
                    height: '100%',
                    backgroundColor: '#8b5cf6',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>인터랙션 활성도 (좋아요 대비 댓글 비율)</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {summary.total_likes > 0 ? ((summary.total_comments / summary.total_likes) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (summary.total_comments / Math.max(1, summary.total_likes)) * 100)}%`,
                    height: '100%',
                    backgroundColor: '#ec4899',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '14px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  {system_health?.status || '시스템 가동 정상'}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {system_health?.server_time || ''}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                엔진: <strong>{system_health?.db_type || 'FastAPI 백엔드'}</strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                연결 데이터베이스: {system_health?.active_database || '클라우드 DB'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-stat-card {
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .admin-card {
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .admin-icon-pill {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chart-bar-container:hover .chart-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateY(-4px);
        }
        .chart-tooltip {
          position: absolute;
          top: -28px;
          background-color: var(--text-primary);
          color: var(--bg-primary);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 10;
        }
      `}</style>
    </div>
  );
};

export default AdminStatsDashboard;
