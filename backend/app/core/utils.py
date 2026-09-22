from datetime import datetime, timezone
from typing import Optional

def format_time_ago(dt: Optional[datetime]) -> str:
    """
    주어진 datetime을 현재 시각(UTC)과 비교하여 읽기 쉬운 상대 시간 문자열로 변환합니다.
    예: '방금 전', '5분 전', '3시간 전', '2일 전', '1주 전', '1년 전'
    """
    if not dt:
        return ""
    
    # naive datetime 처리
    now = datetime.utcnow()
    diff = now - dt
    seconds = diff.total_seconds()

    if seconds < 0:
        return "방금 전"
    if seconds < 60:
        return "방금 전"
    minutes = seconds // 60
    if minutes < 60:
        return f"{int(minutes)}분 전"
    hours = minutes // 60
    if hours < 24:
        return f"{int(hours)}시간 전"
    days = hours // 24
    if days < 7:
        return f"{int(days)}일 전"
    weeks = days // 7
    if weeks < 52:
        return f"{int(weeks)}주 전"
    return f"{int(days // 365)}년 전"
