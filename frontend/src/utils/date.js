/**
 * 날짜 및 시간 관련 공통 유틸리티 (DRY 원칙 적용)
 */

/**
 * 주어진 날짜(ISO 문자열, Date 객체, timestamp)를 상대 시간 문자열로 변환합니다.
 * 예: '방금 전', '10분 전', '2시간 전', '3일 전', '1주 전', '1년 전'
 * @param {string | Date | number} dateInput
 * @returns {string}
 */
export function formatTimeAgo(dateInput) {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 0 || diffSeconds < 60) {
    return '방금 전';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 52) {
    return `${diffWeeks}주 전`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}년 전`;
}

/**
 * 날짜를 'YYYY년 M월 D일' 형식으로 포맷팅합니다.
 * @param {string | Date} dateInput
 * @returns {string}
 */
export function formatFullDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}년 ${month}월 ${day}일`;
}
