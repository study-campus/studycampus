import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHwxv-MJBK8wXA4C1Q98jDEh_ESRbhaBI",
    authDomain: "studycampus-6e42f.firebaseapp.com",
    databaseURL: "https://studycampus-6e42f-default-rtdb.firebaseio.com",
    projectId: "studycampus-6e42f",
    storageBucket: "studycampus-6e42f.firebasestorage.app",
    messagingSenderId: "1076988511909",
    appId: "1:1076988511909:web:93cb4044969146543f2f4c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const DEFAULT_STATE = {
    users: [], lectures: [], homework: [], hwSubmissions: [], community: [], notices: [], payments: [], materials: [], reports: [], alerts: [],
    settings: {
        rollingBanners: [
            { tab: "대학 합격의 기준", img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80", link: "#" }
        ],
        dashBanner: "새로운 온라인 학습 시스템 오픈! 완벽한 밀착 관리를 경험하세요.",
        hwWarning: "⚠️ 숙제 제출 기한 : 당일 저녁 12시\n⚠️ 늦어지는 경우 미리 사유+인증 필요 (ex. 학원증)\n⚠️ 미제출시 경고 / 경고2회 = 옐로카드 / 옐로카드2회 = 레드카드\n⚠️ 필기가 비어있을 경우 미제출로 간주",
        payment: { pgUrl: "", bankInfo: "[하나은행] 342-910508-31507", opt1: "1개월-10만", opt2: "", opt3: "", opt4: "" },
        popup: { active: false, tag: "이용 안내", title: "함께 발전해 나가요!", desc: "의견을 남겨주시면 큰 도움이 됩니다.", b1Title: "카카오톡 채널 친구 추가하기", b1Desc: "1개월 무료 수강권을 드립니다.", b1Url: "http://pf.kakao.com/_xdxnxfXX", b2Title: "인스타그램 팔로우하기", b2Desc: "카카오톡 채널에 바로가기에 있습니다.", b2Url: "https://instagram.com" }
    },
    landing: { heroSub: "STUDY CAMPUS LEARNING SYSTEM", heroTitle: "성적 향상의 해답<br>프리미엄 온라인 학원", heroDesc: "1:1 관리 시스템.", s1Num: "260", s1Txt: "수강", s2Num: "2등급", s2Txt: "상승", s3Num: "98점", s3Txt: "수능", secTitle: "왜 StudyCampus 인가요?", f1Badge: "문제", f1Col: "red", f1Title: "성적이 안 오르는 이유", f1Desc: "일방적인 강의 시청, 피드백 없는 숙제", f1Emoji: "😫", f2Badge: "해결", f2Col: "blue", f2Title: "체계적인 온라인 밀착 관리", f2Desc: "누구나 포기하지 않고 따라오는 커리큘럼", f2Emoji: "💡", botTitle: "지금 StudyCampus와 시작하세요" }
};

const AppState = {
    data: DEFAULT_STATE,
    currentUser: null, currentView: 'landing', authMode: 'login', studentTab: 'home', adminTab: 'users',
    activeLecture: null, lectureTimer: null, currentHwWeekNumber: 1, materialCategory: '전체', activePostId: null,
    adminModal: { isOpen: false, mode: 'add', studentId: null }
};

let rbTimer = null; 
let currentBannerIdx = 0;
let rbsData = [];
let cropper = null;
let currentCropIdx = -1;

// ------------------------- 유틸리티 -------------------------
function showToast(msg) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; c.appendChild(t); setTimeout(() => t.remove(), 2500); }
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
function clearLectureTimer() { if(AppState.lectureTimer) { clearInterval(AppState.lectureTimer); AppState.lectureTimer = null; } }
function clearBannerTimer() { if(rbTimer) { clearInterval(rbTimer); rbTimer = null; } }
function normalizeSchool(name) { let s = name.trim(); if(s && s.endsWith('고')) s += '등학교'; return s; }

// ------------------------- 파이어베이스 동기화 -------------------------
const dbRef = ref(db, 'studycampus_data');
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) AppState.data = serverData;
    else set(dbRef, AppState.data);

    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    const isModalOpen = document.querySelector('.modal-overlay:not(.hidden)') !== null;
    
    if (!isTyping && !isModalOpen) {
        if(AppState.currentView === 'landing') renderLandingPage();
        renderCurrentView();
    }
});
function syncData() { set(dbRef, AppState.data); }

// ------------------------- 라우팅 -------------------------
function switchView(viewName) {
    clearLectureTimer(); 
    if(viewName !== 'landing') clearBannerTimer();
    if(viewName !== 'lecture-player') AppState.activeLecture = null;
    AppState.currentView = viewName;
    
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if(targetView) targetView.classList.remove('hidden');
    
    if (viewName === 'auth') switchAuthMode('login');
    const isAppView = viewName === 'student' || viewName === 'admin' || viewName === 'payment' || viewName === 'lecture-player';
    
    document.querySelectorAll('.global-element').forEach(el => el.classList.toggle('hidden', isAppView));
    
    if(!isAppView) renderNavbar();
    if (viewName === 'student') checkAndShowPopup();
    if (viewName === 'landing') renderLandingPage();
    
    renderCurrentView();
}

function switchAuthMode(mode) {
    AppState.authMode = mode;
    ['login', 'register', 'find-id', 'reset-pw'].forEach(m => {
        document.getElementById(`modal-${m}`).classList.toggle('hidden', m !== mode);
    });
}

function renderNavbar() {
    const btn = document.querySelector('[data-action="auth-toggle"]');
    const tag = document.getElementById('user-profile-tag');
    if (AppState.currentUser) {
        tag.classList.remove('hidden'); tag.textContent = `${AppState.currentUser.name}님 접속중`;
        btn.textContent = '내 대시보드 가기'; btn.dataset.action = 'nav'; btn.dataset.target = AppState.currentUser.role === 'admin' ? 'admin' : 'student';
    } else {
        tag.classList.add('hidden'); btn.textContent = '로그인'; btn.dataset.action = 'auth-toggle';
    }
}

function renderCurrentView() {
    if (AppState.currentView === 'student' && AppState.currentUser) renderStudentDashboard();
    else if (AppState.currentView === 'admin' && AppState.currentUser) renderAdminDashboard();
    else if (AppState.currentView === 'payment' && AppState.currentUser) renderPaymentCenter();
    else if (AppState.currentView === 'lecture-player' && AppState.currentUser) renderLecturePlayer();
}

// ------------------------- 배너 컨트롤러 -------------------------
function startBanner() {
    clearBannerTimer();
    if(rbsData.length <= 1) return;
    rbTimer = setInterval(() => {
        currentBannerIdx = (currentBannerIdx + 1) % rbsData.length;
        updateBannerUI();
    }, 4000);
}
function updateBannerUI() {
    const tabs = document.querySelectorAll('.mega-tab');
    tabs.forEach((tab, i) => tab.classList.toggle('active', i === currentBannerIdx));
    const imgEl = document.getElementById('mega-banner-img');
    const viewContainer = document.getElementById('mega-banner-view');
    if(rbsData[currentBannerIdx]) {
        if(imgEl) imgEl.src = rbsData[currentBannerIdx].img || '';
        if(viewContainer) viewContainer.dataset.link = rbsData[currentBannerIdx].link || '#';
    }
}

function renderLandingPage() {
    const ld = { ...DEFAULT_STATE.landing, ...(AppState.data.landing || {}) };
    document.getElementById('ld-hero-sub').textContent = ld.heroSub || ''; document.getElementById('ld-hero-title').innerHTML = ld.heroTitle || ''; document.getElementById('ld-hero-desc').textContent = ld.heroDesc || '';
    document.getElementById('ld-s1-n').textContent = ld.s1Num || ''; document.getElementById('ld-s1-t').textContent = ld.s1Txt || ''; document.getElementById('ld-s2-n').textContent = ld.s2Num || ''; document.getElementById('ld-s2-t').textContent = ld.s2Txt || ''; document.getElementById('ld-s3-n').textContent = ld.s3Num || ''; document.getElementById('ld-s3-t').textContent = ld.s3Txt || '';
    document.getElementById('ld-sec-title').textContent = ld.secTitle || ''; document.getElementById('ld-f1-b').textContent = ld.f1Badge || ''; document.getElementById('ld-f1-b').className = 'badge-' + (ld.f1Col || 'blue'); document.getElementById('ld-f1-t').textContent = ld.f1Title || ''; document.getElementById('ld-f1-d').textContent = ld.f1Desc || ''; document.getElementById('ld-f1-e').textContent = ld.f1Emoji || ''; document.getElementById('ld-f2-b').textContent = ld.f2Badge || ''; document.getElementById('ld-f2-b').className = 'badge-' + (ld.f2Col || 'red'); document.getElementById('ld-f2-t').textContent = ld.f2Title || ''; document.getElementById('ld-f2-d').textContent = ld.f2Desc || ''; document.getElementById('ld-f2-e').textContent = ld.f2Emoji || ''; document.getElementById('ld-bot-title').textContent = ld.botTitle || '';
    
    // 롤링 배너 렌더링
    rbsData = AppState.data.settings?.rollingBanners || [];
    const tabsContainer = document.getElementById('mega-banner-tabs');
    const viewContainer = document.getElementById('mega-banner-view');
    const imgEl = document.getElementById('mega-banner-img');
    
    if(currentBannerIdx >= rbsData.length) currentBannerIdx = 0;
    
    if(tabsContainer && viewContainer && imgEl) {
        if(rbsData.length === 0) {
            tabsContainer.innerHTML = ''; imgEl.src = ''; viewContainer.dataset.link = '#'; clearBannerTimer();
        } else {
            tabsContainer.innerHTML = rbsData.map((b, i) => `<button class="mega-tab ${i === currentBannerIdx ? 'active' : ''}" data-action="change-banner" data-idx="${i}">${b.tab}</button>`).join('');
            updateBannerUI();
            startBanner();
        }
    }
}

function renderPaymentCenter() {
    document.getElementById('pay-req-name').value = AppState.currentUser.name;
    const paySet = AppState.data.settings?.payment || { pgUrl: "", bankInfo: "[하나은행] 342-910508-31507", opt1: "1개월-10만", opt2: "", opt3: "", opt4: "" };
    document.getElementById('payment-bank-info').textContent = paySet.bankInfo;
    const pgArea = document.getElementById('payment-pg-area'); const btnPg = document.getElementById('btn-pg-link');
    if(paySet.pgUrl) { pgArea.classList.remove('hidden'); btnPg.onclick = () => window.open(paySet.pgUrl, '_blank'); } else { pgArea.classList.add('hidden'); }
    const sel = document.getElementById('pay-req-item'); sel.innerHTML = ''; [paySet.opt1, paySet.opt2, paySet.opt3, paySet.opt4].forEach(opt => { if(opt) sel.innerHTML += `<option value="${opt}">${opt}</option>`; });
}

function checkAndShowPopup() {
    const setPopup = AppState.data.settings?.popup || DEFAULT_STATE.settings.popup;
    if (!setPopup.active || localStorage.getItem('studycampus_hide_popup') === new Date().toISOString().split('T')[0] || sessionStorage.getItem('studycampus_popup_shown')) return;
    
    document.getElementById('pop-tag').textContent = setPopup.tag; 
    document.getElementById('pop-title').textContent = setPopup.title; 
    document.getElementById('pop-desc').textContent = setPopup.desc; 
    
    let btnsHtml = '';
    if(setPopup.b1Title) btnsHtml += `<div class="pop-action-item" onclick="window.open('${setPopup.b1Url||'#'}', '_blank')"><div class="icon">💬</div><div class="text"><h4>${setPopup.b1Title}</h4><p>${setPopup.b1Desc}</p></div></div>`;
    if(setPopup.b2Title) btnsHtml += `<div class="pop-action-item" onclick="window.open('${setPopup.b2Url||'#'}', '_blank')"><div class="icon">📞</div><div class="text"><h4>${setPopup.b2Title}</h4><p>${setPopup.b2Desc}</p></div></div>`;
    const btnArea = document.getElementById('pop-btn-area'); if(btnArea) btnArea.innerHTML = btnsHtml;
    
    document.getElementById('student-auto-popup').classList.remove('hidden');
}

// ------------------------- 학생 대시보드 -------------------------
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const { currentUser, data, studentTab } = AppState;
    const me = (data.users || []).find(u => u.id === currentUser.id) || currentUser;
    let html = '';

    document.querySelectorAll('#student-bottom-nav .stu-nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === studentTab));
    
    const notifList = document.getElementById('notif-list');
    const myAlerts = (data.alerts || []).filter(a => a.studentId === me.id);
    const globalNotices = (data.notices || []).map(n => ({...n, type: 'notice'}));
    const combinedNotifs = [...myAlerts, ...globalNotices].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(notifList) {
        if(combinedNotifs.length === 0) notifList.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">새로운 알림이 없습니다.</div>`;
        else {
            notifList.innerHTML = combinedNotifs.slice(0, 10).map(n => `<div class="notif-item"><span style="font-size:18px;">${n.type==='notice'?'📢':'📝'}</span><div style="flex:1;"><strong style="display:block; color:white; margin-bottom:4px;">${n.title || n.content.substring(0,15)}</strong><span style="color:var(--text-muted);">${n.content.substring(0,30)}...</span></div></div>`).join('');
            const unreadCount = myAlerts.filter(a => !a.read).length;
            const badge = document.getElementById('notif-badge');
            if(unreadCount > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');
        }
    }

    if (studentTab === 'homework') {
        if (data.homework && data.homework.length > 0) {
            const maxW = Math.max(...data.homework.map(h => parseInt(h.week) || 1));
            if (!AppState.currentHwWeekNumber || AppState.currentHwWeekNumber > maxW) { AppState.currentHwWeekNumber = maxW; }
        } else { AppState.currentHwWeekNumber = 1; }
    }

    if (studentTab === 'home') {
        const dashBanner = data.settings?.dashBanner || ''; if (dashBanner) html += `<div class="stu-banner-top"><span style="font-size:18px;">📢</span> <span>${dashBanner}</span></div>`;
        html += `<div class="stu-banner-blue"><div style="position:absolute; right:-20px; bottom:-20px; width:150px; height:150px; background:rgba(255,255,255,0.1); border-radius:50%;"></div><div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1;"><div><div style="font-size:12px; font-weight:800; margin-bottom:8px; opacity:0.8; letter-spacing:1px; text-transform:uppercase;">WEEK ${AppState.currentHwWeekNumber || 1}</div><div style="font-size:26px; font-weight:800; margin-bottom:12px; letter-spacing:-1px; line-height:1.3;">${me.name}님,<br>오늘도 파이팅!</div><div style="font-size:13px; font-weight:500; opacity:0.9;">${me.school||'학교정보 없음'} ${me.grade||''} · ${me.teacher||'담당T 미배정'}</div></div><div style="width:60px; height:60px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:32px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">👩‍🏫</div></div><div style="display:flex; gap:15px; margin-top:30px; position:relative; z-index:1;"><div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">🔥</div><div><div style="font-size:18px; font-weight:800;">1일</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">연속 출석</div></div></div><div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">💎</div><div><div style="font-size:18px; font-weight:800;">${me.xp || 0} XP</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">누적 점수</div></div></div></div></div>`;
    } 
    else if (studentTab === 'homework') {
        const curWeek = AppState.currentHwWeekNumber || 1;
        const myHw = (data.homework || []).filter(h => parseInt(h.week) === curWeek && (h.target === 'all' || h.target === me.id));
        myHw.sort((a, b) => new Date(a.date) - new Date(b.date));

        let hwCompletedCount = 0;
        myHw.forEach(h => { const sub = (data.hwSubmissions || []).find(s => s.hwId === h.id && s.studentId === me.id); if(sub && sub.status === 'approved') hwCompletedCount++; });
        const hwTotalCount = myHw.length; const hwPercent = hwTotalCount === 0 ? 0 : Math.round((hwCompletedCount / hwTotalCount) * 100);
        
        const hwWarnText = (data.settings?.hwWarning || "⚠️ 숙제 제출 기한 : 당일 저녁 12시\n⚠️ 늦어지는 경우 미리 사유+인증 필요 (ex. 학원증)\n⚠️ 미제출시 경고 / 경고2회 = 옐로카드 / 옐로카드2회 = 레드카드\n⚠️ 필기가 비어있을 경우 미제출로 간주").replace(/\n/g, '<br>');

        html += `
        <div style="background:#3b82f6; border-radius:12px; padding:20px; color:white; margin-bottom:15px; position:relative; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="arrow-btn" data-action="change-week" data-dir="-1" style="background:rgba(255,255,255,0.2); width:32px; height:32px; border-radius:50%; border:none; color:white; cursor:pointer;">&lt;</button>
                <div style="text-align:center;"><div style="font-size:18px; font-weight:800;">${curWeek}주차</div><div style="font-size:12px; opacity:0.8; margin-top:4px;">숙제 현황</div></div>
                <button class="arrow-btn" data-action="change-week" data-dir="1" style="background:rgba(255,255,255,0.2); width:32px; height:32px; border-radius:50%; border:none; color:white; cursor:pointer;">&gt;</button>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:20px; font-size:12px; font-weight:700;"><span>완료 ${hwCompletedCount}/${hwTotalCount}</span><span>${hwPercent}%</span></div>
            <div style="width:100%; height:6px; background:rgba(255,255,255,0.3); border-radius:3px; margin-top:8px; overflow:hidden;"><div style="width:${hwPercent}%; height:100%; background:#10b981; transition:width 0.5s;"></div></div>
        </div>
        <div style="background:rgba(239, 68, 68, 0.1); border:1px solid #ef4444; border-radius:8px; padding:15px; margin-bottom:20px; font-size:12px; color:#fca5a5; line-height:1.6; font-weight:600;">${hwWarnText}</div>
        <div style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border); overflow:hidden;">`;

        if(myHw.length === 0) { html += `<div style="padding:40px; text-align:center; color:var(--text-muted); font-weight:600; font-size:14px;">이번 주차에 배포된 숙제가 없습니다.</div>`; } 
        else {
            myHw.forEach(h => {
                const sub = (data.hwSubmissions || []).find(s => s.hwId === h.id && s.studentId === me.id);
                const isApproved = sub && sub.status === 'approved'; const isRejected = sub && sub.status === 'rejected'; const isPending = sub && sub.status === 'pending';
                
                let statusIcon = `<div style="width:28px; height:28px; border-radius:50%; border:2px solid #475569; display:flex; justify-content:center; align-items:center; background:var(--bg-dark);"></div>`;
                if (isApproved) statusIcon = `<div style="width:28px; height:28px; border-radius:50%; background:#10b981; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; border:2px solid #10b981;">✓</div>`;
                else if (isPending) statusIcon = `<div style="width:28px; height:28px; border-radius:50%; background:#3b82f6; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; border:2px solid #3b82f6; font-size:14px;">...</div>`;
                else if (isRejected) statusIcon = `<div style="width:28px; height:28px; border-radius:50%; background:#ef4444; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; border:2px solid #ef4444;">✗</div>`;

                html += `<div style="padding:18px 20px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:10px;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div style="display:flex; gap:15px; align-items:flex-start; width:100%;"><div style="margin-top:2px;">${statusIcon}</div><div style="flex:1;"><div style="font-weight:800; color:white; font-size:15px; display:flex; gap:8px; align-items:center;">${h.day || '요일'} <span style="font-size:12px; color:var(--text-muted); font-weight:500;">${h.date || ''}</span></div><div style="font-size:14px; color:#cbd5e1; margin-top:8px; line-height:1.5; font-weight:600; white-space:pre-wrap;">${h.desc}</div>`;
                if(!sub) { html += `<div style="margin-top:12px; background:var(--bg-dark); border:1px dashed #475569; padding:12px; text-align:center; border-radius:8px; cursor:pointer; color:#94a3b8; font-weight:600; font-size:13px; transition:0.2s;" data-action="trigger-file" data-id="${h.id}">📎 파일 첨부하여 과제 제출하기</div><input type="file" id="hw-file-${h.id}" multiple class="hidden" data-hwid="${h.id}">`; } 
                else { html += `<div style="margin-top:12px; background:var(--bg-dark); padding:12px; border-radius:8px; border:1px solid var(--border);"><span style="font-size:13px; color:${isApproved?'#10b981':(isRejected?'#ef4444':'#3b82f6')}; font-weight:800;">${isApproved?'✅ 제출 및 승인 완료':(isRejected?'❌ 반려됨 (사유 확인 후 재제출 요망)':'⏳ 선생님 검사 대기중')}</span><div style="font-size:12px; color:var(--text-muted); margin-top:5px;">내가 첨부한 파일: ${sub.files.length}개</div>${isRejected ? `<button style="margin-top:10px; padding:6px 12px; background:transparent; border:1px solid #ef4444; color:#ef4444; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;" data-action="cancel-hw" data-subid="${sub.id}">다시 제출하기</button>` : ''}</div>`; }
                html += `</div></div></div></div>`;
            });
        }
        html += `</div>`;
    }
    else if (studentTab === 'test') html += `<div class="stu-banner-green">나의 테스트실</div><div class="stu-empty">시험지 없음</div>`;
    else if (studentTab === 'lectures') {
        html += `
        <div style="background:white; border-radius:16px; padding:0; overflow:hidden; color:#1e293b; margin-bottom:20px; box-shadow:0 10px 20px rgba(0,0,0,0.2);">
            <div style="background:#2563eb; padding:30px 20px; color:white;">
                <div style="font-size:12px; font-weight:700; margin-bottom:5px; opacity:0.8;">2026년 상시 정규반</div>
                <h2 style="font-size:24px; font-weight:800; margin-bottom:5px; letter-spacing:-1px;">기출분석 및 모의고사</h2>
                <div style="font-size:13px; opacity:0.8;">현재 주차 진행중</div>
            </div>
            <div style="padding:20px;">
                <h3 style="font-size:16px; font-weight:800; margin-bottom:15px; display:flex; align-items:center; gap:8px;"><span style="color:#2563eb;">●</span> 이번 주 시청 목록</h3>
                <div style="display:flex; flex-direction:column; gap:0;">
        `;
        if (!data.lectures || data.lectures.length === 0) { html += `<div style="text-align:center; padding:40px; color:#94a3b8; font-weight:600; background:#f8fafc; border-radius:12px;">등록된 강의가 없습니다.</div>`; } 
        else {
            data.lectures.forEach((l, idx) => {
                const p = me.lectureProgress?.[l.id] || { percent: 0, done: false };
                const isDone = p.done || p.percent >= 90;
                const iconBg = isDone ? '#dcfce7' : '#e0e7ff'; const iconColor = isDone ? '#16a34a' : '#4f46e5'; const iconChar = isDone ? '✓' : '▶'; const btnText = isDone ? '완료' : '시청'; const btnColor = isDone ? '#16a34a' : '#3b82f6';
                html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:18px 0; border-bottom:1px solid #f1f5f9;"><div style="display:flex; align-items:center; gap:15px; width:75%;"><div style="width:40px; height:40px; border-radius:50%; background:${iconBg}; color:${iconColor}; display:flex; justify-content:center; align-items:center; font-size:16px; font-weight:bold; flex-shrink:0;">${iconChar}</div><div><div style="font-weight:700; font-size:15px; margin-bottom:4px; color:#0f172a; line-height:1.4;">${idx+1}강. ${l.title}</div><div style="font-size:12px; color:#64748b; font-weight:600;">${isDone ? '수강 완료' : (p.percent + '% 진행중')}</div></div></div><button class="btn-text" style="color:${btnColor}; font-weight:800; font-size:14px; background:#f8fafc; padding:8px 16px; border-radius:20px; transition:0.2s; border:1px solid #e2e8f0;" data-action="open-lecture" data-id="${l.id}">${btnText}</button></div>`;
            });
        }
        html += `</div></div></div>`;
    }
    else if (studentTab === 'materials') {
        const cat = AppState.materialCategory; html += `<div class="stu-banner-mint">자료실</div><div style="display:flex; gap:10px; margin-bottom:20px;"><button class="stu-btn-pill ${cat==='전체'?'active':''}" data-action="set-mat-cat" data-cat="전체">전체</button><button class="stu-btn-pill ${cat==='공지'?'active':''}" data-action="set-mat-cat" data-cat="공지">공지</button><button class="stu-btn-pill ${cat==='교재'?'active':''}" data-action="set-mat-cat" data-cat="교재">교재</button></div>`; const mats = (data.materials || []).filter(m => cat === '전체' || m.category === cat);
        if(mats.length === 0) html += `<div class="stu-empty">자료 없음</div>`;
        else mats.forEach(m => { html += `<div class="stu-card"><strong style="font-size:16px; display:flex; align-items:center; gap:8px;">${m.title} <span class="badge ${m.category==='공지'?'badge-red':'badge-blue'}">${m.category}</span></strong><p style="color:var(--text-muted); font-size:14px; margin-top:8px;">${m.desc||''}</p>`; if(m.fileData) html += `<a href="${m.fileData}" download="${m.fileName}" style="display:inline-block; margin-top:15px; padding:10px 16px; background:#1e293b; color:white; border-radius:8px; border:1px solid #334155; font-size:13px; font-weight:bold;">📥 ${m.fileName} 다운로드</a>`; html += `</div>`; });
    }
    else if (studentTab === 'community') {
        html += `<h2 style="font-size:24px; font-weight:800; color:#60a5fa; margin-bottom:20px;">소통 커뮤니티</h2><div class="stu-card" style="padding:10px;"><form id="form-community" style="display:flex; gap:10px;"><input type="text" id="comm-text" required placeholder="질문방 작성..." style="flex:1; background:transparent; border:1px solid #334155; border-radius:8px; padding:12px 15px; color:white; outline:none; font-size:14px;"><button type="submit" class="btn-primary" style="width:auto; padding:0 20px;">등록</button></form></div>`;
        if (!data.community || data.community.length === 0) html += `<div style="text-align:center; color:#64748b; margin-top:60px; font-size:14px; font-weight:600;">등록된 글이 없습니다.</div>`;
        else data.community.forEach(c => html += `<div class="stu-card" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='var(--border)'" data-action="open-post" data-id="${c.id}"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="font-size:14px;">👤 ${c.author}</strong><span style="color:#64748b; font-size:12px;">${c.date||''}</span></div><p style="font-size:15px; line-height:1.5;">${c.content}</p><div style="margin-top:10px; font-size:13px; color:#64748b;">❤️ ${c.likes?c.likes.length:0} &nbsp; 💬 ${c.comments?c.comments.length:0}</div></div>`);
    }
    else if (studentTab === 'mypage') {
        let expiryHtml = `<div style="color:var(--text-muted); font-size:14px;">수강권 없음</div>`;
        if (me.ticketExpiry) {
            const expD = new Date(me.ticketExpiry); const td = new Date();
            const diff = Math.ceil((expD - td) / (1000 * 60 * 60 * 24));
            const days = ['일','월','화','수','목','금','토'];
            const dStr = diff > 0 ? `D-${diff}` : (diff === 0 ? `D-Day` : `만료됨`);
            expiryHtml = `
                <div>
                    <div style="font-size:13px; color:#64748b; margin-bottom:4px; font-weight:600;">수강권</div>
                    <div style="font-size:18px; font-weight:800; color:#0f172a;">${expD.getMonth()+1}/${expD.getDate()}(${days[expD.getDay()]})까지</div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="color:#2563eb; font-size:18px; font-weight:800;">${dStr}</span>
                    <button class="btn-primary btn-sm" style="background:#f1f5f9; color:#2563eb; border-radius:20px; font-weight:700; padding:8px 16px;" data-action="nav" data-target="payment">결제 및 연장</button>
                </div>
            `;
        }

        html += `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                ${expiryHtml}
            </div>
            <div class="stu-card">
                <h3 style="font-size:16px; font-weight:700; margin-bottom:15px; display:flex; align-items:center; gap:8px;">📝 주간 분석 리포트</h3>
                <hr style="border-color:#334155; margin-bottom:15px;">`;
                
        const myReports = (data.reports || []).filter(r => r.studentId === me.id);
        if(myReports.length === 0) html += `<div style="text-align:center; color:#64748b; font-size:14px; padding:20px 0;">리포트 없음</div>`;
        else myReports.forEach(r => html += `<div style="background:#0f172a; padding:15px; border-radius:8px; margin-bottom:10px;"><strong style="color:#60a5fa; display:block; margin-bottom:8px;">📅 ${r.date} 발송 리포트</strong><p style="font-size:14px; line-height:1.6; white-space:pre-wrap; color:#cbd5e1;">${r.content}</p></div>`);

        html += `
            </div>
            <div class="stu-card" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='var(--border)'" data-action="open-student-edit">
                <h3 style="font-size:16px; font-weight:700; display:flex; align-items:center; gap:12px;"><span style="font-size:20px;">⚙️</span> 회원 정보 수정</h3>
                <span style="color:#64748b; font-weight:bold; font-size:16px;">&gt;</span>
            </div>
            <div class="stu-card">
                <h3 style="font-size:16px; font-weight:700; margin-bottom:15px;">1:1 카카오톡 문의센터</h3>
                <a href="http://pf.kakao.com/_xdxnxfXX" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; border:none; width:100%; padding:15px; border-radius:8px; font-weight:800; cursor:pointer;">카톡으로 접수/연결</a>
            </div>
            <div style="text-align:right;"><button class="btn-text" style="color:#ef4444;" data-action="delete-account">회원탈퇴</button></div>
        `;
    }
    container.innerHTML = html;
}

function renderLecturePlayer() {
    const container = document.getElementById('lecture-player-content');
    const { currentUser, data, activeLecture } = AppState;
    if(!activeLecture) return switchView('student');
    
    const me = (data.users || []).find(u => u.id === currentUser.id) || currentUser;
    const prog = me.lectureProgress?.[activeLecture.id] || { percent: 0, done: false };
    const isDone = prog.done || prog.percent >= 90;
    
    let embedLink = activeLecture.link || "";
    try {
        if(embedLink.includes('watch?v=')) embedLink = embedLink.replace('watch?v=', 'embed/');
        else if(embedLink.includes('youtu.be/')) embedLink = embedLink.replace('youtu.be/', 'www.youtube.com/embed/');
    } catch(e) {}

    document.getElementById('player-top-progress').textContent = `${prog.percent}%`;

    let html = `
    <div class="lecture-player-grid">
        <div class="player-main">
            <div style="background:#000; border-radius:12px; overflow:hidden; aspect-ratio:16/9; margin-bottom:20px; border:1px solid var(--border);">
                <iframe width="100%" height="100%" src="${embedLink}?rel=0&modestbranding=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            </div>
            <h1 style="font-size:24px; font-weight:800; margin-bottom:15px; color:white;">${activeLecture.title}</h1>
            <button class="btn-primary btn-sm" style="background:#334155; color:white; border-radius:20px; font-weight:600; margin-bottom:30px;" onclick="alert('사진첩 저장 기능 준비중')">📥 사진첩에 저장</button>
            
            <div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; font-weight:700; color:#94a3b8;">
                    <span>현재 수강률</span> <span style="color:#60a5fa;" id="live-progress-text">${prog.percent}%</span>
                </div>
                <div style="width:100%; height:6px; background:#0f172a; border-radius:3px; margin-bottom:15px; overflow:hidden;">
                    <div id="live-progress-bar" style="width:${prog.percent}%; height:100%; background:#3b82f6; transition:width 1s linear;"></div>
                </div>
                <div style="font-size:13px; color:#fbbf24; font-weight:700;">⚠️ 90% 이상 수강해야 출석으로 인정됩니다.</div>
            </div>
        </div>
        <div class="player-playlist">
            <h3 style="font-size:16px; font-weight:700; color:#cbd5e1; margin-bottom:15px; border-bottom:2px solid #a3e635; display:inline-block; padding-bottom:5px;">강의 목록</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
    `;

    (data.lectures || []).forEach((l, idx) => {
        const p = me.lectureProgress?.[l.id] || { percent: 0, done: false };
        const lDone = p.done || p.percent >= 90;
        const isActive = (l.id === activeLecture.id);
        
        let iconHtml = `<div style="width:24px; height:24px; border-radius:50%; background:#334155; color:white; display:flex; justify-content:center; align-items:center; font-size:12px; font-weight:bold; flex-shrink:0;">${idx+1}</div>`;
        if(lDone) iconHtml = `<div style="width:24px; height:24px; border-radius:50%; background:#10b981; color:white; display:flex; justify-content:center; align-items:center; font-size:12px; font-weight:bold; flex-shrink:0;">✓</div>`;
        else if(isActive) iconHtml = `<div style="width:24px; height:24px; border-radius:50%; background:#3b82f6; color:white; display:flex; justify-content:center; align-items:center; font-size:12px; font-weight:bold; flex-shrink:0;">${idx+1}</div>`;

        html += `
        <div class="playlist-item ${isActive?'active':''}" data-action="open-lecture" data-id="${l.id}">
            ${iconHtml}
            <div style="flex:1;">
                <div style="font-size:14px; font-weight:700; color:${isActive?'#60a5fa':'white'}; margin-bottom:4px; line-height:1.3;">${idx+1}강. ${l.title}</div>
                <div style="font-size:12px; color:${lDone?'#10b981':'#64748b'};">${lDone?'수강완료':(p.percent+'% 진행중')}</div>
            </div>
        </div>`;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;

    if (!isDone) {
        clearLectureTimer();
        let currentProg = prog.percent;
        AppState.lectureTimer = setInterval(() => {
            currentProg += 5; 
            const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id);
            if (currentProg >= 90) { 
                currentProg = 100; clearLectureTimer(); 
                AppState.data.users[userIdx].lectureProgress[activeLecture.id] = { percent: 100, done: true }; 
                syncData(); showToast("🎉 수강 완료 인정!"); 
                renderLecturePlayer(); 
            } 
            else { AppState.data.users[userIdx].lectureProgress[activeLecture.id] = { percent: currentProg, done: false }; }
            
            const bar = document.getElementById('live-progress-bar'); const txt = document.getElementById('live-progress-text');
            const topTxt = document.getElementById('player-top-progress');
            if(bar) bar.style.width = currentProg + '%'; if(txt) txt.textContent = currentProg + '%'; if(topTxt) topTxt.textContent = currentProg + '%';
        }, 5000); 
    }
}

// ------------------------- 관리자 대시보드 -------------------------
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab; const data = AppState.data; const set = data.settings || DEFAULT_STATE.settings; const ld = { ...DEFAULT_STATE.landing, ...(data.landing || {}) };
    let html = '<div class="admin-grid">';
    document.querySelectorAll('#admin-top-nav .admin-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));

    if (tab === 'users') {
        html += `<div class="admin-card"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2>👨‍🎓 가입 학생 명단</h2><button class="btn-primary btn-sm" data-action="open-admin-modal" data-mode="add">+ 원생 추가</button></div><div class="table-responsive"><table class="admin-table"><thead><tr><th>이름(ID)</th><th>학교/학년/담당T</th><th>수강 기한</th><th>상태</th><th>관리</th></tr></thead><tbody>${(!data.users||data.users.length===0)?'<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">학생이 없습니다.</td></tr>':data.users.map(u => `<tr><td><strong>${u.name}</strong><br><span style="color:var(--text-muted); font-size:0.85rem;">${u.id}</span></td><td>${u.school||'미기입'}<br><span style="color:var(--text-muted); font-size:0.85rem;">${u.grade||''} · ${u.teacher||'담당 미배정'}</span></td><td><span class="badge-blue">${u.ticketExpiry || '미설정'}</span></td><td><span style="color:${u.active?'#10b981':'#ef4444'}; font-weight:bold;">${u.active ? '정상' : '정지'}</span></td><td><div style="display:flex; gap:5px;"><button class="btn-sm btn-outline" data-action="open-admin-modal" data-mode="edit" data-id="${u.id}">수정</button><button class="btn-sm btn-primary" style="background:#4f46e5;" data-action="open-ai-modal" data-id="${u.id}">✨ AI 리포트</button><button class="btn-sm btn-danger" data-action="delete-user" data-id="${u.id}">삭제</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
        if (AppState.adminModal && AppState.adminModal.isOpen) {
            const mode = AppState.adminModal.mode; const stu = mode === 'edit' ? data.users.find(u => u.id === AppState.adminModal.studentId) : {};
            html += `<div class="modal-overlay"><div class="modal-content"><h2 class="modal-title">${mode === 'add' ? '✨ 신규 원생 추가' : '📝 원생 정보 수정'}</h2><form id="form-admin-student"><input type="text" id="mod-stu-name" class="admin-input" placeholder="학생 이름" required value="${stu.name || ''}"><input type="text" id="mod-stu-id" class="admin-input" placeholder="아이디" required value="${stu.id || ''}" ${mode === 'edit' ? 'disabled' : ''}><input type="password" id="mod-stu-pw" class="admin-input" placeholder="${mode === 'edit' ? '비밀번호 (변경 시에만 입력)' : '초기 비밀번호'}" ${mode === 'add' ? 'required' : ''}><input type="tel" id="mod-stu-phone" class="admin-input" placeholder="학생 전화번호" value="${stu.phone || ''}"><input type="email" id="mod-stu-email" class="admin-input" placeholder="이메일" value="${stu.email || ''}"><div style="display:flex; gap:10px;"><input type="text" id="mod-stu-school" class="admin-input" placeholder="학교명 (예: 대화고)" value="${stu.school ? stu.school.replace('등학교','') : ''}"><select id="mod-stu-grade" class="admin-input" style="color:white;"><option value="중1" ${stu.grade==='중1'?'selected':''}>중1</option><option value="중2" ${stu.grade==='중2'?'selected':''}>중2</option><option value="중3" ${stu.grade==='중3'?'selected':''}>중3</option><option value="고1" ${stu.grade==='고1'?'selected':''}>고1</option><option value="고2" ${stu.grade==='고2'?'selected':''}>고2</option><option value="고3" ${stu.grade==='고3'?'selected':''}>고3</option><option value="대1" ${stu.grade==='대1'?'selected':''}>대1</option><option value="대2" ${stu.grade==='대2'?'selected':''}>대2</option><option value="대3" ${stu.grade==='대3'?'selected':''}>대3</option><option value="대4" ${stu.grade==='대4'?'selected':''}>대4</option></select></div><div style="display:flex; gap:10px;"><input type="date" id="mod-stu-expiry" class="admin-input" value="${stu.ticketExpiry || ''}" placeholder="수강 만료일"><input type="text" id="mod-stu-teacher" class="admin-input" placeholder="담임 선생님" value="${stu.teacher || ''}"></div><div style="display:flex; gap:10px; margin-top:10px;"><button type="button" class="btn-white-outline" style="width:100%; border-color:#334155; color:#94a3b8;" data-action="close-admin-modal">취소</button><button type="submit" class="btn-primary" style="width:100%;">${mode === 'add' ? '추가하기' : '수정 완료'}</button></div></form></div></div>`;
        }
    } 
    else if (tab === 'deploy') {
        const currentMaxWeek = (data.homework && data.homework.length > 0) ? Math.max(...data.homework.map(h => parseInt(h.week) || 1)) : 1;

        html += `
            <div class="admin-card" style="grid-column:1/-1;"><h2>📢 공지 배포 (모든 학생 알림)</h2><form id="form-admin-notice"><input type="text" id="adm-notice-title" class="admin-input" required placeholder="공지 제목"><textarea id="adm-notice-content" class="admin-input" style="height:100px; resize:none;" required placeholder="내용"></textarea><button type="submit" class="btn-primary" style="width:100%;">공지 올리기</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>📝 주간 과제 배포 및 관리</h2><div style="background:#0f172a; padding:15px; border-radius:8px; margin-bottom:20px; font-size:13px; color:#94a3b8; line-height:1.5;">💡 현재 배포된 가장 최신 주차는 <strong style="color:#60a5fa; font-size:15px;">${currentMaxWeek}주차</strong> 입니다.<br>새로운 주차 번호를 배포하면 학생들이 앱을 열 때 자동으로 해당 주차로 화면이 갱신됩니다. (이전 주차 내용도 언제든 추가/수정 가능)</div><form id="form-admin-hw"><select id="hw-target" class="admin-input"><option value="all">전체 배포</option>${(data.users||[]).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select><div style="display:flex; gap:10px;"><div style="flex:1;"><label class="admin-label">주차 번호 (숫자만 기입)</label><input type="number" id="hw-week" class="admin-input" value="${currentMaxWeek}" required style="margin:0;"></div><div style="flex:1;"><label class="admin-label">숙제 제출 날짜 (달력 선택 시 자동 요일 계산)</label><input type="date" id="hw-date" class="admin-input" required style="margin:0;"></div></div><textarea id="hw-desc" class="admin-input" placeholder="과제 내용" required style="height:80px; margin-top:10px;"></textarea><button type="submit" class="btn-primary" style="width:100%;">새 숙제 배포하기</button></form><h3 style="margin-top:40px; margin-bottom:15px; color:#60a5fa; font-size:15px; border-bottom:1px solid #334155; padding-bottom:10px;">등록된 과제 목록 관리 (수정/삭제)</h3><div class="table-responsive"><table class="admin-table" style="min-width:600px;"><thead><tr><th>주차</th><th>날짜(요일)</th><th>내용</th><th>대상</th><th>관리</th></tr></thead><tbody>`;
        if(!data.homework || data.homework.length===0) { html += `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">등록된 과제가 없습니다.</td></tr>`; } 
        else { const sortedHw = [...data.homework].sort((a,b) => parseInt(b.week) - parseInt(a.week) || new Date(a.date) - new Date(b.date)); sortedHw.forEach(h => { html += `<tr><td style="font-weight:bold;">${h.week}주차</td><td>${h.date}<br><span style="font-size:11px; color:#94a3b8;">${h.day}</span></td><td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${h.desc}">${h.desc}</td><td>${h.target==='all'?'전체':h.target}</td><td><button class="btn-sm btn-outline" data-action="edit-admin-hw" data-id="${h.id}">내용 수정</button><button class="btn-sm btn-danger" style="background:#ef4444; border:none; margin-left:5px; color:white;" data-action="delete-admin-hw" data-id="${h.id}">삭제</button></td></tr>`; }); }
        html += `</tbody></table></div></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>💻 동영상 강의 등록</h2><form id="form-admin-lec" style="display:flex; gap:10px;"><input type="text" id="lec-title" class="admin-input" placeholder="강의 제목" required style="margin:0;"><input type="url" id="lec-link" class="admin-input" placeholder="강의 URL" required style="margin:0;"><button type="submit" class="btn-primary" style="width:auto; padding:0 30px;">등록</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>📁 자료실 첨부자료 업로드 (최대 100MB 가능)</h2><form id="form-admin-material" style="display:grid; grid-template-columns:150px 1fr auto; gap:10px; align-items:start;"><select id="mat-cat" class="admin-input" style="margin:0;"><option value="공지">공지</option><option value="교재">교재</option></select><input type="text" id="mat-title" class="admin-input" placeholder="자료명 (제목)" required style="margin:0;"><input type="file" id="mat-file" class="admin-input" style="margin:0; padding:9px;"><textarea id="mat-desc" class="admin-input" placeholder="자료에 대한 간략한 설명" style="grid-column:1/-1; height:60px; resize:none; margin:0;"></textarea><button type="submit" class="btn-primary" style="grid-column:1/-1;">게시 및 파일 업로드</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>💬 학생 과제 제출함</h2>${(!data.hwSubmissions || data.hwSubmissions.length===0) ? '<p style="color:var(--text-muted); text-align:center;">제출된 숙제가 없습니다.</p>' : data.hwSubmissions.map(s => `<div style="border:1px solid var(--border); padding:20px; border-radius:12px; margin-bottom:15px; background:var(--bg-dark);"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><strong>👤 ${s.studentName} 학생 제출본</strong><span style="color:${s.status==='approved'?'#10b981':(s.status==='rejected'?'#ef4444':'#60a5fa')}">${s.status === 'approved' ? '승인' : (s.status === 'rejected' ? '반려' : '대기중')}</span></div><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:15px; border-bottom:1px solid var(--border);">${s.files.map((f) => `<a href="${f.data}" download="${f.name}" style="background:#1e293b; padding:10px 15px; border-radius:8px; font-size:12px; font-weight:600; color:white; border:1px solid #334155; white-space:nowrap;">📄 ${f.name}</a>`).join('')}</div><div style="display:flex; gap:10px;">${s.status === 'pending' ? `<button class="btn-primary btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="approved">✅ 승인</button><button class="btn-primary btn-sm" style="background:#ef4444;" data-action="review-hw" data-subid="${s.id}" data-status="rejected">❌ 반려</button>` : `<button class="btn-text btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="pending">상태 초기화</button>`}</div></div>`).join('')}</div>
        `;
    }
    else if (tab === 'payments') {
        html += `<div class="admin-card"><h2 style="color:#60a5fa; font-size:1.1rem; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:15px;">결제 승인 대기 목록</h2><div class="table-responsive"><table class="admin-table" style="margin-top:10px;"><thead><tr><th>학생명(ID)</th><th>요청 상품</th><th>증명사진</th><th>상태</th></tr></thead><tbody>`;
        if(!data.payments || data.payments.length===0) html += `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">요청없음</td></tr>`;
        else data.payments.forEach(p => html += `<tr><td><strong>${p.userName}</strong><br><span style="font-size:12px; color:var(--text-muted);">${p.userId}</span></td><td>${p.item}</td><td><a href="${p.image}" target="_blank" style="color:#60a5fa; text-decoration:underline; font-size:13px;">사진 보기</a></td><td>${p.status === '승인대기' ? `<button class="btn-primary btn-sm" data-action="approve-payment" data-id="${p.id}">결제 승인</button>` : `<span style="color:#10b981; font-weight:bold;">승인완료</span>`}</td></tr>`);
        html += `</tbody></table></div></div><div class="admin-card"><h2 style="color:#60a5fa; font-size:1.1rem; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:15px;">⚙️ 결제 연동 설정</h2><form id="form-admin-payment-settings"><p class="admin-label">PG 링크 URL</p><input type="text" id="pay-set-pg" class="admin-input" value="${set.payment?.pgUrl||''}"><p class="admin-label" style="margin-top:10px;">무통장 계좌 안내</p><input type="text" id="pay-set-bank" class="admin-input" value="${set.payment?.bankInfo||''}"><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;"><input type="text" id="pay-set-opt1" class="admin-input" value="${set.payment?.opt1||''}" placeholder="옵션1"><input type="text" id="pay-set-opt2" class="admin-input" value="${set.payment?.opt2||''}" placeholder="옵션2"><input type="text" id="pay-set-opt3" class="admin-input" value="${set.payment?.opt3||''}" placeholder="옵션3"><input type="text" id="pay-set-opt4" class="admin-input" value="${set.payment?.opt4||''}" placeholder="옵션4"></div><button type="submit" class="btn-primary" style="width:100%; margin-top:20px; background:#1e293b; color:white; border:1px solid #334155;">결제 설정 적용</button></form></div>`;
    }
    else if (tab === 'settings') {
        const pop = set.popup;
        const rbs = set.rollingBanners || [];
        html += `
        <div class="admin-card" style="grid-column:1/-1;">
            <h2 style="margin-bottom:20px; color:#60a5fa;">📲 시스템 (배너/안내 문구) 설정</h2>
            <form id="form-admin-system" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:white;">학생 숙제 페이지 안내(경고) 문구</h3>
                    <textarea id="set-hw-warning" class="admin-input" style="height:100px; resize:none;" placeholder="숙제 제출 기한 등 안내 문구">${set.hwWarning || "⚠️ 숙제 제출 기한 : 당일 저녁 12시\n⚠️ 늦어지는 경우 미리 사유+인증 필요 (ex. 학원증)\n⚠️ 미제출시 경고 / 경고2회 = 옐로카드 / 옐로카드2회 = 레드카드\n⚠️ 필기가 비어있을 경우 미제출로 간주"}</textarea>
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:white;">학생 홈 상단 공지 배너</h3>
                    <input type="text" id="set-dash-banner" class="admin-input" value="${set.dashBanner}">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;"><h3 style="font-size:1rem; color:white;">학생 로그인 자동 팝업창 (모달 2개 버튼 지원)</h3><label><input type="checkbox" id="set-pop-active" ${pop.active?'checked':''}> 활성화</label></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        <input type="text" id="set-pop-tag" class="admin-input" value="${pop.tag}"><input type="text" id="set-pop-title" class="admin-input" value="${pop.title}"><textarea id="set-pop-desc" class="admin-input" style="grid-column:1/-1; height:60px;">${pop.desc}</textarea>
                        
                        <div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid var(--border);">
                            <h4 style="margin-bottom:10px; font-size:13px; color:#94a3b8;">박스 1 내용 (위)</h4>
                            <input type="text" id="set-pop-b1-t" class="admin-input" value="${pop.b1Title}"><input type="text" id="set-pop-b1-d" class="admin-input" value="${pop.b1Desc}"><input type="text" id="set-pop-b1-url" class="admin-input" value="${pop.b1Url||''}" placeholder="이동할 링크 URL">
                        </div>
                        
                        <div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid var(--border);">
                            <h4 style="margin-bottom:10px; font-size:13px; color:#94a3b8;">박스 2 내용 (아래)</h4>
                            <input type="text" id="set-pop-b2-t" class="admin-input" value="${pop.b2Title}"><input type="text" id="set-pop-b2-d" class="admin-input" value="${pop.b2Desc}"><input type="text" id="set-pop-b2-url" class="admin-input" value="${pop.b2Url||''}" placeholder="이동할 링크 URL">
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn-primary" style="grid-column:1/-1; padding:15px;">시스템 설정 저장</button>
            </form>
        </div>
        <div class="admin-card" style="grid-column:1/-1;">
            <h2 style="margin-bottom:20px; color:#60a5fa;">🌐 랜딩(홈페이지) 실시간 편집</h2>
            <form id="form-admin-settings" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:white;">🔄 랜딩페이지 롤링 배너 설정 (최대 5개)</h3>
                    <p style="font-size:13px; color:#94a3b8; margin-bottom:15px;">좌측 메뉴 탭 이름, 이미지 첨부, 이동 링크를 입력하세요.</p>
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        ${[0,1,2,3,4].map(i => {
                            const b = rbs[i] || {tab: '', img: '', link: ''};
                            return `
                            <div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid var(--border);">
                                <h4 style="margin-bottom:10px; font-size:13px; color:#94a3b8;">배너 ${i+1}</h4>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                    <input type="text" id="rb${i}-tab" class="admin-input" value="${b.tab}" placeholder="좌측 탭 메뉴 이름" style="margin:0;">
                                    <input type="text" id="rb${i}-link" class="admin-input" value="${b.link}" placeholder="클릭 시 이동할 링크 URL" style="margin:0;">
                                </div>
                                <div style="margin-top:10px; display:flex; gap:10px; align-items:center;">
                                    <input type="file" id="rb${i}-file" class="admin-input banner-file-input" accept="image/*" style="margin:0; padding:8px;">
                                    <input type="hidden" id="rb${i}-existing-img" value="${b.img}">
                                    <img id="rb${i}-preview" src="${b.img}" style="height:40px; border-radius:4px; border:1px solid #334155; display:${b.img?'block':'none'};">
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem;">1. 메인 배너 (최상단)</h3>
                    <label class="admin-label">작은 소제목</label><input type="text" id="set-h-sub" class="admin-input" value="${ld.heroSub || ''}">
                    <label class="admin-label">메인 큰 제목</label><textarea id="set-h-tit" class="admin-input" style="height:70px;">${(ld.heroTitle || '').replace(/<br>/g, '\n')}</textarea>
                    <label class="admin-label">제목 아래 간략한 설명</label><input type="text" id="set-h-desc" class="admin-input" value="${ld.heroDesc || ''}">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem;">2. 통계 지표</h3>
                    <label class="admin-label">통계 1 (수치/설명)</label><div style="display:flex; gap:10px;"><input type="text" id="set-s1-n" class="admin-input" value="${ld.s1Num || ''}"><input type="text" id="set-s1-t" class="admin-input" value="${ld.s1Txt || ''}"></div>
                    <label class="admin-label">통계 2 (수치/설명)</label><div style="display:flex; gap:10px;"><input type="text" id="set-s2-n" class="admin-input" value="${ld.s2Num || ''}"><input type="text" id="set-s2-t" class="admin-input" value="${ld.s2Txt || ''}"></div>
                    <label class="admin-label">통계 3 (수치/설명)</label><div style="display:flex; gap:10px;"><input type="text" id="set-s3-n" class="admin-input" value="${ld.s3Num || ''}"><input type="text" id="set-s3-t" class="admin-input" value="${ld.s3Txt || ''}"></div>
                </div>
                <div style="grid-column:1/-1;">
                    <label class="admin-label">중앙 섹션 전체 제목</label><input type="text" id="set-sec-tit" class="admin-input" value="${ld.secTitle || ''}" style="margin:0;">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem;">3. 특징 섹션 (왼쪽)</h3>
                    <label class="admin-label">꼬리표 텍스트 / 색상</label><div style="display:flex; gap:10px;"><input type="text" id="set-f1-b" class="admin-input" value="${ld.f1Badge || ''}"><select id="set-f1-c" class="admin-input"><option value="red" ${ld.f1Col==='red'?'selected':''}>빨강</option><option value="blue" ${ld.f1Col==='blue'?'selected':''}>파랑</option><option value="green" ${ld.f1Col==='green'?'selected':''}>초록</option></select></div>
                    <label class="admin-label">카드 큰 제목</label><input type="text" id="set-f1-t" class="admin-input" value="${ld.f1Title || ''}">
                    <label class="admin-label">카드 세부 설명</label><input type="text" id="set-f1-d" class="admin-input" value="${ld.f1Desc || ''}">
                    <label class="admin-label">우측 이모지</label><input type="text" id="set-f1-e" class="admin-input" value="${ld.f1Emoji || ''}">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem;">4. 특징 섹션 (오른쪽)</h3>
                    <label class="admin-label">꼬리표 텍스트 / 색상</label><div style="display:flex; gap:10px;"><input type="text" id="set-f2-b" class="admin-input" value="${ld.f2Badge || ''}"><select id="set-f2-c" class="admin-input"><option value="red" ${ld.f2Col==='red'?'selected':''}>빨강</option><option value="blue" ${ld.f2Col==='blue'?'selected':''}>파랑</option><option value="green" ${ld.f2Col==='green'?'selected':''}>초록</option></select></div>
                    <label class="admin-label">카드 큰 제목</label><input type="text" id="set-f2-t" class="admin-input" value="${ld.f2Title || ''}">
                    <label class="admin-label">카드 세부 설명</label><input type="text" id="set-f2-d" class="admin-input" value="${ld.f2Desc || ''}">
                    <label class="admin-label">우측 이모지</label><input type="text" id="set-f2-e" class="admin-input" value="${ld.f2Emoji || ''}">
                </div>
                <div style="grid-column:1/-1; background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem;">5. 하단 CTA 배너</h3><input type="text" id="set-b-tit" class="admin-input" value="${ld.botTitle || ''}" style="margin:0;">
                </div>
                <button type="submit" class="btn-primary" style="grid-column:1/-1; padding:15px; font-size:1.1rem;">홈페이지 저장 및 실시간 반영</button>
            </form>
        </div>`;
    }
    html += '</div>'; container.innerHTML = html;
}

// =========================================================
// [통합 위임 핸들러 (클릭/파일/제출)]
// =========================================================
document.body.addEventListener('change', async (e) => {
    // 🔥 이미지 자르기(Cropper) 연동
    if (e.target.classList.contains('banner-file-input')) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const imgTarget = document.getElementById('crop-image-target');
            imgTarget.src = ev.target.result;
            currentCropIdx = e.target.id.replace('rb', '').replace('-file', ''); 
            
            document.getElementById('modal-crop').classList.remove('hidden');
            if(cropper) cropper.destroy();
            cropper = new Cropper(imgTarget, {
                aspectRatio: 21 / 9, 
                viewMode: 1,
            });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; 
        return;
    }

    if (e.target.matches('input[type="file"]')) {
        const files = Array.from(e.target.files || []);
        if(files.length === 0) return;
        const limitSize = 100 * 1024 * 1024;
        if(files.some(f => f.size > limitSize)) { e.target.value = ''; return showToast(`⚠️ 100MB 이하 파일만 첨부 가능합니다.`); }
        showToast("파일 처리 중...");
        try {
            const b64 = await Promise.all(files.map(f => new Promise(res => { const r = new FileReader(); r.onload = ev => res({ name: f.name, data: ev.target.result }); r.readAsDataURL(f); })));
            if (e.target.id === 'pay-req-file') { e.target.dataset.base64 = b64[0].data; showToast("✅ 사진 첨부 완료"); } 
            else if (e.target.dataset.hwid) { if(!AppState.data.hwSubmissions) AppState.data.hwSubmissions = []; AppState.data.hwSubmissions.push({ id: generateId(), hwId: e.target.dataset.hwid, studentId: AppState.currentUser.id, studentName: AppState.currentUser.name, files: b64, status: 'pending' }); syncData(); showToast("✅ 숙제 제출 완료!"); }
        } catch (err) { showToast("❌ 파일 업로드 오류가 발생했습니다."); }
    }
});

document.body.addEventListener('click', (e) => {
    try {
        const actionNode = e.target.closest('[data-action]');
        if (!actionNode) return;
        const action = actionNode.dataset.action;

        // 🔥 이미지 크롭 모달 컨트롤
        if (action === 'close-crop') {
            document.getElementById('modal-crop').classList.add('hidden');
            if(cropper) { cropper.destroy(); cropper = null; }
        }
        else if (action === 'apply-crop') {
            if(!cropper) return;
            const croppedDataUrl = cropper.getCroppedCanvas({ width: 1200 }).toDataURL('image/jpeg', 0.8);
            
            const existingInput = document.getElementById(`rb${currentCropIdx}-existing-img`);
            const previewImg = document.getElementById(`rb${currentCropIdx}-preview`);
            
            if (existingInput) existingInput.value = croppedDataUrl;
            if (previewImg) {
                previewImg.src = croppedDataUrl;
                previewImg.style.display = 'block';
            }
            
            document.getElementById('modal-crop').classList.add('hidden');
            cropper.destroy(); cropper = null;
            showToast("✅ 이미지 자르기 완료 (저장 버튼을 눌러야 반영됩니다)");
        }
        
        else if (action === 'change-banner') { currentBannerIdx = parseInt(actionNode.dataset.idx); updateBannerUI(); startBanner(); }
        else if (action === 'nav') switchView(actionNode.dataset.target);
        else if (action === 'auth-toggle') {
            if(AppState.currentUser) { AppState.currentUser = null; sessionStorage.removeItem('studycampus_session'); showToast("로그아웃 되었습니다."); switchView('landing'); }
            else { switchView('auth'); switchAuthMode('login'); }
        }
        else if (action === 'auth-register') {
            if (AppState.currentUser) switchView(AppState.currentUser.role === 'admin' ? 'admin' : 'student');
            else { switchView('auth'); switchAuthMode('register'); }
        }
        else if (action === 'switch-auth') switchAuthMode(actionNode.dataset.mode);
        else if (action === 'switch-admin-tab') { AppState.adminTab = actionNode.dataset.tab; renderAdminDashboard(); }
        else if (action === 'switch-student-tab') { clearLectureTimer(); AppState.studentTab = actionNode.dataset.tab; renderStudentDashboard(); }
        else if (action === 'back-to-mypage') { AppState.studentTab = 'mypage'; switchView('student'); }
        
        else if (action === 'open-student-edit') {
            const me = AppState.data.users.find(u => u.id === AppState.currentUser.id) || AppState.currentUser;
            document.getElementById('stu-edit-name').value = me.name || ''; 
            document.getElementById('stu-edit-id').value = me.id || ''; 
            document.getElementById('stu-edit-phone').value = me.phone || ''; 
            document.getElementById('stu-edit-email').value = me.email || ''; 
            document.getElementById('stu-edit-school').value = me.school ? me.school.replace('등학교','') : ''; 
            document.getElementById('stu-edit-grade').value = me.grade || '고2'; document.getElementById('stu-edit-pw').value = '';
            document.getElementById('modal-student-edit').classList.remove('hidden');
        }
        else if (action === 'close-student-edit') { document.getElementById('modal-student-edit').classList.add('hidden'); }
        else if (action === 'toggle-notif') { const drop = document.getElementById('notif-dropdown'); if(drop) { drop.classList.toggle('hidden'); } }
        else if (action === 'read-all-notif') { let upd = false; (AppState.data.alerts||[]).forEach(a => { if(a.studentId === AppState.currentUser.id && !a.read) { a.read = true; upd = true; }}); if(upd) { syncData(); document.getElementById('notif-badge').classList.add('hidden'); showToast("모두 읽음 처리되었습니다."); renderStudentDashboard(); } }
        else if (action === 'delete-all-notif') { if(confirm("모든 알림을 삭제하시겠습니까?")) { AppState.data.alerts = (AppState.data.alerts||[]).filter(a => a.studentId !== AppState.currentUser.id); syncData(); document.getElementById('notif-badge').classList.add('hidden'); showToast("알림이 모두 삭제되었습니다."); renderStudentDashboard(); } }
        else if (action === 'close-popup') { document.getElementById('student-auto-popup').classList.add('hidden'); sessionStorage.setItem('studycampus_popup_shown', 'true'); }
        else if (action === 'hide-popup-today') { localStorage.setItem('studycampus_hide_popup', new Date().toISOString().split('T')[0]); document.getElementById('student-auto-popup').classList.add('hidden'); showToast("오늘 하루 보지 않습니다."); }
        else if (action === 'change-week') { const dir = parseInt(actionNode.dataset.dir); let newWeek = AppState.currentHwWeekNumber + dir; if (newWeek < 1) newWeek = 1; AppState.currentHwWeekNumber = newWeek; renderStudentDashboard(); }
        else if (action === 'set-mat-cat') { AppState.materialCategory = actionNode.dataset.cat; renderStudentDashboard(); }
        else if (action === 'open-post') { AppState.activePostId = actionNode.dataset.id; renderStudentDashboard(); }
        else if (action === 'close-post') { AppState.activePostId = null; renderStudentDashboard(); }
        else if (action === 'edit-post') { const post = AppState.data.community.find(c => c.id === actionNode.dataset.id); if(post) { const newText = prompt("게시물 내용을 수정하세요:", post.content); if(newText !== null && newText.trim() !== "") { post.content = newText.trim(); syncData(); showToast("수정되었습니다."); renderStudentDashboard(); } } }
        else if (action === 'delete-post') { if(confirm("이 게시물을 완전히 삭제하시겠습니까?")) { AppState.data.community = AppState.data.community.filter(c => c.id !== actionNode.dataset.id); if(AppState.activePostId === actionNode.dataset.id) AppState.activePostId = null; syncData(); showToast("삭제되었습니다."); renderStudentDashboard(); } }
        else if (action === 'toggle-like') { const post = AppState.data.community.find(c => c.id === actionNode.dataset.id); if(post) { if(!post.likes) post.likes = []; const meId = AppState.currentUser.id; const idx = post.likes.indexOf(meId); if(idx > -1) post.likes.splice(idx, 1); else post.likes.push(meId); syncData(); } }
        
        else if (action === 'open-lecture') { AppState.activeLecture = AppState.data.lectures.find(l => l.id === actionNode.dataset.id); switchView('lecture-player'); }
        else if (action === 'close-lecture') { switchView('student'); }
        else if (action === 'play-video') {
            clearLectureTimer(); const lecId = AppState.activeLecture.id; const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id); if(!AppState.data.users[userIdx].lectureProgress) AppState.data.users[userIdx].lectureProgress = {};
            let currentProg = AppState.data.users[userIdx].lectureProgress[lecId]?.percent || 0;
            actionNode.innerHTML = '⏸️'; showToast("수강 기록 시작됨");
            
            AppState.lectureTimer = setInterval(() => {
                currentProg += 5; 
                if (currentProg >= 90) { currentProg = 100; clearLectureTimer(); AppState.data.users[userIdx].lectureProgress[lecId] = { percent: 100, done: true }; syncData(); showToast("🎉 수강 완료 인정!"); renderLecturePlayer(); } 
                else { AppState.data.users[userIdx].lectureProgress[lecId] = { percent: currentProg, done: false }; }
                const bar = document.getElementById('live-progress-bar'); const txt = document.getElementById('live-progress-text');
                if(bar) bar.style.width = currentProg + '%'; if(txt) txt.textContent = currentProg + '%';
            }, 5000); 
        }
        else if (action === 'trigger-file') { const fi = document.getElementById(`hw-file-${actionNode.dataset.id}`); if(fi) fi.click(); }
        else if (action === 'cancel-hw') { AppState.data.hwSubmissions = AppState.data.hwSubmissions.filter(s => s.id !== actionNode.dataset.subid); syncData(); showToast("기존 제출본 삭제됨"); }
        else if (action === 'delete-account') { if(confirm("탈퇴하시면 현재까지 모든 데이터가 삭제되며 되돌릴 수 없습니다. 정말 탈퇴하시겠습니까?")) { AppState.data.users = AppState.data.users.filter(u => u.id !== AppState.currentUser.id); syncData(); sessionStorage.removeItem('studycampus_session'); AppState.currentUser = null; switchView('landing'); } }
        
        // 관리자
        else if (action === 'edit-admin-hw') { const hw = AppState.data.homework.find(h => h.id === actionNode.dataset.id); if(hw) { const newDesc = prompt("과제 내용을 수정하세요:", hw.desc); if(newDesc !== null && newDesc.trim() !== "") { hw.desc = newDesc.trim(); syncData(); showToast("수정되었습니다."); renderAdminDashboard(); } } }
        else if (action === 'delete-admin-hw') { if(confirm("해당 주차의 과제를 완전히 삭제하시겠습니까?")) { AppState.data.homework = AppState.data.homework.filter(h => h.id !== actionNode.dataset.id); syncData(); showToast("과제가 삭제되었습니다."); renderAdminDashboard(); } }
        else if (action === 'toggle-user') { const user = AppState.data.users.find(u => String(u.id) === String(actionNode.dataset.id)); if(user) user.active = !user.active; syncData(); showToast("상태가 변경되었습니다."); }
        else if (action === 'delete-user') { if(confirm("정말 삭제할까요?")) { AppState.data.users = AppState.data.users.filter(u => u.id !== actionNode.dataset.id); syncData(); showToast("삭제되었습니다."); renderAdminDashboard(); } }
        else if (action === 'open-admin-modal') { AppState.adminModal = { isOpen: true, mode: actionNode.dataset.mode, studentId: actionNode.dataset.id || null }; renderAdminDashboard(); }
        else if (action === 'close-admin-modal') { AppState.adminModal.isOpen = false; renderAdminDashboard(); }
        else if (action === 'review-hw') { const sub = AppState.data.hwSubmissions.find(s => s.id === actionNode.dataset.subid); if(sub) { sub.status = actionNode.dataset.status; syncData(); showToast("검사 상태 변경됨"); } }
        else if (action === 'approve-payment') { 
            const p = AppState.data.payments.find(p => p.id === actionNode.dataset.id); 
            if(p) { 
                p.status = '승인완료'; 
                let addMonths = 0;
                if(p.item.includes('1개월')) addMonths = 1; else if(p.item.includes('3개월')) addMonths = 3; else if(p.item.includes('6개월')) addMonths = 6;
                const u = AppState.data.users.find(user => user.id === p.userId);
                if(u) {
                    let currentExp = u.ticketExpiry ? new Date(u.ticketExpiry) : new Date();
                    if(currentExp < new Date()) currentExp = new Date(); 
                    currentExp.setMonth(currentExp.getMonth() + addMonths);
                    u.ticketExpiry = currentExp.toISOString().split('T')[0];
                }
                syncData(); showToast("결제가 승인되고 수강권이 연장되었습니다!"); renderAdminDashboard();
            } 
        }
        else if (action === 'open-ai-modal') { AppState.aiModal = { isOpen: true, studentId: actionNode.dataset.id }; document.getElementById('modal-ai-report').classList.remove('hidden'); document.getElementById('ai-report-textarea').value = ''; }
        else if (action === 'close-ai-modal') { AppState.aiModal.isOpen = false; document.getElementById('modal-ai-report').classList.add('hidden'); }
        else if (action === 'generate-ai-text') {
            const sid = AppState.aiModal.studentId; const student = AppState.data.users.find(u => u.id === sid); 
            const hwSub = (AppState.data.hwSubmissions||[]).filter(s => s.studentId === sid);
            const hwTotal = (AppState.data.homework||[]).filter(h => h.target === 'all' || h.target === sid).length;
            const lecProg = Object.values(student.lectureProgress||{});
            const lecDoneCount = lecProg.filter(p => p.done).length;

            let hwEval = hwSub.length >= hwTotal && hwTotal > 0 ? "모든 과제를 성실하게 수행하고 있습니다." : "일부 과제가 누락되어 꾸준한 제출 관리가 필요합니다.";
            let lecEval = lecDoneCount > 0 ? "강의 수강 진도도 정상적으로 따라오고 있습니다." : "아직 완료된 강의가 부족하여 적극적인 수강이 요구됩니다.";

            const aiText = `[AI 주간 분석 리포트 - ${student.name} 학생]\n\n■ 주간 학습 통계\n- 과제 제출율: ${hwSub.length}/${hwTotal}\n- 완료한 강의: ${lecDoneCount}건\n\n■ AI 학습 태도 분석\n${student.name} 학생은 이번 주 ${hwEval} ${lecEval}\n특히 ${hwSub.length > 0 ? '제출된 과제의 완성도가 높으며, ' : '학습의 시작인 과제 제출을 우선순위로 두어야 하며, '}수업 내용에 대한 이해도가 전반적으로 ${lecDoneCount > 0 ? '우수합니다' : '형성되는 단계입니다'}.\n\n■ 맞춤형 피드백\n다음 주에는 취약한 유형을 집중적으로 복습하고, 오답 노트를 꼼꼼히 작성하는 것을 추천합니다. 지금의 페이스를 유지한다면 다음 테스트에서 좋은 성과를 기대할 수 있습니다.`;
            document.getElementById('ai-report-textarea').value = aiText;
        }
        else if (action === 'send-ai-report') {
            const text = document.getElementById('ai-report-textarea').value; if(!text) return showToast("내용을 작성해주세요.");
            if(!AppState.data.reports) AppState.data.reports = []; if(!AppState.data.alerts) AppState.data.alerts = [];
            AppState.data.reports.unshift({ id: generateId(), studentId: AppState.aiModal.studentId, content: text, date: new Date().toISOString().split('T')[0] });
            AppState.data.alerts.unshift({ id: generateId(), studentId: AppState.aiModal.studentId, title: "주간 분석 리포트 도착", content: "새로운 맞춤 학습 리포트가 등록되었습니다.", read: false, date: new Date().toISOString().split('T')[0] });
            syncData(); showToast("성공적으로 발송되었습니다!"); document.querySelector('[data-action="close-ai-modal"]').click();
        }
    } catch(err) { console.error("클릭 이벤트 내부 에러 처리:", err); }
});

// 폼(Form) 제출 이벤트 제어
document.body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(document.activeElement) document.activeElement.blur(); 

    try {
        if(e.target.id === 'form-login') {
            const id = document.getElementById('login-id').value.trim(); const pw = document.getElementById('login-pw').value.trim();
            if(id === 'studycampus' && pw === 'studycampus26') { AppState.currentUser = { id: 'admin', name: '최고관리자', role: 'admin' }; sessionStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); switchView('admin'); } 
            else {
                const user = (AppState.data.users||[]).find(u => u.id === id);
                if(user && user.active && (!user.pw || user.pw === pw)) { AppState.currentUser = user; sessionStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); sessionStorage.removeItem('studycampus_popup_shown'); switchView('student'); } 
                else showToast("계정 정보나 비밀번호를 확인해주세요.");
            }
        }
        else if(e.target.id === 'form-register') {
            const id = document.getElementById('reg-id').value.trim();
            if(!AppState.data.users) AppState.data.users = []; if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("이미 존재하는 아이디입니다.");
            const d = new Date(); d.setDate(d.getDate() + 30);
            const normalizedSchool = normalizeSchool(document.getElementById('reg-school').value);
            AppState.data.users.push({ id, name: document.getElementById('reg-name').value || id, phone: document.getElementById('reg-phone').value.trim(), email: document.getElementById('reg-email').value.trim(), pw: document.getElementById('reg-pw').value, school: normalizedSchool, grade: document.getElementById('reg-grade').value, role: 'student', active: true, xp: 0, ticketExpiry: d.toISOString().split('T')[0] });
            syncData(); showToast("가입 완료! 로그인 해주세요."); switchAuthMode('login');
        }
        else if(e.target.id === 'form-find-id') {
            const n = document.getElementById('find-name').value.trim(); const p = document.getElementById('find-phone').value.trim();
            const foundUser = (AppState.data.users||[]).find(u => u.name === n && u.phone === p);
            if(foundUser) alert(`가입된 아이디는 [ ${foundUser.id} ] 입니다.`);
            else alert("일치하는 회원 정보가 없습니다.");
        }
        else if(e.target.id === 'form-reset-pw') {
            const id = document.getElementById('reset-id').value.trim(); const p = document.getElementById('reset-phone').value.trim();
            const newPw = document.getElementById('reset-new-pw').value.trim(); const confirmPw = document.getElementById('reset-new-pw-confirm').value.trim();
            if(newPw !== confirmPw) return showToast("새 비밀번호가 서로 일치하지 않습니다.");
            const userIdx = (AppState.data.users||[]).findIndex(u => u.id === id && u.phone === p);
            if(userIdx > -1) {
                AppState.data.users[userIdx].pw = newPw;
                syncData(); showToast("비밀번호가 성공적으로 변경되었습니다."); switchAuthMode('login');
            } else alert("일치하는 회원 정보가 없습니다.");
        }
        else if(e.target.id === 'form-student-edit') {
            const name = document.getElementById('stu-edit-name').value.trim(); const pw = document.getElementById('stu-edit-pw').value.trim(); const school = normalizeSchool(document.getElementById('stu-edit-school').value); const grade = document.getElementById('stu-edit-grade').value.trim();
            const phone = document.getElementById('stu-edit-phone').value.trim(); const email = document.getElementById('stu-edit-email').value.trim();
            const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id);
            if(userIdx > -1) { 
                AppState.data.users[userIdx].name = name; AppState.data.users[userIdx].school = school; AppState.data.users[userIdx].grade = grade; 
                AppState.data.users[userIdx].phone = phone; AppState.data.users[userIdx].email = email;
                if(pw) AppState.data.users[userIdx].pw = pw; 
                AppState.currentUser = AppState.data.users[userIdx]; sessionStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); 
            } 
            showToast("회원 정보가 수정되었습니다."); document.getElementById('modal-student-edit').classList.add('hidden'); syncData(); renderCurrentView();
        }
        else if(e.target.id === 'form-payment-request') {
            const fileInput = document.getElementById('pay-req-file'); const b64 = fileInput.dataset.base64; if(!b64) return showToast("사진을 첨부해주세요.");
            if(!AppState.data.payments) AppState.data.payments = [];
            AppState.data.payments.unshift({ id: generateId(), userId: AppState.currentUser.id, userName: AppState.currentUser.name, phone: document.getElementById('pay-req-phone').value, item: document.getElementById('pay-req-item').value, amount: "별도", image: b64, status: '승인대기', date: new Date().toISOString().split('T')[0] });
            syncData(); showToast("결제 승인 요청 전송됨"); AppState.studentTab = 'mypage'; switchView('student'); e.target.reset();
        }
        else if(e.target.id === 'form-admin-payment-settings') {
            if(!AppState.data.settings) AppState.data.settings = {};
            AppState.data.settings.payment = { pgUrl: document.getElementById('pay-set-pg').value, bankInfo: document.getElementById('pay-set-bank').value, opt1: document.getElementById('pay-set-opt1').value, opt2: document.getElementById('pay-set-opt2').value, opt3: document.getElementById('pay-set-opt3').value, opt4: document.getElementById('pay-set-opt4').value };
            syncData(); showToast("결제 설정이 즉시 반영되었습니다.");
        }
        else if(e.target.id === 'form-admin-student') {
            const mode = AppState.adminModal.mode; const id = document.getElementById('mod-stu-id').value.trim(); const name = document.getElementById('mod-stu-name').value.trim(); const pw = document.getElementById('mod-stu-pw').value.trim(); 
            const phone = document.getElementById('mod-stu-phone').value.trim(); const email = document.getElementById('mod-stu-email').value.trim();
            const school = normalizeSchool(document.getElementById('mod-stu-school').value); const grade = document.getElementById('mod-stu-grade').value.trim(); const expiry = document.getElementById('mod-stu-expiry').value; const teacher = document.getElementById('mod-stu-teacher').value.trim();

            if(!AppState.data.users) AppState.data.users = [];
            if (mode === 'add') {
                if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("존재하는 아이디입니다.");
                AppState.data.users.unshift({ id, name, pw, phone, email, school, grade, teacher, role: 'student', active: true, xp: 0, ticketExpiry: expiry || '' }); showToast("원생이 추가되었습니다.");
            } else if (mode === 'edit') {
                const userIdx = AppState.data.users.findIndex(u => u.id === AppState.adminModal.studentId);
                if(userIdx > -1) { AppState.data.users[userIdx].name = name; AppState.data.users[userIdx].phone = phone; AppState.data.users[userIdx].email = email; AppState.data.users[userIdx].school = school; AppState.data.users[userIdx].grade = grade; AppState.data.users[userIdx].teacher = teacher; AppState.data.users[userIdx].ticketExpiry = expiry || ''; if(pw) AppState.data.users[userIdx].pw = pw; } showToast("정보가 수정되었습니다.");
            }
            AppState.adminModal.isOpen = false; syncData(); renderAdminDashboard();
        }
        else if(e.target.id === 'form-community') {
            if (!AppState.data.community) AppState.data.community = [];
            AppState.data.community.unshift({ id: generateId(), authorId: AppState.currentUser.id, author: AppState.currentUser.name, content: document.getElementById('comm-text').value, date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), likes: [], comments: [] });
            syncData(); showToast("게시물이 등록되었습니다."); e.target.reset();
        }
        else if(e.target.id === 'form-comment') {
            const post = AppState.data.community.find(c => c.id === AppState.activePostId); if(!post.comments) post.comments = [];
            post.comments.push({ id: generateId(), author: AppState.currentUser.name, content: document.getElementById('comment-text').value, date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }); syncData(); showToast("댓글 작성됨"); document.getElementById('comment-text').value = '';
        }
        else if(e.target.id === 'form-admin-material') {
            const fileInput = document.getElementById('mat-file'); const file = fileInput.files[0]; let fileData = null; let fileName = '';
            if (file) { if(file.size > 100 * 1024 * 1024) return showToast('⚠️ 100MB 이하만 가능'); showToast("서버 전송 중... (용량이 클수록 시간이 걸립니다)"); fileData = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); }); fileName = file.name; }
            if(!AppState.data.materials) AppState.data.materials = []; AppState.data.materials.unshift({ id: generateId(), category: document.getElementById('mat-cat').value, title: document.getElementById('mat-title').value, desc: document.getElementById('mat-desc').value, fileData, fileName }); syncData(); showToast("업로드 완료"); e.target.reset();
        }
        else if(e.target.id === 'form-admin-hw') {
            if(!AppState.data.homework) AppState.data.homework = []; const tVal = document.getElementById('hw-target').value; const hwDate = document.getElementById('hw-date').value; const weekDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']; const dayString = hwDate ? weekDays[new Date(hwDate).getDay()] : '요일정보 없음';
            AppState.data.homework.unshift({ id: generateId(), target: tVal, type: tVal === 'all' ? 'all' : 'individual', week: document.getElementById('hw-week').value, date: hwDate, day: dayString, desc: document.getElementById('hw-desc').value });
            if(!AppState.data.notices) AppState.data.notices = []; AppState.data.notices.unshift({ id: generateId(), title: "📝 신규 숙제 배포", content: `${document.getElementById('hw-week').value} 숙제 알림`, date: new Date().toISOString() }); syncData(); showToast("배포 완료"); e.target.reset();
        }
        else if(e.target.id === 'form-admin-notice') {
            if(!AppState.data.notices) AppState.data.notices = []; AppState.data.notices.unshift({ id: generateId(), title: document.getElementById('adm-notice-title').value, content: document.getElementById('adm-notice-content').value, date: new Date().toISOString() }); syncData(); showToast("공지 완료"); e.target.reset();
        }
        else if(e.target.id === 'form-admin-lec') {
            if(!AppState.data.lectures) AppState.data.lectures = []; AppState.data.lectures.push({ id: generateId(), title: document.getElementById('lec-title').value, link: document.getElementById('lec-link').value }); syncData(); showToast("강의 등록 완료"); e.target.reset();
        }
        else if(e.target.id === 'form-admin-system' || e.target.id === 'form-admin-settings') {
            if(!AppState.data.settings) AppState.data.settings = {}; 
            
            if(e.target.id === 'form-admin-system') {
                AppState.data.settings.dashBanner = document.getElementById('set-dash-banner').value;
                AppState.data.settings.hwWarning = document.getElementById('set-hw-warning').value;
                AppState.data.settings.popup = { active: document.getElementById('set-pop-active').checked, tag: document.getElementById('set-pop-tag').value, title: document.getElementById('set-pop-title').value, desc: document.getElementById('set-pop-desc').value, b1Title: document.getElementById('set-pop-b1-t').value, b1Desc: document.getElementById('set-pop-b1-d').value, b1Url: document.getElementById('set-pop-b1-url').value, b2Title: document.getElementById('set-pop-b2-t').value, b2Desc: document.getElementById('set-pop-b2-d').value, b2Url: document.getElementById('set-pop-b2-url').value };
            }
            if(e.target.id === 'form-admin-settings') {
                const rb = [];
                for(let i=0; i<5; i++) {
                    const tab = document.getElementById(`rb${i}-tab`).value.trim();
                    const link = document.getElementById(`rb${i}-link`).value.trim();
                    const existingImg = document.getElementById(`rb${i}-existing-img`).value;
                    if(tab || existingImg) { rb.push({tab, img: existingImg, link}); }
                }
                AppState.data.settings.rollingBanners = rb;

                AppState.data.landing = {
                    heroSub: document.getElementById('set-h-sub').value, heroTitle: document.getElementById('set-h-tit').value.replace(/\n/g, '<br>'), heroDesc: document.getElementById('set-h-desc').value, s1Num: document.getElementById('set-s1-n').value, s1Txt: document.getElementById('set-s1-t').value, s2Num: document.getElementById('set-s2-n').value, s2Txt: document.getElementById('set-s2-t').value, s3Num: document.getElementById('set-s3-n').value, s3Txt: document.getElementById('set-s3-t').value,
                    secTitle: document.getElementById('set-sec-tit').value,
                    f1Badge: document.getElementById('set-f1-b').value, f1Col: document.getElementById('set-f1-c').value, f1Title: document.getElementById('set-f1-t').value, f1Desc: document.getElementById('set-f1-d').value, f1Emoji: document.getElementById('set-f1-e').value, f2Badge: document.getElementById('set-f2-b').value, f2Col: document.getElementById('set-f2-c').value, f2Title: document.getElementById('set-f2-t').value, f2Desc: document.getElementById('set-f2-d').value, f2Emoji: document.getElementById('set-f2-e').value, botTitle: document.getElementById('set-b-tit').value
                };
            }
            syncData(); showToast("저장되었습니다! 홈페이지에 즉시 반영됩니다.");
        }
    } catch(err) {
        console.error("폼 제출 차단 오류 해결:", err);
        showToast("처리 중 데이터 에러가 발생했습니다.");
    }
});

// 🔥 새로고침 시 로그인(세션) 자동 유지, 창 닫으면 자동 로그아웃되도록 적용 완료
document.addEventListener('DOMContentLoaded', () => {
    try {
        const session = sessionStorage.getItem('studycampus_session');
        if (session) AppState.currentUser = JSON.parse(session);
    } catch (e) {}

    if (AppState.currentUser) {
        document.querySelectorAll('.global-element').forEach(el => el.classList.add('hidden'));
        if (AppState.currentUser.role === 'admin') {
            AppState.adminTab = 'users';
            switchView('admin');
        } else {
            AppState.studentTab = 'home';
            switchView('student');
        }
    } else {
        document.querySelectorAll('.global-element').forEach(el => el.classList.remove('hidden'));
        switchView('landing');
    }
});
