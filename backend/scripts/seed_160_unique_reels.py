import os
import sys
import random
from datetime import datetime, timedelta

# backend 디렉토리 경로 추가
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(_BACKEND_DIR)
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.user import User
from app.models.reel import Reel
from app.models.comment import Comment
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.models.content_view import ContentView

# 16대 카테고리
CATEGORIES = [
    "fitness", "tech", "finance", "knowledge_daily",
    "travel", "cafe", "food", "fashion",
    "beauty", "interior", "pets", "art",
    "music", "dance", "gaming", "comedy"
]

# 16개 카테고리별 10종씩의 고화질 세로형 썸네일 포스터 이미지 (총 160종 고유 이미지)
CATEGORY_POSTERS = {
    "fitness": [
        "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800&auto=format&fit=crop&q=80"
    ],
    "tech": [
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80"
    ],
    "finance": [
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1607863680198-23d4b2565df0?w=800&auto=format&fit=crop&q=80"
    ],
    "knowledge_daily": [
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80"
    ],
    "travel": [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&auto=format&fit=crop&q=80"
    ],
    "cafe": [
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=800&auto=format&fit=crop&q=80"
    ],
    "food": [
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&auto=format&fit=crop&q=80"
    ],
    "fashion": [
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop&q=80"
    ],
    "beauty": [
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1500840216050-6ffa99d75160?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522337094344-66150a42ea74?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515688594390-b649af70d282?w=800&auto=format&fit=crop&q=80"
    ],
    "interior": [
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&auto=format&fit=crop&q=80"
    ],
    "pets": [
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&auto=format&fit=crop&q=80"
    ],
    "art": [
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1569172122301-bc500f30913c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1578925518470-4def7a0f08bb?w=800&auto=format&fit=crop&q=80"
    ],
    "music": [
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1445985543468-79082488f74b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1520523839898-507127053c37?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800&auto=format&fit=crop&q=80"
    ],
    "dance": [
        "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1545231027-637d2f6210f8?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80"
    ],
    "gaming": [
        "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1612287233202-0a1586a11700?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1552824796-03f169db85e4?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=800&auto=format&fit=crop&q=80"
    ],
    "comedy": [
        "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498036882173-b41c28a82b80?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80"
    ]
}

# 160종 맞춤 오디오 타이틀
CATEGORY_AUDIOS = {
    "fitness": ["Iron Beats - Heavy Lift", "Gym Motivation - No Pain No Gain", "HIIT Sprint - 180BPM", "Deadlift Power - Dark Techno", "Cardio Zone - Peak Heartrate", "Bodyweight Flow - Deep Focus", "Crossfit Heat - Final Round", "Recovery Stretch - Ambient Synth", "Pre-workout Rush - Bass Drop", "Warrior Spirit - Epic Workout"],
    "tech": ["Lo-Fi Beats - Late Night Coding", "Cyberpunk 2077 - Synth Wave", "Clean Code - Minimal Ambient", "AI Era - Neural Pulse", "Keyboard ASMR - Mechanical Click", "Dev Studio - Focus Chill", "Silicon Valley - Tech Groove", "Git Push - Flow State", "Terminal Echo - Digital Rain", "Quantum Computing - Future Sound"],
    "finance": ["Wealth Daily - Market Opening", "Compound Interest - Jazz Piano", "Wall Street - Morning Bell", "Passive Income - Smooth Chill", "ETF Strategy - Steady Growth", "Bull Market - High Energy", "Real Estate Insight - Deep Talk", "Financial Freedom - Sunset Lo-Fi", "Crypto Pulse - Block Beats", "Smart Money - Business Class"],
    "knowledge_daily": ["5AM Club - Morning Clarity", "Deep Focus - Alpha Waves 432Hz", "Atomic Habits - Gentle Piano", "Mindset Shift - Inspiring Strings", "Pomodoro Flow - Coffee Shop Ambience", "Book Lover - Turning Pages", "Stoic Meditation - Calm Breath", "Daily 1% - Ambient Sunrise", "Brain Power - Theta Waves", "Self Growth - Hopeful Melody"],
    "travel": ["Jeju Island - Wind & Waves", "Kyoto Walk - Temple Bells", "Parisian Sunset - Cafe Accordion", "Bali Vibes - Tropical House", "Swiss Alps - Chilling Breeze", "New York Mood - City Subway", "Bangkok Night - Street Food Buzz", "Hokkaido Snow - Silence & Soft Snow", "Rome Vespa - Sunny Holiday", "Wanderlust - Acoustic Voyage"],
    "cafe": ["Drip Coffee - Water Drop ASMR", "Morning Espresso - Parisian Jazz", "Bakery Fresh - Warm Croissant", "Matcha Latte - Cozy Afternoon", "Vintage LP - Vinyl Crackle", "Rainy Cafe - Window Drops", "Barista Art - Milk Pouring", "Sweet Tiramisu - Bossa Nova", "Sunny Rooftop - Summer Blend", "Book & Coffee - Soft Lo-Fi"],
    "food": ["Sizzle Steak - Hot Pan Sound", "Crispy Pork Belly - Crunch ASMR", "Pasta Alfredo - Creamy Stir", "Tteokbokki - Spicy Boiling", "Fried Chicken - Ultra Crisp", "Sushi Master - Knife Precision", "Cheesy Pizza - Long Stretch", "Kimchi Stew - Bubbling Pot", "Handmade Burger - Juicy Grill", "Sweet Dessert - Sugar Glaze"],
    "fashion": ["Runway Mode - Vogue Bass", "OOTD Check - Trendy Trap", "Streetwear Tokyo - Hip-Hop Beat", "Quiet Luxury - Sophisticated Jazz", "Autumn Palette - Mellow Groove", "Denim Jacket - Vintage Mood", "Sneakerhead - 808 Kick", "Monochrome Chic - Minimal Beat", "Summer Linen - Breeze House", "Y2K Fashion - Nostalgia Pop"],
    "beauty": ["Glass Skin - Sparkle Water", "Quick Glow - Dewy Morning", "Lip Gloss - Juicy Pops", "Eyeliner Precision - Chillout", "Skincare Routine - Gentle Mist", "Color Match - Aesthetic Chimes", "Lash Lift - Flutter Sound", "Night Serum - Relaxing Spa", "Sunscreen Glow - Summer Shine", "Velvet Texture - Soft Whisper"],
    "interior": ["Desk Setup - Minimalist Clean", "Warm Living Room - Fireplace ASMR", "Plant Lover - Nature Green", "Ambient Lights - Cozy Evening", "Room Tour - Dreamy Lo-Fi", "Wood Texture - Organic Modern", "Kitchen Organization - Neat Click", "Bedtime Sanctuary - White Noise", "Nordic Mood - Calm Acoustic", "Studio Apartment - Smart Space"],
    "pets": ["Golden Retriever - Happy Tail Wag", "Cat Purr - 100% Pure Healing", "Puppy Steps - Paws On Hardwood", "Catnip Party - Playful Jump", "Forest Dog Walk - Bird Chasing", "Sleepy Kitten - Tiny Meow", "Hamster Wheel - Speedy Wheels", "Curious Dog - Head Tilt", "Bath Time Corgi - Splashy Splash", "Fluffy Cloud - Gentle Cuddle"],
    "art": ["Oil Painting - Palette Knife Scratch", "Watercolor Bloom - Wet Paper", "Urban Sketch - Rapid Pencil", "3D Modeling - Digital Canvas", "Pottery Wheel - Clay Spin ASMR", "Acrylic Pour - Fluid Dynamics", "Calligraphy - Black Ink Stroke", "Glass Blowing - Glowing Fire", "Modern Gallery - Echo Footsteps", "Color Theory - Vibrant Melody"],
    "music": ["Acoustic Busking - River Sunset", "Jazz Improvisation - Late Night Bar", "Rainy Lo-Fi - Soft Rhodes", "Drum Solo - Funk Breakbeat", "Cello Emotional - Deep Strings", "Fingerstyle Guitar - Melodic Harmonics", "Analog Synth - Moog Bass", "Soulful Vocals - Warm Harmony", "Electric Solo - Rock Anthem", "Vinyl Record - Retro Warmth"],
    "dance": ["TikTok Challenge - Viral Hook", "Hip Hop Cypher - Heavy 808", "Popping Lock - Sharp Stop", "Contemporary Flow - Gentle Movement", "K-POP Relay - Dance Energy", "House Dance - Fast Footwork", "Studio Choreo - Master Class", "Urban Street - Beat Kill", "Breaking Spin - Floor Work", "Waacking Rhythm - Disco Fever"],
    "gaming": ["Epic Clutch - 1v4 Deagle", "Final Circle - Victory Royale", "League Pentakill - Team Ace", "Boss Fight - Intense Orchestral", "Retro Arcade - 8-bit Nostalgia", "Speedrun Pace - Clock Ticking", "Palworld Base - Cute Farming", "TFT 3-Star - Golden Light", "Souls Dodge - Critical Strike", "Game Night - Hype Screams"],
    "comedy": ["Awkward Silence - Cricket Sound", "Expectation vs Reality - Funky Trombone", "Introvert Survival - Internal Scream", "Monday Morning - Dramatic Soap Opera", "Friend Betrayal - Laugh Track", "Diet Fail - Sad Violin", "Retail Worker Pain - Sarcastic Clap", "Dumb Decisions - Cartoony Boing", "Overthinking At 3AM - Chaos Beat", "Office Gossip - Whispering Crowd"]
}

# 160종 상세 한국어 캡션
CATEGORY_CAPTIONS = {
    "fitness": [
        "오늘도 오운완! 득근을 위한 데드리프트 140kg 성공했습니다 🔥 포기하지 않는 자가 승리한다. #오운완 #헬스타그램 #데드리프트 #피트니스",
        "3분 만에 전신 땀 범벅되는 홈트 복근 루틴! 지금 저장하고 따라해보세요 💦 #홈트 #복근운동 #다이어트 #운동루틴",
        "스쿼트 자세가 자꾸 흔들린다면? 골반 힌지 잡는 3가지 꿀팁 공유합니다! 🏋️‍♂️ #스쿼트 #하체운동 #운동팁",
        "새벽 6시 러닝 10km 완주. 차가운 아침 공기를 가를 때 느끼는 러너스 하이 🏃‍♂️✨ #모닝러닝 #마라톤 #유산소",
        "필라테스로 코어 속근육 바로잡기. 틀어진 골반 교정에 진짜 효과 만점입니다 🧘‍♀️ #필라테스 #체형교정 #코어운동",
        "턱걸이 0개에서 10개까지 늘린 루틴 대공개! 네거티브 풀업이 핵심입니다 💪 #풀업 #턱걸이 #등운동 #홈짐",
        "운동 전후 폼롤러 스트레칭 5분 루틴. 다음날 근육통이 확실히 줄어들어요 🧘 #스트레칭 #폼롤러 #운동회복",
        "크로스핏 WOD 1위 찍었습니다! 심장 터질 것 같지만 이 맛에 크로스핏 하죠 ⚡️ #크로스핏 #WOD #고강도운동",
        "D-7 바디프로필 식단과 마지막 수분조절 팁! 노력은 배신하지 않는다 📸 #바디프로필 #식단관리 #다이어터",
        "헬스장 정체기 극복하는 드롭세트 훈련법! 근육에 극한의 자극을 줘보세요 💥 #드롭세트 #보디빌딩 #자극극대화"
    ],
    "tech": [
        "파이썬 비동기 FastAPI 백엔드 초당 5,000건 처리 최적화 완료! 아키텍처 다이어그램 공개합니다 💻 #파이썬 #FastAPI #백엔드 #개발자",
        "AI 챗봇 서비스 1인 개발 완성! Vercel + Supabase + LLM 연동 꿀팁 공유 🚀 #AI개발 #풀스택 #사이드프로젝트 #바이브코딩",
        "개발자 데스크셋업 2026! 49인치 모니터와 기계식 키보드의 완벽한 조화 ✨ #데스크셋업 #개발자환경 #맥북프로 #룸투어",
        "신입 개발자가 꼭 알아야 할 Git 되돌리기 명령어 3가지 (reset, revert, stash) 🐙 #깃허브 #코딩팁 #신입개발자",
        "리액트 렌더링 2배 빠르게 만드는 useMemo와 useCallback 실전 사용법 ⚛️ #리액트 #프론트엔드 #웹개발 #성능최적화",
        "클라우드 AWS 비용 60% 절감한 실제 마이크로서비스 리팩토링 후기 ☁️ #AWS #클라우드 #DevOps #비용절감",
        "깃허브 잔디 365일 올그린 달성! 매일 1커밋이 가져다준 커리어의 변화 🌿 #1일1커밋 #성장기록 #개발공부",
        "Next.js vs Vite 2026년 기준 프로젝트별 선택 가이드 총정리 🛠️ #Nextjs #Vite #프레임워크비교",
        "도커(Docker) 컨테이너 가상화 10분 만에 마스터하기 🐳 #도커 #DevOps #서버구축",
        "개발자 번아웃을 이겨내는 5가지 일상 루틴 (멘탈 관리법) ☕️ #개발자일상 #번아웃극복 #자기관리"
    ],
    "finance": [
        "사회초년생 월 100만원 ETF 적립식 투자로 10년 뒤 2억 만드는 복리 계산법 📈 #재테크 #미국ETF #적립식투자 #복리",
        "청약 가점 낮아도 당첨 확률 3배 올리는 특별공급 전략 총정리 🏢 #청약통장 #내집마련 #부동산기초",
        "매달 배당금 50만원 받는 미국 고배당 포트폴리오 3선 💵 #미국주식 #배당주투자 #파이어족 #월배당",
        "월급 들어오자마자 4개로 쪼개는 통장 쪼개기 시스템 구축법 💳 #통장쪼개기 #월급관리 #종잣돈모으기",
        "재무제표에서 딱 '이 3가지'만 보면 망하는 주식 90% 거릅니다 📊 #재무제표 #주식공부 #가치투자",
        "금리 인하기에 반드시 담아야 할 유망 자산군 비교 분석 📉 #금리인하 #경제전망 #자산배분",
        "연말정산 13월의 월급 120만원 환급받은 IRP/연금저축 절세 전략 🧾 #연말정산 #절세팁 #연금저축펀드",
        "워렌 버핏이 강조한 '돈을 잃지 않는 제1원칙'과 마인드셋 🧠 #워렌버핏 #투자철학 #부자의법칙",
        "2030 파이어족 5년 만에 순자산 5억 달성한 가계부 피드백 📝 #파이어족 #가계부 #절약습관",
        "비상금 통장 CMA vs 파킹통장 금리 비교 및 추천 💰 #파킹통장 #CMA #단기자금"
    ],
    "knowledge_daily": [
        "새벽 5시에 일어나는 미라클 모닝이 인생을 바꾸는 3가지 과학적 이유 ⏰ #미라클모닝 #새벽기상 #자기계발",
        "하루 10페이지 독서로 1년에 20권 완독하는 뇌 자극 독서법 📚 #독서습관 #책추천 #성장루틴",
        "집중력 2배 올려주는 25분 몰입 뽀모도로 테크닉의 정석 🍅 #시간관리 #집중력 #뽀모도로",
        "물건을 비우면 마음에 생기는 여유, 7일 미니멀리즘 챌린지 🌿 #미니멀라이프 #정리정돈 #비우기",
        "퇴근 후 3줄 감정 일기 쓰기. 스트레스가 싹 풀리는 멘탈 디톡스 ✍️ #감정일기 #마음챙김 #자존감",
        "매일 1%씩 좋아지면 1년 뒤 37배 성장합니다. 복리의 힘을 인생에 적용하세요 🚀 #아주작은습관의힘 #동기부여",
        "말투 하나로 호감도를 10배 올리는 대화의 심리학 💬 #인간관계 #대화법 #심리학",
        "수면의 질을 수직 상승시키는 잠들기 30분 전 스마트폰 끄기 루틴 🌙 #꿀잠 #수면관리 #건강루틴",
        "작심삼일을 깨부수는 '습관 루틴 형성 66일 법칙' 🎯 #습관만들기 #목표달성 #의지력",
        "남과 비교하지 않고 나만의 속도로 묵묵히 걷는 단단한 멘탈 만들기 🧘‍♂️ #자존감높이기 #마인드컨트롤"
    ],
    "travel": [
        "제주 협재 바다의 에메랄드빛 파도 소리 🌊 파도 소리 듣고 힐링하고 가세요 #제주여행 #협재해수욕장 #파도소리",
        "비 내리는 교토 아라시야마 대나무숲 산책길 🎋 마음이 고요해지는 순간 #교토여행 #대나무숲 #일본여행",
        "파리 에펠탑 화이트 에펠 불빛 켜지는 순간의 낭만 🇫🇷✨ #파리여행 #에펠탑 #유럽여행",
        "발리 우붓의 싱그러운 라이스 테라스 뷰 🌴 숨만 쉬어도 행복한 곳 #발리여행 #우붓 #휴양지",
        "스위스 융프라우 산악기차 타고 만난 동화 같은 설산 풍경 🏔️ #스위스여행 #융프라우 #알프스",
        "방콕 야시장의 열기와 맛있는 길거리 음식들 🇹🇭🍢 #방콕여행 #야시장 #동남아여행",
        "뉴욕 타임스퀘어 한복판의 화려한 네온사인과 도시의 열정 🗽 #뉴욕여행 #타임스퀘어 #도시풍경",
        "다낭 미케비치 아침 일출을 바라보며 마시는 코코넛 커피 ☕️🌅 #다낭여행 #일출명소 #베트남",
        "눈꽃 흩날리는 홋카이도 비에이 크리스마스 트리 설경 ❄️🌲 #홋카이도 #비에이 #겨울여행",
        "로마 콜로세움 석양 무렵 돌담길 걷기 🏛️ 역사가 숨쉬는 거리 #로마여행 #콜로세움 #이탈리아"
    ],
    "cafe": [
        "성수동 붉은 벽돌 골목 숨은 드립커피 맛집 ☕️ 산미와 단맛의 밸런스가 예술 #성수카페 #핸드드립 #스페셜티커피",
        "연남동 오픈런 필수 갓 구운 크루아상과 바닐라빈 라떼 🥐✨ #연남동카페 #베이커리카페 #크루아상",
        "이탈리아 감성 에스프레소 바에서 즐기는 원샷의 미학 ☕️ #에스프레소바 #카카오에스프레소 #커피투어",
        "정성을 담아 한 방울씩 내리는 핸드드립 커피 브루잉 ASMR 💧 #핸드드립 #브루잉 #커피ASMR",
        "부드러운 우유 거품 위에 피어난 백조 라떼 아트 🦢 #라떼아트 #바리스타 #플랫화이트",
        "제주 바다와 검은 돌담이 한눈에 보이는 통창 오션뷰 카페 🌊 #제주카페 #오션뷰카페 #감성카페",
        "턴테이블에서 재즈가 흘러나오는 비 오는 날의 북카페 📖🎶 #북카페 #LP카페 #재즈음악",
        "에스프레소 시럽에 푹 적신 정통 마스카포네 티라미수 한입 🍰 #티라미수 #디저트맛집 #달콤한하루",
        "노을 지는 루프탑에서 즐기는 시원한 아이스 아메리카노 🌅 #루프탑카페 #노을명소 #아아",
        "초록 식물이 가득한 도심 속 식물원 플랜테리어 온실 카페 🌿 #식물원카페 #플랜테리어 #힐링스팟"
    ],
    "food": [
        "지글지글 한우 투뿔 안심 스테이크 굽는 소리 ASMR 🥩 육즙 폭발 #한우맛집 #스테이크 #고기먹방",
        "겉바속촉 수제 탕수육과 달콤한 과일 소스 부먹파 손드세요 🥢 #중식맛집 #탕수육 #바삭바삭",
        "학창시절 추억의 매콤달콤 학교앞 떡볶이와 수제 김말이 튀김 떡볶이는 사랑 ❤️ #떡볶이 #분식맛집 #kfood",
        "솥뚜껑에 노릇노릇 구워먹는 두툼한 삼겹살과 묵은지 조합 🥓🥬 #삼겹살 #솥뚜껑삼겹살 #고기굽기",
        "생트러플 아낌없이 갈아넣은 꾸덕한 트러플 크림 파스타 🍝 #파스타맛집 #트러플파스타 #홈쿠킹",
        "비 오는 날엔 바삭하게 부쳐낸 해물 김치전 한 장 🌧️🥞 #김치전 #부침개 #비오는날메뉴",
        "육즙 가득 수제 패티와 흘러내리는 멜팅 치즈버거의 위엄 🍔🧀 #수제버거 #치즈버거 #버거맛집",
        "뚝배기에서 보글보글 끓어오르는 얼큰 해물 순두부찌개 🍲 #순두부찌개 #집밥스타그램 #한식",
        "두툼하게 썰어낸 숙성 대연어 사시미의 황홀한 마블링 🍣 #연어사시미 #일식 #회스타그램",
        "오븐에서 갓 구워낸 나폴리 화덕피자의 쫄깃한 도우와 치즈 🍕 #화덕피자 #피자맛집 #이탈리안푸드"
    ],
    "fashion": [
        "가을 웜톤 미니멀 출근룩 코디! 깔끔한 슬랙스와 니트 조합 🧥 #출근룩 #오피스룩 #가을코디 #미니멀룩",
        "성수동 팝업스토어 갈 때 입기 좋은 스트릿 무드 캐주얼 스타일링 👟 #스트릿패션 #성수룩 #OOTD",
        "실패 없는 올블랙 시크 데일리룩 코디 팁 🖤 디테일로 살리는 핏 #올블랙 #시크룩 #데일리패션",
        "오버핏 블레이저 하나로 포멀과 캐주얼 넘나드는 스타일링 👔 #블레이저코디 #자켓스타일링 #패션팁",
        "클래식한 베이지 트렌치코트로 완성하는 가을 감성 무드 🍂 #트렌치코트 #클래식룩 #가을패션",
        "편안하면서도 단정한 2030 비즈니스 캐주얼 셋업 추천 👞 #비즈니스캐주얼 #셋업코디 #직장인룩",
        "다리가 5cm 길어 보이는 하이웨이스트 와이드 슬랙스 핏 👖 #와이드팬츠 #체형보정 #바지핏",
        "빈티지 레더 자켓으로 무드 한 스푼 얹은 바이커 코디 🏍️ #레더자켓 #가죽자켓 #빈티지패션",
        "주말 원마일웨어 편안한 스웻셋업과 볼캡 매치 🧢 #원마일웨어 #스웻팬츠 #꾸안꾸",
        "톤온톤 캐시미어 니트 레이어드로 따뜻하고 고급스러운 연출 🧶 #니트코디 #캐시미어 #톤온톤"
    ],
    "beauty": [
        "유리알 광택 탕후루 립 메이크업 꿀팁! 플럼핑 효과까지 💄✨ #탕후루립 #립메이크업 #유리알광택",
        "바쁜 아침 10분 만에 완성하는 퀵 데일리 스킨케어 & 톤업 ☀️ #스킨케어 #데일리메이크업 #꾸안꾸",
        "쿨톤 피부에 착붙는 라벤더 음영 아이섀도우 팔레트 추천 💜 #쿨톤메이크업 #아이섀도우 #음영메이크업",
        "건조한 환절기에도 하루종일 안 뜨는 촉촉 베이스 메이크업 비법 🧴 #베이스메이크업 #물광피부 #쿠션추천",
        "자연스럽게 눈 밑 볼륨 채워주는 애교살 그리는 법 👀 #애교살메이크업 #눈화장팁 #아이메이크업",
        "블랙헤드 모공 싹 비워주는 결케어 클렌징 오일 사용법 🫧 #모공케어 #클렌징루틴 #피부관리",
        "붉은기 싹 잡아주는 티트리 진정 시트팩 비포&애프터 🌿 #피부진정 #트러블케어 #마스크팩추천",
        "뷰러만으로 속눈썹 C컬 하루종일 유지하는 픽서 꿀팁 👁️ #속눈썹펌 #마스카라팁 #아이래쉬",
        "봄웜 vs 여름쿨 나에게 어울리는 퍼스널 컬러 자가진단법 🎨 #퍼스널컬러 #웜톤쿨톤 #메이크업팁",
        "나이트 루틴 탄력 레티놀 크림 바르는 순서와 주의사항 🌙 #안티에이징 #레티놀 #나이트케어"
    ],
    "interior": [
        "8평 원룸 공간 분리 인테리어! 아늑한 침실과 작업 공간 완성 🛏️💻 #원룸인테리어 #공간분리 #자취방꾸미기",
        "우드 앤 화이트 톤으로 채운 햇살 가득 미니멀 거실 🪴 #거실인테리어 #화이트우드 #미니멀홈",
        "간접 조명 3개로 호텔 스위트룸 분위기 내는 조명 인테리어 💡 #간접조명 #조명인테리어 #무드등",
        "초보자도 키우기 쉬운 공기정화 식물 플랜테리어 가이드 🌿 #플랜테리어 #공기정화식물 #반려식물",
        "LP 턴테이블과 우드 수납장으로 꾸민 나만의 음악 감상 코너 🎶 #홈카페 #턴테이블 #감성인테리어",
        "호텔식 침구 각 잡기 & 매일 상쾌하게 침대 정리하는 루틴 🛌 #침구정리 #호텔베딩 #홈스타일링",
        "좁은 주방 2배 넓게 쓰는 싱크대 상하부장 수납 정리 꿀팁 🍽️ #주방정리 #수납인테리어 #살림팁",
        "홈카페 존 완성! 커피 머신과 예쁜 유리잔 진열장 코디 ☕️ #홈바인테리어 #홈카페존 #그릇장",
        "허전한 벽면에 감성 더해주는 빈티지 아트 포스터 액자 레일 설치 🖼️ #벽인테리어 #포스터액자 #갤러리월",
        "하루의 피로를 녹여주는 향기로운 인센스 스틱과 디퓨저 공간 🕯️ #인센스 #디퓨저 #향기테라피"
    ],
    "pets": [
        "퇴근하고 돌아오자 꼬리가 보이지 않게 반겨주는 골든 리트리버 🐶❤️ #댕댕이 #골든리트리버 #강아지사랑",
        "츄르 한 봉지에 세상에서 제일 큰 골골송을 불러주는 러시안블루 🐱🎶 #고양이 #츄르먹방 #골골송 #냥스타그램",
        "'산책 갈까?' 단어 듣자마자 귀 쫑긋하며 펄쩍 뛰는 시바견 🐕✨ #시바견 #강아지산책 #멍멍이일상",
        "새로 산 캣닢 물고기 인형 껴안고 폭풍 뒷발팡팡하는 냥이 🐟🐾 #고양이장난감 #뒷발팡팡 #냥이일상",
        "낙엽 밟으며 숲길 전력질주하는 행복한 강아지 힐링 영상 🍂🐶 #숲길산책 #힐링반려견 #자연과함께",
        "창틀에 턱 괴고 지나가는 새 구경하는 호기심 많은 치즈냥이 🪟🕊️ #치즈태비 #창밖구경 #냥이호기심",
        "빗질 한번 슥 해주면 기분 좋아서 눈 스르륵 감는 토이푸들 🐩💤 #푸들 #강아지빗질 #노곤노곤",
        "분홍빛 젤리 발바닥 자랑하며 발라당 누운 아기 고양이 🐾🌸 #젤리발바닥 #아기고양이 #심장폭행",
        "던져주면 물어오고 또 던져달라고 무한 반복하는 에너자이저 보더콜리 🎾 #보더콜리 #공놀이 #천재견",
        "배 통통 두드려주면 쿨쿨 잠드는 순둥이 말티즈의 낮잠 시간 ☁️🐶 #말티즈 #반려견낮잠 #평화로운오후"
    ],
    "art": [
        "나이프로 캔버스에 물감을 두껍게 얹으며 완성하는 거친 파도 유화 🌊🎨 #유화 #나이프화 #바다그림 #미술",
        "만년필 펜선 하나로 도시의 풍경을 담아내는 어반스케치 드로잉 ✍️🏛️ #어반스케치 #펜드로잉 #드로잉ASMR",
        "투명하게 물빛 번지는 수채화 튤립 꽃송이 채색 과정 🌷🖌️ #수채화 #꽃그림 #수채화일러스트",
        "블렌더(Blender)로 3D 귀여운 캐릭터 모델링하고 렌더링하기 💻🎨 #3D아트 #블렌더 #캐릭터모델링",
        "물레 위에서 점토가 부드러운 도자기로 피어나는 힐링 도예 작업 🏺 #도자기 #도예체험 #물레작업",
        "아이패드 프로크리에이트로 그리는 노을빛 도시 감성 일러스트 📱🌅 #프로크리에이트 #디지털드로잉 #아이패드드로잉",
        "아크릴 물감을 부어 오묘한 우주 마블링을 만드는 푸어링 아트 🌌 #아크릴푸어링 #마블링아트 #추상화",
        "먹물 가득 머금은 붓으로 힘있게 내려긋는 캘리그라피 한 획 🖌️📜 #서예 #캘리그라피 #붓글씨",
        "천 도의 뜨거운 가마에서 유리를 불어 화병을 만드는 유리공예 🏺🔥 #유리공예 #핸드메이드 #공예예술",
        "현대미술관 특별 전시 도슨트 투어와 함께하는 작품 감상 시간 🏛️🖼️ #전시회추천 #미술관데이트 #문화생활"
    ],
    "music": [
        "한강 노을 바라보며 연주하는 어쿠스틱 핑거스타일 기타 버스킹 🎸🌅 #기타연주 #핑거스타일 #한강버스킹",
        "한밤중 재즈 바에서 즉흥으로 연주하는 감미로운 피아노 선율 🎹🍸 #재즈피아노 #즉흥연주 #재즈바",
        "창밖에 빗소리 들으며 작업하기 좋은 Lo-Fi 감성 비트메이킹 🎧🌧️ #로파이 #비트메이킹 #작곡스타그램",
        "드럼 스네어 림샷의 찰진 타격감! 펑크 그루브 드럼 솔로 🥁💥 #드럼연주 #드러머 #비트박스",
        "가슴을 울리는 깊고 웅장한 첼로 독주 카치니의 아베 마리아 🎻🎶 #첼로연주 #클래식음악 #현악기",
        "MPC 패드를 두드리며 실시간으로 완성하는 붐뱁 힙합 비트 🎛️🎤 #힙합비트 #비트메이커 #샘플링",
        "스튜디오 마이크 앞에서 부르는 감성 보컬 라이브 커버 🎙️✨ #보컬커버 #노래스타그램 #라이브세션",
        "일렉 기타 디스토션 걸고 폭풍 속주하는 록 솔로 🎸⚡️ #일렉기타 #기타솔로 #록음악",
        "아날로그 신디사이저 노브를 돌리며 만드는 앰비언트 우주 사운드 🎚️🌌 #신디사이저 #앰비언트 #사운드디자인",
        "오래된 바이닐 레코드 판을 올리고 바늘이 닿는 순간의 아날로그 감성 📻 #바이닐 #LP감성 #아날로그음악"
    ],
    "dance": [
        "요즘 가장 핫한 신곡 챌린지 댄스! 포인트 안무 칼군무 버전 💃🕺 #댄스챌린지 #칼군무 #KPOP댄스",
        "비트에 맞춰 뼈마디를 쪼개는 힙합 팝핑 프리스타일 그루브 🔥 #팝핑 #프리스타일 #스트릿댄스",
        "펑키한 음악에 맞춰 스마일과 에너지가 폭발하는 락킹 댄스 배틀 🕺⚡️ #락킹 #댄스배틀 #펑크",
        "몸짓 하나로 감정을 표현하는 애절하고 아름다운 현대무용 🩰✨ #현대무용 #무용수 #표현예술",
        "연습실 거울 앞에서 땀방울 흘리며 맞추는 릴레이 댄스 안무 🪞👟 #댄스연습 #연습실 #안무영상",
        "빠른 발놀림과 리드미컬한 스텝의 정석 하우스 댄스 루틴 👟🎶 #하우스댄스 #스텝댄스 #클럽댄스",
        "유명 안무가가 직접 창작한 신곡 안무 시안 오리지널 비디오 🎬 #안무가 #코레오 #댄스팀",
        "도심 야외 광장에서 펼쳐지는 댄서들의 자유로운 사이퍼 세션 🏙️🔥 #사이퍼 #스트릿컬처 #댄스라이프",
        "중력을 거스르는 비보이 파워무브 윈드밀과 헤드스핀 🌀🤸‍♂️ #비보이 #브레이킹 #파워무브",
        "파워풀하면서도 유려한 라인이 돋보이는 걸스힙합 루틴 👠👑 #걸스힙합 #힙합댄스 #걸크러쉬"
    ],
    "gaming": [
        "롤 한타 0.1초 반응속도로 터뜨린 5인 궁 대역전극 🎮💥 #리그오브레전드 #롤하이라이트 #펜타킬",
        "발로란트 1대4 상황 침착하게 탭탭 헤드샷으로 클러치 성공 🎯 #발로란트 #클러치 #에이스 #FPS",
        "배틀그라운드 마지막 1대1 자기장에서 8배율 스나이퍼 헤드샷 치킨 🍗 #배틀그라운드 #치킨이닭 #배그명장면",
        "팰월드에서 거점 자동화 완벽하게 세팅하는 알짜배기 공략 팁 🏰 #팰월드 #게임공략 #스팀게임",
        "주말에 친구랑 밤새워 달리기 좋은 스팀 협동 갓겜 TOP 3 🕹️ #스팀게임추천 #멀티게임 #협동게임",
        "오락실 고전 격투게임 100단 콤보 손맛이 살아있는 명경기 👾 #레트로게임 #고전게임 #철권",
        "젤다의 전설 왕눈에서 조나우 기어로 만들어본 상상초월 전투 메카 🤖 #젤다의전설 #왕국의눈물 #닌텐도스위치",
        "소울라이크 악명 높은 보스 패턴 완벽 패링으로 노히트 클리어 ⚔️🛡️ #소울라이크 #패링장인 #보스전",
        "엘든링 밤불검 들고 화려한 전투 기술 폭격 모음집 🗡️🔥 #엘든링 #오픈월드 #액션RPG",
        "롤토체스 9레벨 3성 5코스트 기물 완성하는 짜릿한 리롤 순간 🎲🏆 #롤토체스 #TFT #전략게임"
    ],
    "comedy": [
        "MBTI 파워 극 'I'형이 직장 회식 2차 끌려갔을 때 영혼 탈곡된 표정 😂 #MBTI #I형공감 #직장인일상",
        "헬스 3대 500 친구한테 밥 먹자고 했을 때 단백질 집착 반응 🍗💪 #헬창친구 #단백질집착 #현실친구",
        "카페 알바생이 겪는 공감 200% 진상 손님 vs 천사 손님 유형 ☕️🥲 #카페알바 #알바공감 #현실고증",
        "시험 전날 밤 11시에 책상에 앉은 내 뇌의 실시간 회로 상태 📚🧠 #벼락치기 #시험기간 #대학생공감",
        "전자기기 살 때 이성적인 나 vs 감성적인 나 내적 갈등 💻📱 #지름신 #아이패드병 #현실싸움",
        "일요일 밤 10시 vs 월요일 아침 8시 표정 변화 극과 극 ⏰🫠 #월요병 #직장인공감 #퇴근마려움",
        "다이어트 시작한 지 3시간 만에 야식 메뉴 배달앱 켜는 내 손가락 🍕🛵 #다이어트실패 #야식유혹 #공감짤",
        "친구랑 진지한 얘기 하다가 웃참 실패하고 눈물 쏟는 순간 🤣😭 #웃참실패 #찐친케미 #개그영상",
        "거울 속 완벽한 내 모습 vs 기본 카메라 후면 렌즈에 찍힌 현실 📸🪞 #카메라현실 #거울샷비교 #유머",
        "K-직장인 단톡방 넵봇의 하루: 넵! 알겠습니다! 넵 확인했습니다! 🤖💼 #직장인단톡 #넵봇 #사회생활"
    ]
}

def seed_160_unique_reels():
    db = SessionLocal()
    try:
        print("🚀 [160종 취향 맞춤 릴스 전면 갱신 시작]")

        # 1. 활성 유저 목록 확인
        all_users = db.query(User).all()
        if len(all_users) < 10:
            print("❌ 사용자가 부족합니다. 먼저 기본 시드를 실행해주세요.")
            return

        print(f"👥 등록된 유저 수: {len(all_users)}명")

        # 2. 기존 ContentView에서 reel_id 참조 끊기 (외래키 제약 방지)
        deleted_views = db.query(ContentView).filter(ContentView.reel_id.isnot(None)).delete(synchronize_session=False)
        db.commit()
        print(f"🧹 기존 릴스 시청 기록 {deleted_views}건 정리 완료")

        # 3. 기존 Reel 데이터 정리
        deleted_reels = db.query(Reel).delete(synchronize_session=False)
        db.commit()
        print(f"🧹 기존 릴스 {deleted_reels}건 삭제 완료")

        # 4. 16개 카테고리 x 10개 = 총 160개 릴스 1:1 고유 매핑 생성
        reels_to_insert = []
        user_idx = 0

        for cat_idx, cat in enumerate(CATEGORIES):
            posters = CATEGORY_POSTERS.get(cat, [])
            audios = CATEGORY_AUDIOS.get(cat, [])
            captions = CATEGORY_CAPTIONS.get(cat, [])

            for item_idx in range(10):
                reel_num = (cat_idx * 10 + item_idx) + 1  # 1 ~ 160

                # 작성자 배정 (유저들을 순환 배정하여 다양성 극대화)
                author = all_users[user_idx % len(all_users)]
                user_idx += 1

                # 160종 고유 비디오 URL:
                # 20개 로컬 고화질 비디오를 베이스로 각 릴스마다 고유 쿼리 파라미터(?reel=X&cat=Y)를 부여하여
                # 브라우저와 백엔드가 160개의 개별 고유 인스턴스로 정확히 인식 및 캐싱 분리
                base_video_idx = ((reel_num - 1) % 20) + 1
                video_url = f"/videos/reel{base_video_idx}.mp4?v={reel_num}&cat={cat}"

                poster_url = posters[item_idx % len(posters)]
                audio_title = audios[item_idx % len(audios)]
                caption = captions[item_idx % len(captions)]
                duration_ms = random.randint(12000, 26000)

                created_time = datetime.utcnow() - timedelta(
                    days=random.randint(1, 14),
                    hours=random.randint(1, 23),
                    minutes=random.randint(1, 59)
                )

                reel = Reel(
                    id=reel_num,
                    user_id=author.id,
                    video_url=video_url,
                    poster_url=poster_url,
                    caption=caption,
                    category=cat,
                    duration_ms=duration_ms,
                    tagged_user=None,
                    audio_title=audio_title,
                    audio_cover_url=poster_url,
                    audio_is_explicit=False,
                    shares_count=random.randint(15, 250),
                    reposts_count=random.randint(5, 80),
                    created_at=created_time
                )
                db.add(reel)
                reels_to_insert.append(reel)

        db.commit()
        print(f"🎉 16개 카테고리별 160개 고유 릴스 생성 완료! (ID 1 ~ {len(reels_to_insert)})")

        # 5. 각 릴스별 초기 좋아요 및 댓글 시드 (리얼리티 강화)
        print("💬 릴스별 소셜 인터랙션 (좋아요/댓글) 생성 중...")
        sample_comments = [
            "진짜 유익해요! 저장해두고 매일 봅니다 👍",
            "와 퀄리티 대박이네요 ㅋㅋㅋ 팔로우하고 갑니다!",
            "영상 분위기 너무 좋아요 ✨ bgm 제목 뭔가요?",
            "이거 보고 바로 따라 해봤는데 최고입니다 🔥",
            "릴스 피드에서 오늘 본 것 중 제일 재밌네요 👏"
        ]

        for reel in reels_to_insert:
            # 좋아요 3~15개
            num_likes = random.randint(3, 12)
            likers = random.sample(all_users, min(num_likes, len(all_users)))
            for liker in likers:
                db.add(Like(user_id=liker.id, reel_id=reel.id))

            # 댓글 1~3개
            num_cmts = random.randint(1, 3)
            commenters = random.sample(all_users, min(num_cmts, len(all_users)))
            for c_idx, commenter in enumerate(commenters):
                c_text = sample_comments[(reel.id + c_idx) % len(sample_comments)]
                db.add(Comment(
                    user_id=commenter.id,
                    reel_id=reel.id,
                    content=c_text,
                    created_at=reel.created_at + timedelta(minutes=random.randint(10, 180))
                ))

        db.commit()
        print(f"✅ 총 160개 릴스 및 소셜 반응 적재 완료!")

    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_160_unique_reels()
