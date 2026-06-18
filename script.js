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
        dashBanner: "새로운 온라인 학습 시스템 오픈! 완벽한 밀착 관리를 경험하세요.",
        payment: { pgUrl: "", bankInfo: "[하나은행] 342-910508-31507", opt1: "1개월-10만", opt2: "", opt3: "", opt4: "" },
        popup: { active: false, tag: "이벤트", title: "함께 만드는 베타에 초대합니다", desc: "의견을 남겨주시면 큰 도움이 됩니다.", b1Title: "오픈채팅방 피드백", b1Desc: "추가 무료 크레딧을 드려요.", b2Title: "전화·문자 문의", b2Desc: "24시간 문의 가능해요.", btnUrl: "http://pf.kakao.com/_xdxnxfXX" }
    },
    landing: { heroSub: "STUDY CAMPUS LEARNING SYSTEM", heroTitle: "성적 향상의 해답<br>프리미엄 온라인 학원", heroDesc: "1:1 관리 시스템.", s1Num: "260", s1Txt: "수강", s2Num: "2등급", s2Txt: "상승", s3Num: "98점", s3Txt: "수능", secTitle: "왜 StudyCampus 인가요?", f1Badge: "문제", f1Col: "red", f1Title: "성적이 안 오르는 이유", f1Desc: "일방적인 강의 시청, 피드백 없는 숙제", f1Emoji: "😫", f2Badge: "해결", f2Col: "blue", f2Title: "체계적인 온라인 밀착 관리", f2Desc: "누구나 포기하지 않고 따라오는 커리큘럼", f2Emoji: "💡", botTitle: "지금 StudyCampus와 시작하세요" }
};

const AppState = {
    data: DEFAULT_STATE,
    currentUser: null, currentView: 'landing', authMode: 'login', studentTab: 'home', adminTab: 'users',
    activeLecture: null, lectureTimer: null, currentHwWeekNumber: 1, materialCategory: '전체', activePostId: null,
    adminModal: { isOpen: false, mode: 'add', studentId: null },
    aiModal: { isOpen: false, studentId: null }
};

// ------------------------- 유틸리티 -------------------------
function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.remove(), 2500);
}
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
function getCurrentWeekString(d = new Date()) { return `${d.getMonth() + 1}월 ${Math.ceil((d.getDate() - 1 + new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 1) / 7)}주차`; }
function clearLectureTimer() { if(AppState.lectureTimer) { clearInterval(AppState.lectureTimer); AppState.lectureTimer = null; } }

// 🔥 [핵심 추가] 학교 이름 자동 정규화 함수 ('~고' 입력 시 자동으로 '~고등학교'로 변경)
function normalizeSchool(name) {
    let s = name.trim();
    if(s.endsWith('고')) s += '등학교';
    return s;
}

// ------------------------- 파이어베이스 (실시간 동기화) -------------------------
const dbRef = ref(db, 'studycampus_data');
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) AppState.data = serverData;
    else set(dbRef, AppState.data);

    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    const isModalOpen = document.querySelector('.modal-overlay:not(.hidden)') !== null;
    
    if (!isTyping && !isModalOpen) {
        renderLandingPage();
        renderCurrentView();
    }
});

function syncData() { set(dbRef, AppState.data); }

// ------------------------- 라우팅 -------------------------
function switchView(viewName) {
    clearLectureTimer(); 
    AppState.activeLecture = null;
    
    AppState.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if(targetView) targetView.classList.remove('hidden');
    
    if (viewName === 'auth') switchAuthMode('login');
    const isAppView = viewName === 'student' || viewName === 'admin' || viewName === 'payment';
    document.querySelectorAll('.global-element').forEach(el => el.classList.toggle('hidden', isAppView));
    
    if(!isAppView) renderNavbar();
    if (viewName === 'student') checkAndShowPopup();
    
    renderCurrentView();
}

function switchAuthMode(mode) {
    AppState.authMode = mode;
    document.getElementById('modal-login').classList.toggle('hidden', mode !== 'login');
    document.getElementById('modal-register').classList.toggle('hidden', mode !== 'register');
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
}

function renderLandingPage() {
    const ld = AppState.data.landing || DEFAULT_STATE.landing;
    document.getElementById('ld-hero-sub').textContent = ld.heroSub; document.getElementById('ld-hero-title').innerHTML = ld.heroTitle; document.getElementById('ld-hero-desc').textContent = ld.heroDesc;
    document.getElementById('ld-s1-n').textContent = ld.s1Num; document.getElementById('ld-s1-t').textContent = ld.s1Txt; document.getElementById('ld-s2-n').textContent = ld.s2Num; document.getElementById('ld-s2-t').textContent = ld.s2Txt; document.getElementById('ld-s3-n').textContent = ld.s3Num; document.getElementById('ld-s3-t').textContent = ld.s3Txt;
    document.getElementById('ld-sec-title').textContent = ld.secTitle;
    document.getElementById('ld-f1-b').textContent = ld.f1Badge; document.getElementById('ld-f1-b').className = 'badge-' + ld.f1Col; document.getElementById('ld-f1-t').textContent = ld.f1Title; document.getElementById('ld-f1-d').textContent = ld.f1Desc; document.getElementById('ld-f1-e').textContent = ld.f1Emoji;
    document.getElementById('ld-f2-b').textContent = ld.f2Badge; document.getElementById('ld-f2-b').className = 'badge-' + ld.f2Col; document.getElementById('ld-f2-t').textContent = ld.f2Title; document.getElementById('ld-f2-d').textContent = ld.f2Desc; document.getElementById('ld-f2-e').textContent = ld.f2Emoji;
    document.getElementById('ld-bot-title').textContent = ld.botTitle;
}

function renderPaymentCenter() {
    document.getElementById('pay-req-name').value = AppState.currentUser.name;
    const paySet = AppState.data.settings?.payment || { pgUrl: "", bankInfo: "[하나은행] 342-910508-31507", opt1: "1개월-10만", opt2: "", opt3: "", opt4: "" };
    document.getElementById('payment-bank-info').textContent = paySet.bankInfo;
    
    const pgArea = document.getElementById('payment-pg-area');
    const btnPg = document.getElementById('btn-pg-link');
    if(paySet.pgUrl) { pgArea.classList.remove('hidden'); btnPg.onclick = () => window.open(paySet.pgUrl, '_blank'); } 
    else { pgArea.classList.add('hidden'); }

    const sel = document.getElementById('pay-req-item');
    sel.innerHTML = '';
    [paySet.opt1, paySet.opt2, paySet.opt3, paySet.opt4].forEach(opt => {
        if(opt) sel.innerHTML += `<option value="${opt}">${opt}</option>`;
    });
}

function checkAndShowPopup() {
    const setPopup = AppState.data.settings?.popup || DEFAULT_STATE.settings.popup;
    if (!setPopup.active || localStorage.getItem('studycampus_hide_popup') === new Date().toISOString().split('T')[0] || sessionStorage.getItem('studycampus_popup_shown')) return;
    document.getElementById('pop-tag').textContent = setPopup.tag; document.getElementById('pop-title').textContent = setPopup.title; document.getElementById('pop-desc').textContent = setPopup.desc;
    document.getElementById('pop-b1-t').textContent = setPopup.b1Title; document.getElementById('pop-b1-d').innerHTML = setPopup.b1Desc; document.getElementById('pop-b2-t').textContent = setPopup.b2Title; document.getElementById('pop-b2-d').textContent = setPopup.b2Desc; document.getElementById('pop-btn').dataset.url = setPopup.btnUrl;
    document.getElementById('student-auto-popup').classList.remove('hidden');
}

// =========================================================
// [학생 대시보드 렌더링]
// =========================================================
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const { currentUser, data, studentTab } = AppState;
    const me = (data.users || []).find(u => u.id === currentUser.id) || currentUser;
    let html = '';

    document.querySelectorAll('#student-bottom-nav .stu-nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === studentTab));
    
    // 알림 리스트 렌더링
    const notifList = document.getElementById('notif-list');
    const myAlerts = (data.alerts || []).filter(a => a.studentId === me.id);
    const globalNotices = (data.notices || []).map(n => ({...n, type: 'notice'}));
    const combinedNotifs = [...myAlerts, ...globalNotices].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(notifList) {
        if(combinedNotifs.length === 0) notifList.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">새로운 알림이 없습니다.</div>`;
        else {
            notifList.innerHTML = combinedNotifs.slice(0, 8).map(n => `<div class="notif-item"><span style="font-size:18px;">${n.title?'📝':'📢'}</span><div><strong style="display:block; color:white; margin-bottom:4px;">${n.title || n.content.substring(0,15)}</strong><span style="color:var(--text-muted);">${n.content.substring(0,30)}...</span></div></div>`).join('');
            const unreadCount = myAlerts.filter(a => !a.read).length;
            const badge = document.getElementById('notif-badge');
            if(unreadCount > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');
        }
    }

    if (studentTab === 'home') {
        const dashBanner = data.settings?.dashBanner || '';
        if (dashBanner) html += `<div class="stu-banner-top"><span style="font-size:18px;">📢</span> <span>${dashBanner}</span></div>`;
        html += `
        <div class="stu-banner-blue">
            <div style="position:absolute; right:-20px; bottom:-20px; width:150px; height:150px; background:rgba(255,255,255,0.1); border-radius:50%;"></div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1;">
                <div>
                    <div style="font-size:12px; font-weight:800; margin-bottom:8px; opacity:0.8; letter-spacing:1px; text-transform:uppercase;">WEEK ${AppState.currentHwWeekNumber}</div>
                    <div style="font-size:26px; font-weight:800; margin-bottom:12px; letter-spacing:-1px; line-height:1.3;">${me.name}님,<br>오늘도 파이팅!</div>
                    <div style="font-size:13px; font-weight:500; opacity:0.9;">${me.school||'학교정보 없음'} ${me.grade||''} · ${me.teacher||'담당T 미배정'}</div>
                </div>
                <div style="width:60px; height:60px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:32px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">👩‍🏫</div>
            </div>
            <div style="display:flex; gap:15px; margin-top:30px; position:relative; z-index:1;">
                <div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">🔥</div><div><div style="font-size:18px; font-weight:800;">1일</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">연속 출석</div></div></div>
                <div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">💎</div><div><div style="font-size:18px; font-weight:800;">${me.xp || 0} XP</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">누적 점수</div></div></div>
            </div>
        </div>`;
    } 
    else if (studentTab === 'homework') {
        const curWeekStr = `${AppState.currentHwWeekNumber}주차`;
        const myHw = (data.homework || []).filter(h => h.week === curWeekStr && (h.target === 'all' || h.target === me.id));
        let hwCompletedCount = 0;
        myHw.forEach(h => { const sub = (data.hwSubmissions || []).find(s => s.hwId === h.id && s.studentId === me.id); if(sub && sub.status === 'approved') hwCompletedCount++; });
        const hwTotalCount = myHw.length; const hwPercent = hwTotalCount === 0 ? 0 : Math.round((hwCompletedCount / hwTotalCount) * 100);
        
        html += `<div class="stu-banner-blue" style="text-align:center; padding:25px;"><div style="display:flex; justify-content:space-between; align-items:center;"><button class="arrow-btn" data-action="change-week" data-dir="-1">&lt;</button><div><div style="font-size:22px; font-weight:800; margin-bottom:4px;">${curWeekStr}</div><div style="font-size:12px; opacity:0.8;">과제 현황</div></div><button class="arrow-btn" data-action="change-week" data-dir="1">&gt;</button></div><div style="display:flex; justify-content:space-between; margin-top:20px; font-size:13px; font-weight:700;"><span>완료 ${hwCompletedCount}/${hwTotalCount}</span><span>${hwPercent}%</span></div><div style="width:100%; height:8px; background:rgba(0,0,0,0.2); border-radius:4px; margin-top:10px; overflow:hidden;"><div style="width:${hwPercent}%; height:100%; background:white; border-radius:4px; transition:width 0.5s;"></div></div></div>`;
        if(myHw.length === 0) html += `<div class="stu-empty">배포된 과제가 없습니다.</div>`;
        else myHw.forEach(h => {
            const sub = (data.hwSubmissions || []).find(s => s.hwId === h.id && s.studentId === me.id);
            html += `<div class="stu-card"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong style="color:#60a5fa;">${h.day} (${h.date})</strong></div><p style="font-weight:600; font-size:16px; margin-bottom:15px;">${h.desc}</p>`;
            if(!sub) html += `<div style="border:1px dashed #334155; padding:20px; text-align:center; border-radius:8px; cursor:pointer;" data-action="trigger-file" data-id="${h.id}">📎 파일 첨부하여 제출</div><input type="file" id="hw-file-${h.id}" multiple class="hidden" data-hwid="${h.id}">`;
            else html += `<div style="background:#0f172a; padding:15px; border-radius:8px;"><span style="color:${sub.status==='approved'?'#10b981':(sub.status==='rejected'?'#ef4444':'#60a5fa')}; font-weight:bold;">${sub.status==='approved'?'승인완료':(sub.status==='rejected'?'반려됨':'검사 대기중')}</span><p style="margin-top:5px; font-size:13px; color:var(--text-muted);">제출된 파일: ${sub.files.length}개</p>${sub.status==='rejected'?`<button class="stu-btn-outline" style="margin-top:10px; border-color:#ef4444; color:#ef4444;" data-action="cancel-hw" data-subid="${sub.id}">다시 제출</button>`:''}</div></div>`;
        });
    }
    else if (studentTab === 'test') html += `<div class="stu-banner-green">나의 테스트실</div><div class="stu-empty">시험지 없음</div>`;
    else if (studentTab === 'lectures') {
        html += `<div class="stu-banner-blue" style="font-size:22px; font-weight:800;">강의 수강</div>`;
        if (AppState.activeLecture) {
            const lec = AppState.activeLecture; const progress = me.lectureProgress?.[lec.id] || { percent: 0, done: false };
            html += `<div style="background:#000; border-radius:16px; aspect-ratio:16/9; display:flex; flex-direction:column; justify-content:center; align-items:center; position:relative; margin-bottom:20px;">${progress.done ? '<div style="font-size:24px; color:#10b981; font-weight:bold;">✅ 시청 완료</div>' : `<div style="font-size:50px; cursor:pointer;" data-action="play-video">▶️</div>`}<div style="position:absolute; bottom:0; left:0; width:100%; height:6px; background:#333;"><div id="live-progress-bar" style="width:${progress.percent}%; height:100%; background:#3b82f6; transition:width 1s linear;"></div></div></div><div class="stu-card"><h3>${lec.title}</h3><p style="color:var(--text-muted); margin-top:5px;">90% 이상 시청 시 완료 처리 (현재 <span id="live-progress-text" style="color:#60a5fa; font-weight:bold;">${progress.percent}%</span>)</p></div><button class="btn-outline btn-block" style="border-color:#334155;" data-action="close-lecture">목록으로 돌아가기</button>`;
        } else {
            if (!data.lectures || data.lectures.length === 0) html += `<div class="stu-empty">강의 없음</div>`;
            else data.lectures.forEach(l => {
                const p = me.lectureProgress?.[l.id] || { percent: 0, done: false };
                html += `<div class="stu-card" style="display:flex; justify-content:space-between; align-items:center;"><div><h3 style="font-size:16px; margin-bottom:8px;">${l.title} ${p.done?'<span style="color:#10b981; font-size:12px;">(완료)</span>':''}</h3><div style="width:150px; height:4px; background:#334155; border-radius:2px;"><div style="width:${p.percent}%; height:100%; background:#3b82f6; border-radius:2px;"></div></div></div><button class="btn-primary btn-sm" style="width:auto;" data-action="open-lecture" data-id="${l.id}">시청</button></div>`;
            });
        }
    }
    else if (studentTab === 'materials') {
        const cat = AppState.materialCategory;
        html += `<div class="stu-banner-mint">자료실</div><div style="display:flex; gap:10px; margin-bottom:20px;"><button class="stu-btn-pill ${cat==='전체'?'active':''}" data-action="set-mat-cat" data-cat="전체">전체</button><button class="stu-btn-pill ${cat==='공지'?'active':''}" data-action="set-mat-cat" data-cat="공지">공지</button><button class="stu-btn-pill ${cat==='교재'?'active':''}" data-action="set-mat-cat" data-cat="교재">교재</button></div>`;
        const mats = (data.materials || []).filter(m => cat === '전체' || m.category === cat);
        if(mats.length === 0) html += `<div class="stu-empty">자료 없음</div>`;
        else mats.forEach(m => {
            html += `<div class="stu-card"><strong style="font-size:16px; display:flex; align-items:center; gap:8px;">${m.title} <span class="badge ${m.category==='공지'?'badge-red':'badge-blue'}">${m.category}</span></strong><p style="color:var(--text-muted); font-size:14px; margin-top:8px;">${m.desc||''}</p>`;
            if(m.fileData) html += `<a href="${m.fileData}" download="${m.fileName}" style="display:inline-block; margin-top:15px; padding:10px 16px; background:#1e293b; color:white; border-radius:8px; border:1px solid #334155; font-size:13px; font-weight:bold;">📥 ${m.fileName} 다운로드</a>`;
            html += `</div>`;
        });
    }
    else if (studentTab === 'community') {
        html += `<h2 style="font-size:24px; font-weight:800; color:#60a5fa; margin-bottom:20px;">소통 커뮤니티</h2><div class="stu-card" style="padding:10px;"><form id="form-community" style="display:flex; gap:10px;"><input type="text" id="comm-text" required placeholder="질문방 작성..." style="flex:1; background:transparent; border:1px solid #334155; border-radius:8px; padding:12px 15px; color:white; outline:none; font-size:14px;"><button type="submit" class="btn-primary" style="width:auto; padding:0 20px;">등록</button></form></div>`;
        if (!data.community || data.community.length === 0) html += `<div style="text-align:center; color:#64748b; margin-top:60px; font-size:14px; font-weight:600;">등록된 글이 없습니다.</div>`;
        else data.community.forEach(c => html += `<div class="stu-card" style="cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='var(--border)'" data-action="open-post" data-id="${c.id}"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="font-size:14px;">👤 ${c.author}</strong><span style="color:#64748b; font-size:12px;">${c.date||''}</span></div><p style="font-size:15px; line-height:1.5;">${c.content}</p><div style="margin-top:10px; font-size:13px; color:#64748b;">❤️ ${c.likes?c.likes.length:0} &nbsp; 💬 ${c.comments?c.comments.length:0}</div></div>`);
        
        if (AppState.activePostId) {
            const post = data.community.find(c => c.id === AppState.activePostId);
            const isLiked = post.likes && post.likes.includes(me.id);
            const isAuthor = (post.authorId === me.id) || (post.author === me.name);
            const authorActionsHtml = isAuthor ? `<div style="display:flex; gap:15px; margin-top:15px; border-top:1px solid var(--border); padding-top:15px;"><button class="btn-text" style="color:#60a5fa; padding:0; font-size:13px;" data-action="edit-post" data-id="${post.id}">📝 수정하기</button><button class="btn-text" style="color:#ef4444; padding:0; font-size:13px;" data-action="delete-post" data-id="${post.id}">🗑️ 삭제하기</button></div>` : '';

            html += `<div class="modal-overlay"><div class="post-modal-content"><div class="post-header"><strong style="font-size:16px;">👤 ${post.author}</strong><button class="btn-text" data-action="close-post" style="font-size:24px; padding:0;">×</button></div><div class="post-body"><p style="font-size:16px; line-height:1.6; white-space:pre-wrap;">${post.content}</p>${authorActionsHtml}<button class="post-likes ${isLiked?'liked':''}" data-action="toggle-like" data-id="${post.id}">❤️ ${post.likes?post.likes.length:0} 공감하기</button></div><div class="comment-section"><div class="comment-list">${(!post.comments||post.comments.length===0)?'<p style="color:var(--text-muted); font-size:13px; text-align:center;">첫 댓글을 남겨보세요.</p>':post.comments.map(cm=>`<div class="comment-item"><strong>${cm.author}</strong> <span style="color:#64748b; font-size:11px; margin-left:8px;">${cm.date}</span><p style="margin-top:5px; font-size:14px;">${cm.content}</p></div>`).join('')}</div><form id="form-comment" style="display:flex; gap:10px;"><input type="text" id="comment-text" required placeholder="댓글 달기..." class="admin-input" style="margin:0;"><button type="submit" class="btn-primary" style="width:auto; padding:0 20px;">작성</button></form></div></div></div>`;
        }
    }
    else if (studentTab === 'mypage') {
        html += `
            <div style="border:1px solid #7f1d1d; background:rgba(127,29,29,0.1); border-radius:12px; padding:20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div style="display:flex; align-items:center; gap:10px; color:#f8fafc; font-weight:700;"><span style="font-size:20px;">🔑</span> 수강권 상태</div>
                <button class="btn-white btn-sm" style="color:black; padding:8px 16px;" data-action="nav" data-target="payment">결제/연장</button>
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

// ------------------------- 관리자 렌더링 -------------------------
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab;
    const data = AppState.data;
    const set = data.settings || DEFAULT_STATE.settings;
    let html = '<div class="admin-grid">';

    document.querySelectorAll('#admin-top-nav .admin-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));

    if (tab === 'users') {
        html += `<div class="admin-card"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2>👨‍🎓 가입 학생 명단</h2><button class="btn-primary btn-sm" data-action="open-admin-modal" data-mode="add">+ 원생 추가</button></div><div class="table-responsive"><table class="admin-table"><thead><tr><th>이름(ID)</th><th>학교/학년/담당T</th><th>수강 기한</th><th>상태</th><th>관리</th></tr></thead><tbody>${(!data.users||data.users.length===0)?'<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">학생이 없습니다.</td></tr>':data.users.map(u => `<tr><td><strong>${u.name}</strong><br><span style="color:var(--text-muted); font-size:0.85rem;">${u.id}</span></td><td>${u.school||'미기입'}<br><span style="color:var(--text-muted); font-size:0.85rem;">${u.grade||''} · ${u.teacher||'담당 미배정'}</span></td><td><span class="badge-blue">${u.ticketExpiry || '미설정'}</span></td><td><span style="color:${u.active?'#10b981':'#ef4444'}; font-weight:bold;">${u.active ? '정상' : '정지'}</span></td><td><div style="display:flex; gap:5px;"><button class="btn-sm btn-outline" data-action="open-admin-modal" data-mode="edit" data-id="${u.id}">수정</button><button class="btn-sm btn-primary" style="background:#4f46e5;" data-action="open-ai-modal" data-id="${u.id}">✨ AI 리포트</button><button class="btn-sm btn-danger" data-action="delete-user" data-id="${u.id}">삭제</button></div></td></tr>`).join('')}</tbody></table></div></div>`;

        if (AppState.adminModal && AppState.adminModal.isOpen) {
            const mode = AppState.adminModal.mode; 
            const stu = mode === 'edit' ? data.users.find(u => u.id === AppState.adminModal.studentId) : {};
            
            // 🔥 관리자 원생 수정 모달 학년 10티어 옵션 추가
            html += `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h2 class="modal-title">${mode === 'add' ? '✨ 신규 원생 추가' : '📝 원생 정보 수정'}</h2>
                    <form id="form-admin-student">
                        <input type="text" id="mod-stu-name" class="admin-input" placeholder="학생 이름" required value="${stu.name || ''}">
                        <input type="text" id="mod-stu-id" class="admin-input" placeholder="아이디" required value="${stu.id || ''}" ${mode === 'edit' ? 'disabled' : ''}>
                        <input type="password" id="mod-stu-pw" class="admin-input" placeholder="${mode === 'edit' ? '비밀번호 (변경 시에만 입력)' : '초기 비밀번호'}" ${mode === 'add' ? 'required' : ''}>
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="mod-stu-school" class="admin-input" placeholder="학교명 (예: 대화고)" value="${stu.school || ''}">
                            <select id="mod-stu-grade" class="admin-input" style="color:white;">
                                <option value="중1" ${stu.grade==='중1'?'selected':''}>중1</option><option value="중2" ${stu.grade==='중2'?'selected':''}>중2</option><option value="중3" ${stu.grade==='중3'?'selected':''}>중3</option>
                                <option value="고1" ${stu.grade==='고1'?'selected':''}>고1</option><option value="고2" ${stu.grade==='고2'?'selected':''}>고2</option><option value="고3" ${stu.grade==='고3'?'selected':''}>고3</option>
                                <option value="대1" ${stu.grade==='대1'?'selected':''}>대1</option><option value="대2" ${stu.grade==='대2'?'selected':''}>대2</option><option value="대3" ${stu.grade==='대3'?'selected':''}>대3</option><option value="대4" ${stu.grade==='대4'?'selected':''}>대4</option>
                            </select>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <input type="date" id="mod-stu-expiry" class="admin-input" value="${stu.ticketExpiry || ''}" placeholder="수강 만료일">
                            <input type="text" id="mod-stu-teacher" class="admin-input" placeholder="담임 선생님 (예: 현서T)" value="${stu.teacher || ''}">
                        </div>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button type="button" class="btn-white-outline" style="width:100%; border-color:#334155; color:#94a3b8;" data-action="close-admin-modal">취소</button>
                            <button type="submit" class="btn-primary" style="width:100%;">${mode === 'add' ? '추가하기' : '수정 완료'}</button>
                        </div>
                    </form>
                </div>
            </div>`;
        }
    } 
    else if (tab === 'deploy') {
        html += `
            <div class="admin-card"><h2>📢 공지 배포 (모든 학생 알림)</h2><form id="form-admin-notice"><input type="text" id="adm-notice-title" class="admin-input" required placeholder="공지 제목"><textarea id="adm-notice-content" class="admin-input" style="height:100px; resize:none;" required placeholder="내용"></textarea><button type="submit" class="btn-primary">공지 올리기</button></form></div>
            <div class="admin-card"><h2>📝 주간 과제 배포</h2><form id="form-admin-hw"><select id="hw-target" class="admin-input"><option value="all">전체</option>${(data.users||[]).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select><div style="display:flex; gap:10px;"><input type="text" id="hw-week" class="admin-input" value="1주차" required><input type="date" id="hw-date" class="admin-input" required></div><textarea id="hw-desc" class="admin-input" placeholder="과제 내용" required style="height:80px;"></textarea><button type="submit" class="btn-primary">배포</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>💻 동영상 강의 등록</h2><form id="form-admin-lec" style="display:flex; gap:10px;"><input type="text" id="lec-title" class="admin-input" placeholder="강의 제목" required style="margin:0;"><input type="url" id="lec-link" class="admin-input" placeholder="강의 URL" required style="margin:0;"><button type="submit" class="btn-primary" style="width:auto; padding:0 30px;">등록</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>📁 자료실 첨부자료 업로드</h2><form id="form-admin-material" style="display:grid; grid-template-columns:150px 1fr auto; gap:10px; align-items:start;"><select id="mat-cat" class="admin-input" style="margin:0;"><option value="공지">공지</option><option value="교재">교재</option></select><input type="text" id="mat-title" class="admin-input" placeholder="자료명 (제목)" required style="margin:0;"><input type="file" id="mat-file" class="admin-input" style="margin:0; padding:9px;"><textarea id="mat-desc" class="admin-input" placeholder="자료에 대한 간략한 설명" style="grid-column:1/-1; height:60px; resize:none; margin:0;"></textarea><button type="submit" class="btn-primary" style="grid-column:1/-1;">게시 및 파일 업로드</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>💬 학생 과제 제출함</h2>${(!data.hwSubmissions || data.hwSubmissions.length===0) ? '<p style="color:var(--text-muted); text-align:center;">제출된 숙제가 없습니다.</p>' : data.hwSubmissions.map(s => `<div style="border:1px solid var(--border); padding:20px; border-radius:12px; margin-bottom:15px; background:var(--bg-dark);"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><strong>👤 ${s.studentName} 학생 제출본</strong><span style="color:${s.status==='approved'?'#10b981':(s.status==='rejected'?'#ef4444':'#60a5fa')}">${s.status === 'approved' ? '승인완료' : (s.status === 'rejected' ? '반려됨' : '대기중')}</span></div><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:15px; border-bottom:1px solid var(--border);">${s.files.map((f) => `<a href="${f.data}" download="${f.name}" style="background:#1e293b; padding:10px 15px; border-radius:8px; font-size:12px; font-weight:600; color:white; border:1px solid #334155; white-space:nowrap;">📄 ${f.name}</a>`).join('')}</div><div style="display:flex; gap:10px;">${s.status === 'pending' ? `<button class="btn-primary btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="approved">✅ 정답 승인</button><button class="btn-danger btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="rejected">❌ 반려 (재제출)</button>` : `<button class="btn-text btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="pending">상태 초기화</button>`}</div></div>`).join('')}</div>
        `;
    }
    else if (tab === 'payments') {
        const paySet = set.payment || { pgUrl: "", bankInfo: "[하나은행] 342-910508-31507", opt1: "1개월-10만", opt2: "", opt3: "", opt4: "" };
        
        html += `
        <div class="admin-card">
            <h2 style="color:#60a5fa; font-size:1.1rem; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:15px;">결제 승인 대기 목록</h2>
            <div class="table-responsive"><table class="admin-table" style="margin-top:10px;">
                <thead><tr><th>학생명(ID)</th><th>요청 상품</th><th>증명사진</th><th>상태</th></tr></thead>
                <tbody>`;
        if(!data.payments || data.payments.length===0) html += `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">요청없음</td></tr>`;
        else data.payments.forEach(p => html += `<tr><td><strong>${p.userName}</strong><br><span style="font-size:12px; color:var(--text-muted);">${p.userId}</span></td><td>${p.item}</td><td><a href="${p.image}" target="_blank" style="color:#60a5fa; text-decoration:underline; font-size:13px;">사진 보기</a></td><td>${p.status === '승인대기' ? `<button class="btn-primary btn-sm" data-action="approve-payment" data-id="${p.id}">결제 승인</button>` : `<span style="color:#10b981; font-weight:bold;">승인완료</span>`}</td></tr>`);
        html += `</tbody></table></div></div>`;

        html += `
        <div class="admin-card">
            <h2 style="color:#60a5fa; font-size:1.1rem; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:15px;">⚙️ 결제 연동 설정</h2>
            <form id="form-admin-payment-settings">
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:5px;">PG 링크 URL</p>
                <input type="text" id="pay-set-pg" class="admin-input" value="${paySet.pgUrl}">
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:5px; margin-top:10px;">무통장 계좌 안내</p>
                <input type="text" id="pay-set-bank" class="admin-input" value="${paySet.bankInfo}">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                    <input type="text" id="pay-set-opt1" class="admin-input" value="${paySet.opt1}" placeholder="옵션1">
                    <input type="text" id="pay-set-opt2" class="admin-input" value="${paySet.opt2}" placeholder="옵션2">
                    <input type="text" id="pay-set-opt3" class="admin-input" value="${paySet.opt3}" placeholder="옵션3">
                    <input type="text" id="pay-set-opt4" class="admin-input" value="${paySet.opt4}" placeholder="옵션4">
                </div>
                <button type="submit" class="btn-primary" style="width:100%; margin-top:20px; background:#1e293b; color:white; border:1px solid #334155;">결제 설정 즉시 적용</button>
            </form>
        </div>`;
    }
    else if (tab === 'settings') {
        const pop = set.popup;
        html += `<div class="admin-card" style="grid-column:1/-1;"><h2 style="margin-bottom:20px; color:#60a5fa;">📲 학생 대시보드 & 팝업 시스템 설정</h2><form id="form-admin-system" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:40px;"><div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;"><h3 style="margin-bottom:15px; font-size:1rem; color:white;">학생 홈 상단 공지 배너</h3><input type="text" id="set-dash-banner" class="admin-input" value="${set.dashBanner}" placeholder="학생 로그인 시 홈 화면 상단에 띄울 문구"></div><div style="background:var(--bg-dark); padding:20px; border-radius:12px; grid-column:1/-1;"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><h3 style="font-size:1rem; color:white;">학생 로그인 자동 팝업창 (모달)</h3><label style="color:var(--text-muted);"><input type="checkbox" id="set-pop-active" ${pop.active?'checked':''}> 팝업 활성화 켜기</label></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;"><input type="text" id="set-pop-tag" class="admin-input" value="${pop.tag}" placeholder="태그 문구 (예: 협업 피드백 이벤트)"><input type="text" id="set-pop-title" class="admin-input" value="${pop.title}" placeholder="큰 제목"><textarea id="set-pop-desc" class="admin-input" style="grid-column:1/-1; height:60px;" placeholder="서브 설명">${pop.desc}</textarea><div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid var(--border);"><h4 style="margin-bottom:10px; font-size:13px; color:#94a3b8;">박스 1 내용 (흰색)</h4><input type="text" id="set-pop-b1-t" class="admin-input" value="${pop.b1Title}" placeholder="박스 1 제목"><input type="text" id="set-pop-b1-d" class="admin-input" value="${pop.b1Desc}" placeholder="박스 1 설명 (HTML 허용)"></div><div style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid var(--border);"><h4 style="margin-bottom:10px; font-size:13px; color:#94a3b8;">박스 2 내용 (어두운색)</h4><input type="text" id="set-pop-b2-t" class="admin-input" value="${pop.b2Title}" placeholder="박스 2 제목"><input type="text" id="set-pop-b2-d" class="admin-input" value="${pop.b2Desc}" placeholder="박스 2 설명"></div><input type="text" id="set-pop-btn-url" class="admin-input" style="grid-column:1/-1;" value="${pop.btnUrl}" placeholder="버튼 이동 링크 (카카오톡 등)"></div></div><button type="submit" class="btn-primary" style="grid-column:1/-1; padding:15px; font-size:1.1rem;">시스템 설정 저장</button></form><hr style="border-color:var(--border); margin:40px 0;"><h2 style="margin-bottom:20px; color:#60a5fa;">🌐 랜딩(홈페이지) 실시간 편집</h2><form id="form-admin-settings" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;"><div style="background:var(--bg-dark); padding:20px; border-radius:12px;"><h3 style="margin-bottom:15px; font-size:1rem;">1. 배너</h3><input type="text" id="set-h-sub" class="admin-input" value="${AppState.data.landing?.heroSub}"><textarea id="set-h-tit" class="admin-input" style="height:70px;">${AppState.data.landing?.heroTitle.replace(/<br>/g, '\n')}</textarea><input type="text" id="set-h-desc" class="admin-input" value="${AppState.data.landing?.heroDesc}"></div><div style="background:var(--bg-dark); padding:20px; border-radius:12px;"><h3 style="margin-bottom:15px; font-size:1rem;">2. 통계</h3><div style="display:flex; gap:10px;"><input type="text" id="set-s1-n" class="admin-input" value="${AppState.data.landing?.s1Num}"><input type="text" id="set-s1-t" class="admin-input" value="${AppState.data.landing?.s1Txt}"></div><div style="display:flex; gap:10px;"><input type="text" id="set-s2-n" class="admin-input" value="${AppState.data.landing?.s2Num}"><input type="text" id="set-s2-t" class="admin-input" value="${AppState.data.landing?.s2Txt}"></div><div style="display:flex; gap:10px;"><input type="text" id="set-s3-n" class="admin-input" value="${AppState.data.landing?.s3Num}"><input type="text" id="set-s3-t" class="admin-input" value="${AppState.data.landing?.s3Txt}"></div></div><div style="background:var(--bg-dark); padding:20px; border-radius:12px;"><h3 style="margin-bottom:15px; font-size:1rem;">3. 특징 섹션 (왼쪽)</h3><div style="display:flex; gap:10px;"><input type="text" id="set-f1-b" class="admin-input" value="${AppState.data.landing?.f1Badge}"><select id="set-f1-c" class="admin-input"><option value="red" ${AppState.data.landing?.f1Col==='red'?'selected':''}>빨강</option><option value="blue" ${AppState.data.landing?.f1Col==='blue'?'selected':''}>파랑</option><option value="green" ${AppState.data.landing?.f1Col==='green'?'selected':''}>초록</option></select></div><input type="text" id="set-f1-t" class="admin-input" value="${AppState.data.landing?.f1Title}"><input type="text" id="set-f1-d" class="admin-input" value="${AppState.data.landing?.f1Desc}"><input type="text" id="set-f1-e" class="admin-input" value="${AppState.data.landing?.f1Emoji}"></div><div style="background:var(--bg-dark); padding:20px; border-radius:12px;"><h3 style="margin-bottom:15px; font-size:1rem;">4. 특징 섹션 (오른쪽)</h3><div style="display:flex; gap:10px;"><input type="text" id="set-f2-b" class="admin-input" value="${AppState.data.landing?.f2Badge}"><select id="set-f2-c" class="admin-input"><option value="red" ${AppState.data.landing?.f2Col==='red'?'selected':''}>빨강</option><option value="blue" ${AppState.data.landing?.f2Col==='blue'?'selected':''}>파랑</option><option value="green" ${AppState.data.landing?.f2Col==='green'?'selected':''}>초록</option></select></div><input type="text" id="set-f2-t" class="admin-input" value="${AppState.data.landing?.f2Title}"><input type="text" id="set-f2-d" class="admin-input" value="${AppState.data.landing?.f2Desc}"><input type="text" id="set-f2-e" class="admin-input" value="${AppState.data.landing?.f2Emoji}"></div><div style="grid-column:1/-1; background:var(--bg-dark); padding:20px; border-radius:12px;"><h3 style="margin-bottom:15px; font-size:1rem;">5. 하단 CTA 배너</h3><input type="text" id="set-b-tit" class="admin-input" value="${AppState.data.landing?.botTitle}" style="margin:0;"></div><button type="submit" class="btn-primary" style="grid-column:1/-1; padding:15px; font-size:1.1rem;">홈페이지 저장 및 실시간 반영</button></form></div>`;
    }
    else { html += `<div class="admin-card" style="grid-column:1/-1;"><p style="text-align:center; padding:40px; color:var(--text-muted);">준비 중입니다.</p></div>`; }
    html += '</div>';
    container.innerHTML = html;
}

// =========================================================
// [통합 이벤트 위임]
// =========================================================
document.body.addEventListener('change', async (e) => {
    if (e.target.matches('input[type="file"]')) {
        const files = Array.from(e.target.files || []);
        if(files.length === 0) return;
        if(files.some(f => f.size > 2 * 1024 * 1024)) { e.target.value = ''; return showToast('⚠️ 2MB 이하 파일만 첨부 가능합니다.'); }
        showToast("파일 처리 중...");
        
        try {
            const b64 = await Promise.all(files.map(f => new Promise(res => {
                const r = new FileReader(); r.onload = ev => res({ name: f.name, data: ev.target.result }); r.readAsDataURL(f);
            })));
            
            if (e.target.id === 'pay-req-file') {
                e.target.dataset.base64 = b64[0].data; showToast("✅ 사진이 첨부되었습니다.");
            } else if (e.target.dataset.hwid) {
                if(!AppState.data.hwSubmissions) AppState.data.hwSubmissions = [];
                AppState.data.hwSubmissions.push({ id: generateId(), hwId: e.target.dataset.hwid, studentId: AppState.currentUser.id, studentName: AppState.currentUser.name, files: b64, status: 'pending' });
                syncData(); showToast("✅ 숙제 제출 완료!");
            }
        } catch (err) { showToast("❌ 파일 업로드 오류가 발생했습니다."); }
    }
});

document.body.addEventListener('click', (e) => {
    const actionNode = e.target.closest('[data-action]');
    if (!actionNode) return;
    const action = actionNode.dataset.action;

    if (action === 'nav') switchView(actionNode.dataset.target);
    else if (action === 'auth-toggle') {
        if(AppState.currentUser) { AppState.currentUser = null; localStorage.removeItem('studycampus_session'); showToast("로그아웃 되었습니다."); switchView('landing'); }
        else { switchView('auth'); switchAuthMode('login'); }
    }
    else if (action === 'auth-register') {
        if (AppState.currentUser) switchView(AppState.currentUser.role === 'admin' ? 'admin' : 'student');
        else { switchView('auth'); switchAuthMode('register'); }
    }
    else if (action === 'switch-auth') switchAuthMode(actionNode.dataset.mode);
    else if (action === 'switch-admin-tab') { AppState.adminTab = actionNode.dataset.tab; renderAdminDashboard(); }
    else if (action === 'switch-student-tab') { 
        clearLectureTimer(); AppState.studentTab = actionNode.dataset.tab; renderStudentDashboard(); 
    }
    else if (action === 'back-to-mypage') { AppState.studentTab = 'mypage'; switchView('student'); }
    
    // 학생
    else if (action === 'open-student-edit') {
        const me = AppState.data.users.find(u => u.id === AppState.currentUser.id) || AppState.currentUser;
        document.getElementById('stu-edit-name').value = me.name || ''; document.getElementById('stu-edit-school').value = me.school || ''; document.getElementById('stu-edit-grade').value = me.grade || '고2'; document.getElementById('stu-edit-pw').value = '';
        document.getElementById('modal-student-edit').classList.remove('hidden');
    }
    else if (action === 'close-student-edit') { document.getElementById('modal-student-edit').classList.add('hidden'); }
    else if (action === 'toggle-notif') { 
        const drop = document.getElementById('notif-dropdown'); 
        if(drop) {
            drop.classList.toggle('hidden'); 
            if(!drop.classList.contains('hidden')) { 
                let upd = false; 
                (AppState.data.alerts||[]).forEach(a => { if(a.studentId === AppState.currentUser.id && !a.read) { a.read = true; upd = true; }}); 
                if(upd) syncData(); document.getElementById('notif-badge').classList.add('hidden'); 
            } 
        }
    }
    else if (action === 'close-popup') { document.getElementById('student-auto-popup').classList.add('hidden'); sessionStorage.setItem('studycampus_popup_shown', 'true'); }
    else if (action === 'hide-popup-today') { localStorage.setItem('studycampus_hide_popup', new Date().toISOString().split('T')[0]); document.getElementById('student-auto-popup').classList.add('hidden'); showToast("오늘 하루 띄우지 않습니다."); }
    else if (action === 'change-week') { 
        const dir = parseInt(actionNode.dataset.dir);
        let newWeek = AppState.currentHwWeekNumber + dir;
        if (newWeek < 1) newWeek = 1; AppState.currentHwWeekNumber = newWeek; renderStudentDashboard();
    }
    else if (action === 'set-mat-cat') { AppState.materialCategory = actionNode.dataset.cat; renderStudentDashboard(); }
    else if (action === 'open-post') { AppState.activePostId = actionNode.dataset.id; renderStudentDashboard(); }
    else if (action === 'close-post') { AppState.activePostId = null; renderStudentDashboard(); }
    
    // 🔥 커뮤니티 게시물 수정 / 삭제 로직 추가 (본인 글만)
    else if (action === 'edit-post') {
        const post = AppState.data.community.find(c => c.id === actionNode.dataset.id);
        if(post) {
            const newText = prompt("게시물 내용을 수정하세요:", post.content);
            if(newText !== null && newText.trim() !== "") {
                post.content = newText.trim();
                syncData(); showToast("게시물이 수정되었습니다."); renderStudentDashboard();
            }
        }
    }
    else if (action === 'delete-post') {
        if(confirm("이 게시물을 완전히 삭제하시겠습니까?")) {
            AppState.data.community = AppState.data.community.filter(c => c.id !== actionNode.dataset.id);
            if(AppState.activePostId === actionNode.dataset.id) AppState.activePostId = null;
            syncData(); showToast("게시물이 삭제되었습니다."); renderStudentDashboard();
        }
    }
    else if (action === 'toggle-like') {
        const post = AppState.data.community.find(c => c.id === actionNode.dataset.id);
        if(post) { if(!post.likes) post.likes = []; const meId = AppState.currentUser.id; const idx = post.likes.indexOf(meId); if(idx > -1) post.likes.splice(idx, 1); else post.likes.push(meId); syncData(); }
    }
    else if (action === 'open-lecture') { AppState.activeLecture = AppState.data.lectures.find(l => l.id === actionNode.dataset.id); renderStudentDashboard(); }
    else if (action === 'close-lecture') { clearLectureTimer(); renderStudentDashboard(); }
    else if (action === 'play-video') {
        clearLectureTimer();
        const lecId = AppState.activeLecture.id;
        const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id);
        if(!AppState.data.users[userIdx].lectureProgress) AppState.data.users[userIdx].lectureProgress = {};
        
        let prog = AppState.data.users[userIdx].lectureProgress[lecId]?.percent || 0;
        actionNode.innerHTML = '⏸️'; showToast("수강 기록 시작됨");
        
        AppState.lectureTimer = setInterval(() => {
            prog += 5; 
            if (prog >= 90) { prog = 100; clearLectureTimer(); AppState.data.users[userIdx].lectureProgress[lecId] = { percent: 100, done: true }; syncData(); showToast("🎉 90% 달성 완료!"); } 
            else { AppState.data.users[userIdx].lectureProgress[lecId] = { percent: prog, done: false }; }
            
            const bar = document.getElementById('live-progress-bar'); const txt = document.getElementById('live-progress-text');
            if(bar) bar.style.width = prog + '%'; if(txt) txt.textContent = prog + '%';
        }, 1000);
    }
    else if (action === 'trigger-file') { const fi = document.getElementById(`hw-file-${actionNode.dataset.id}`); if(fi) fi.click(); }
    else if (action === 'cancel-hw') { AppState.data.hwSubmissions = AppState.data.hwSubmissions.filter(s => s.id !== actionNode.dataset.subid); syncData(); showToast("기존 제출본 삭제됨"); }
    else if (action === 'delete-account') { if(confirm("탈퇴하시겠습니까? (데이터 삭제)")) { AppState.data.users = AppState.data.users.filter(u => u.id !== AppState.currentUser.id); syncData(); localStorage.removeItem('studycampus_session'); AppState.currentUser = null; switchView('landing'); } }
    
    // 관리자
    else if (action === 'toggle-user') { const user = AppState.data.users.find(u => String(u.id) === String(actionNode.dataset.id)); if(user) user.active = !user.active; syncData(); showToast("상태가 변경되었습니다."); }
    else if (action === 'delete-user') { if(confirm("정말 삭제할까요?")) { AppState.data.users = AppState.data.users.filter(u => u.id !== actionNode.dataset.id); syncData(); showToast("삭제되었습니다."); renderAdminDashboard(); } }
    else if (action === 'open-admin-modal') { AppState.adminModal = { isOpen: true, mode: actionNode.dataset.mode, studentId: actionNode.dataset.id || null }; renderAdminDashboard(); }
    else if (action === 'close-admin-modal') { AppState.adminModal.isOpen = false; renderAdminDashboard(); }
    else if (action === 'review-hw') { const sub = AppState.data.hwSubmissions.find(s => s.id === actionNode.dataset.subid); if(sub) { sub.status = actionNode.dataset.status; syncData(); showToast("검사 상태 변경됨"); } }
    else if (action === 'approve-payment') { const p = AppState.data.payments.find(p => p.id === actionNode.dataset.id); if(p) { p.status = '승인완료'; syncData(); showToast("결제가 승인되었습니다!"); } }
    else if (action === 'open-ai-modal') { AppState.aiModal = { isOpen: true, studentId: actionNode.dataset.id }; document.getElementById('modal-ai-report').classList.remove('hidden'); document.getElementById('ai-report-textarea').value = ''; }
    else if (action === 'close-ai-modal') { AppState.aiModal.isOpen = false; document.getElementById('modal-ai-report').classList.add('hidden'); }
    else if (action === 'generate-ai-text') {
        const sid = AppState.aiModal.studentId; const student = AppState.data.users.find(u => u.id === sid); const hwCount = (AppState.data.hwSubmissions||[]).filter(s => s.studentId === sid && s.status === 'approved').length; const lecCount = Object.values(student.lectureProgress||{}).filter(p => p.done).length;
        document.getElementById('ai-report-textarea').value = `[AI 주간 분석 리포트]\n\n${student.name} 학생의 주간 분석 결과입니다.\n- 완료 과제: ${hwCount}건\n- 수강 완료 강의: ${lecCount}건\n\n성실한 태도로 학습에 성실히 응하고 있습니다. 다음 주에도 열정을 이어가길 응원합니다!`;
    }
    else if (action === 'send-ai-report') {
        const text = document.getElementById('ai-report-textarea').value; if(!text) return showToast("내용을 작성해주세요.");
        if(!AppState.data.reports) AppState.data.reports = []; if(!AppState.data.alerts) AppState.data.alerts = [];
        AppState.data.reports.unshift({ id: generateId(), studentId: AppState.aiModal.studentId, content: text, date: new Date().toISOString().split('T')[0] });
        AppState.data.alerts.unshift({ id: generateId(), studentId: AppState.aiModal.studentId, title: "주간 분석 리포트 도착", content: "새로운 리포트가 등록되었습니다.", read: false, date: new Date().toISOString().split('T')[0] });
        syncData(); showToast("성공적으로 발송되었습니다!"); document.querySelector('[data-action="close-ai-modal"]').click();
    }
});

// 폼(Form) 제출 이벤트 제어
document.body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(e.target.id === 'form-login') {
        const id = document.getElementById('login-id').value.trim(); const pw = document.getElementById('login-pw').value.trim();
        if(id === 'studycampus' && pw === 'studycampus26') { AppState.currentUser = { id: 'admin', name: '최고관리자', role: 'admin' }; localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); switchView('admin'); } 
        else {
            const user = (AppState.data.users||[]).find(u => u.id === id);
            if(user && user.active && (!user.pw || user.pw === pw)) { AppState.currentUser = user; localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); sessionStorage.removeItem('studycampus_popup_shown'); switchView('student'); } 
            else showToast("계정 정보나 비밀번호를 확인해주세요.");
        }
    }
    else if(e.target.id === 'form-register') {
        const id = document.getElementById('reg-id').value.trim();
        if(!AppState.data.users) AppState.data.users = [];
        if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("이미 존재하는 아이디입니다.");
        const d = new Date(); d.setDate(d.getDate() + 30);
        
        // 🔥 입력된 학교명을 정규화하여 저장
        const normalizedSchool = normalizeSchool(document.getElementById('reg-school').value);

        AppState.data.users.push({ id, name: document.getElementById('reg-name').value || id, pw: document.getElementById('reg-pw').value, school: normalizedSchool, grade: document.getElementById('reg-grade').value, role: 'student', active: true, xp: 0, ticketExpiry: d.toISOString().split('T')[0] });
        syncData(); showToast("가입 완료! 로그인 해주세요."); switchAuthMode('login');
    }
    else if(e.target.id === 'form-student-edit') {
        const name = document.getElementById('stu-edit-name').value.trim();
        const pw = document.getElementById('stu-edit-pw').value.trim();
        // 🔥 변경되는 학교명도 정규화
        const school = normalizeSchool(document.getElementById('stu-edit-school').value);
        const grade = document.getElementById('stu-edit-grade').value.trim();

        const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id);
        if(userIdx > -1) { 
            AppState.data.users[userIdx].name = name; 
            AppState.data.users[userIdx].school = school; 
            AppState.data.users[userIdx].grade = grade; 
            if(pw) AppState.data.users[userIdx].pw = pw; 
            
            AppState.currentUser = AppState.data.users[userIdx];
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser));
        } 
        showToast("회원 정보가 수정되었습니다.");
        document.getElementById('modal-student-edit').classList.add('hidden');
        syncData(); renderCurrentView();
    }
    else if(e.target.id === 'form-payment-request') {
        const fileInput = document.getElementById('pay-req-file'); const b64 = fileInput.dataset.base64; if(!b64) return showToast("사진을 첨부해주세요.");
        if(!AppState.data.payments) AppState.data.payments = [];
        AppState.data.payments.unshift({ id: generateId(), userId: AppState.currentUser.id, userName: AppState.currentUser.name, phone: document.getElementById('pay-req-phone').value, item: document.getElementById('pay-req-item').value, amount: "별도", image: b64, status: '승인대기', date: new Date().toISOString().split('T')[0] });
        syncData(); showToast("결제 승인 요청 전송됨"); AppState.studentTab = 'mypage'; switchView('student'); e.target.reset();
    }
    else if(e.target.id === 'form-admin-payment-settings') {
        if(!AppState.data.settings) AppState.data.settings = {};
        AppState.data.settings.payment = {
            pgUrl: document.getElementById('pay-set-pg').value,
            bankInfo: document.getElementById('pay-set-bank').value,
            opt1: document.getElementById('pay-set-opt1').value,
            opt2: document.getElementById('pay-set-opt2').value,
            opt3: document.getElementById('pay-set-opt3').value,
            opt4: document.getElementById('pay-set-opt4').value
        };
        syncData(); showToast("결제 설정이 즉시 반영되었습니다.");
    }
    else if(e.target.id === 'form-admin-student') {
        const mode = AppState.adminModal.mode; 
        const id = document.getElementById('mod-stu-id').value.trim(); 
        const name = document.getElementById('mod-stu-name').value.trim(); 
        const pw = document.getElementById('mod-stu-pw').value.trim(); 
        // 🔥 관리자 등록 시에도 학교명 정규화
        const school = normalizeSchool(document.getElementById('mod-stu-school').value); 
        const grade = document.getElementById('mod-stu-grade').value.trim(); 
        const expiry = document.getElementById('mod-stu-expiry').value;
        const teacher = document.getElementById('mod-stu-teacher').value.trim();

        if(!AppState.data.users) AppState.data.users = [];
        if (mode === 'add') {
            if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("존재하는 아이디입니다.");
            AppState.data.users.unshift({ id, name, pw, school, grade, teacher, role: 'student', active: true, xp: 0, ticketExpiry: expiry || '' }); showToast("원생이 추가되었습니다.");
        } else if (mode === 'edit') {
            const userIdx = AppState.data.users.findIndex(u => u.id === AppState.adminModal.studentId);
            if(userIdx > -1) { 
                AppState.data.users[userIdx].name = name; AppState.data.users[userIdx].school = school; AppState.data.users[userIdx].grade = grade; AppState.data.users[userIdx].teacher = teacher; AppState.data.users[userIdx].ticketExpiry = expiry || ''; 
                if(pw) AppState.data.users[userIdx].pw = pw; 
            } 
            showToast("정보가 수정되었습니다.");
        }
        AppState.adminModal.isOpen = false; syncData(); renderAdminDashboard();
    }
    // 게시물 생성 시 authorId (고유식별자) 저장 유지
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
        if (file) { if(file.size > 2 * 1024 * 1024) return showToast('⚠️ 2MB 이하만 가능'); showToast("업로드 중..."); fileData = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); }); fileName = file.name; }
        if(!AppState.data.materials) AppState.data.materials = []; AppState.data.materials.unshift({ id: generateId(), category: document.getElementById('mat-cat').value, title: document.getElementById('mat-title').value, desc: document.getElementById('mat-desc').value, fileData, fileName }); syncData(); showToast("업로드 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-hw') {
        if(!AppState.data.homework) AppState.data.homework = []; const tVal = document.getElementById('hw-target').value;
        AppState.data.homework.unshift({ id: generateId(), target: tVal, type: tVal === 'all' ? 'all' : 'individual', week: document.getElementById('hw-week').value, date: document.getElementById('hw-date').value, day: document.getElementById('hw-day').value, desc: document.getElementById('hw-desc').value });
        if(!AppState.data.notices) AppState.data.notices = []; AppState.data.notices.unshift({ id: generateId(), title: "📝 신규 숙제 배포", content: `${document.getElementById('hw-week').value} 숙제 알림`, date: new Date().toISOString() }); syncData(); showToast("배포 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-notice') {
        if(!AppState.data.notices) AppState.data.notices = []; AppState.data.notices.unshift({ id: generateId(), title: document.getElementById('adm-notice-title').value, content: document.getElementById('adm-notice-content').value, date: new Date().toISOString() }); syncData(); showToast("공지 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-lec') {
        if(!AppState.data.lectures) AppState.data.lectures = []; AppState.data.lectures.push({ id: generateId(), title: document.getElementById('lec-title').value, link: document.getElementById('lec-link').value }); syncData(); showToast("강의 등록 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-system' || e.target.id === 'form-admin-settings') {
        if(!AppState.data.settings) AppState.data.settings = {}; AppState.data.settings.dashBanner = document.getElementById('set-dash-banner').value;
        AppState.data.settings.popup = { active: document.getElementById('set-pop-active').checked, tag: document.getElementById('set-pop-tag').value, title: document.getElementById('set-pop-title').value, desc: document.getElementById('set-pop-desc').value, b1Title: document.getElementById('set-pop-b1-t').value, b1Desc: document.getElementById('set-pop-b1-d').value, b2Title: document.getElementById('set-pop-b2-t').value, b2Desc: document.getElementById('set-pop-b2-d').value, btnUrl: document.getElementById('set-pop-btn-url').value };
        
        AppState.data.landing = {
            heroSub: document.getElementById('set-h-sub').value, heroTitle: document.getElementById('set-h-tit').value.replace(/\n/g, '<br>'), heroDesc: document.getElementById('set-h-desc').value,
            s1Num: document.getElementById('set-s1-n').value, s1Txt: document.getElementById('set-s1-t').value, s2Num: document.getElementById('set-s2-n').value, s2Txt: document.getElementById('set-s2-t').value, s3Num: document.getElementById('set-s3-n').value, s3Txt: document.getElementById('set-s3-t').value,
            f1Badge: document.getElementById('set-f1-b').value, f1Col: document.getElementById('set-f1-c').value, f1Title: document.getElementById('set-f1-t').value, f1Desc: document.getElementById('set-f1-d').value, f1Emoji: document.getElementById('set-f1-e').value,
            f2Badge: document.getElementById('set-f2-b').value, f2Col: document.getElementById('set-f2-c').value, f2Title: document.getElementById('set-f2-t').value, f2Desc: document.getElementById('set-f2-d').value, f2Emoji: document.getElementById('set-f2-e').value,
            botTitle: document.getElementById('set-b-tit').value
        };
        syncData(); showToast("수정 사항이 실시간으로 적용되었습니다.");
    }
});

// 앱 시작 시 사용자 확인
document.addEventListener('DOMContentLoaded', () => {
    try {
        const session = localStorage.getItem('studycampus_session');
        if (session) AppState.currentUser = JSON.parse(session);
    } catch (e) {}
    switchView(AppState.currentUser ? (AppState.currentUser.role === 'admin' ? 'admin' : 'student') : 'landing');
});
