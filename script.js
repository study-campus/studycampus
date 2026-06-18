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

// 깡통 기본 데이터
const DEFAULT_STATE = {
    users: [], lectures: [], homework: [], hwSubmissions: [], community: [], payments: [],
    landing: {
        heroSub: "STUDY CAMPUS LEARNING SYSTEM", heroTitle: "성적 향상의 해답<br>프리미엄 온라인 학원", heroDesc: "1:1 관리 시스템.",
        s1Num: "260", s1Txt: "수강", s2Num: "2등급", s2Txt: "상승", s3Num: "98점", s3Txt: "수능",
        secTitle: "왜 StudyCampus 인가요?",
        f1Badge: "문제", f1Col: "red", f1Title: "성적이 안 오르는 이유", f1Desc: "일방적인 강의 시청, 피드백 없는 숙제", f1Emoji: "😫",
        f2Badge: "해결", f2Col: "blue", f2Title: "체계적인 온라인 밀착 관리", f2Desc: "누구나 포기하지 않고 따라오는 커리큘럼", f2Emoji: "💡",
        botTitle: "지금 StudyCampus와 시작하세요"
    }
};

const AppState = {
    data: DEFAULT_STATE,
    currentUser: null, currentView: 'landing', authMode: 'login', studentTab: 'home', adminTab: 'users',
    activeLecture: null, lectureTimer: null,
    adminModal: { isOpen: false, mode: 'add', studentId: null }
};

// ------------------------- 유틸 -------------------------
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
function getCurrentWeekString(d = new Date()) {
    return `${d.getMonth() + 1}월 ${Math.ceil((d.getDate() - 1 + new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 1) / 7)}주차`;
}

// ------------------------- 파이어베이스 -------------------------
const dbRef = ref(db, 'studycampus_data');
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) AppState.data = serverData;
    else set(dbRef, AppState.data);
    renderLandingPage();
    renderCurrentView();
});
function syncData() { set(dbRef, AppState.data); }

// ------------------------- 뷰 렌더링 -------------------------
function switchView(viewName) {
    AppState.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    const targetView = document.getElementById(`view-${viewName}`);
    if(targetView) targetView.classList.remove('hidden');
    
    if (viewName === 'auth') switchAuthMode('login'); // auth 진입시 무조건 로그인 탭부터 띄우기

    const isAppView = viewName === 'student' || viewName === 'admin';
    document.querySelectorAll('.global-element').forEach(el => el.classList.toggle('hidden', isAppView));
    if(!isAppView) renderNavbar();
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
        tag.classList.add('hidden');
        btn.textContent = '로그인'; btn.dataset.action = 'auth-toggle';
    }
}

function renderCurrentView() {
    if (AppState.currentView === 'student' && AppState.currentUser) renderStudentDashboard();
    else if (AppState.currentView === 'admin' && AppState.currentUser) renderAdminDashboard();
}

function renderLandingPage() {
    const ld = AppState.data.landing || DEFAULT_STATE.landing;
    document.getElementById('ld-hero-sub').textContent = ld.heroSub;
    document.getElementById('ld-hero-title').innerHTML = ld.heroTitle;
    document.getElementById('ld-hero-desc').textContent = ld.heroDesc;
    document.getElementById('ld-s1-n').textContent = ld.s1Num; document.getElementById('ld-s1-t').textContent = ld.s1Txt;
    document.getElementById('ld-s2-n').textContent = ld.s2Num; document.getElementById('ld-s2-t').textContent = ld.s2Txt;
    document.getElementById('ld-s3-n').textContent = ld.s3Num; document.getElementById('ld-s3-t').textContent = ld.s3Txt;
    document.getElementById('ld-sec-title').textContent = ld.secTitle;
    document.getElementById('ld-f1-b').textContent = ld.f1Badge; document.getElementById('ld-f1-b').className = 'badge-' + ld.f1Col;
    document.getElementById('ld-f1-t').textContent = ld.f1Title; document.getElementById('ld-f1-d').textContent = ld.f1Desc; document.getElementById('ld-f1-e').textContent = ld.f1Emoji;
    document.getElementById('ld-f2-b').textContent = ld.f2Badge; document.getElementById('ld-f2-b').className = 'badge-' + ld.f2Col;
    document.getElementById('ld-f2-t').textContent = ld.f2Title; document.getElementById('ld-f2-d').textContent = ld.f2Desc; document.getElementById('ld-f2-e').textContent = ld.f2Emoji;
    document.getElementById('ld-bot-title').textContent = ld.botTitle;
}

// =========================================================
// [학생 렌더링]
// =========================================================
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const { currentUser, data, studentTab } = AppState;
    const me = (data.users || []).find(u => u.id === currentUser.id) || currentUser;
    let html = '';

    document.querySelectorAll('#student-bottom-nav .stu-nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === studentTab));

    if (studentTab === 'home') {
        html += `<div class="stu-banner-blue"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><div style="font-size:12px; font-weight:800; margin-bottom:8px; opacity:0.9;">WEEK</div><div style="font-size:28px; font-weight:800; margin-bottom:10px; letter-spacing:-1px;">${me.name}님!</div><div style="font-size:14px; font-weight:600; opacity:0.9;">대기중</div></div><div style="width:50px; height:50px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:24px;">👨‍🎓</div></div><div style="display:flex; gap:15px; margin-top:30px;"><div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">🔥</div><div><div style="font-size:18px; font-weight:800;">1일</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">연속 출석</div></div></div><div style="flex:1; background:rgba(255,255,255,0.15); border-radius:12px; padding:15px; display:flex; align-items:center; gap:15px;"><div style="font-size:26px;">💎</div><div><div style="font-size:18px; font-weight:800;">${me.xp || 0} XP</div><div style="font-size:11px; opacity:0.8; margin-top:4px;">누적 점수</div></div></div></div></div>`;
    } 
    else if (studentTab === 'homework') {
        const curWeek = getCurrentWeekString();
        const myHw = (data.homework || []).filter(h => h.week === curWeek && (h.target === 'all' || h.target === me.id));
        html += `<div class="stu-banner-blue" style="text-align:center; padding:25px;"><div style="display:flex; justify-content:space-between; align-items:center;"><button style="background:rgba(255,255,255,0.2); border:none; color:white; width:36px; height:36px; border-radius:50%;">&lt;</button><div><div style="font-size:22px; font-weight:800; margin-bottom:4px;">${curWeek}</div><div style="font-size:12px; opacity:0.8;">과제 현황</div></div><button style="background:rgba(255,255,255,0.2); border:none; color:white; width:36px; height:36px; border-radius:50%;">&gt;</button></div></div>`;
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
        html += `<div class="stu-banner-blue" style="font-size:22px; font-weight:800; display:flex; justify-content:space-between; align-items:center;">동영상 강의실 <button class="stu-btn-outline" style="border-color:white; color:white;" data-action="switch-student-tab" data-tab="home" ${!AppState.activeLecture ? 'class="hidden"' : ''}>뒤로</button></div>`;
        if (AppState.activeLecture) {
            const lec = AppState.activeLecture; const progress = me.lectureProgress?.[lec.id] || { percent: 0, done: false };
            html += `<div style="background:#000; border-radius:16px; aspect-ratio:16/9; display:flex; flex-direction:column; justify-content:center; align-items:center; position:relative; margin-bottom:20px;">${progress.done ? '<div style="font-size:24px; color:#10b981; font-weight:bold;">✅ 시청 완료</div>' : `<div style="font-size:50px; cursor:pointer;" data-action="play-video">▶️</div>`}<div style="position:absolute; bottom:0; left:0; width:100%; height:6px; background:#333;"><div id="live-progress-bar" style="width:${progress.percent}%; height:100%; background:#3b82f6; transition:width 1s linear;"></div></div></div><div class="stu-card"><h3>${lec.title}</h3><p style="color:var(--text-muted); margin-top:5px;">90% 이상 시청 시 완료 처리 (현재 <span id="live-progress-text" style="color:#60a5fa; font-weight:bold;">${progress.percent}%</span>)</p></div>`;
        } else {
            if (!data.lectures || data.lectures.length === 0) html += `<div class="stu-empty">강의 없음</div>`;
            else data.lectures.forEach(l => {
                const p = me.lectureProgress?.[l.id] || { percent: 0, done: false };
                html += `<div class="stu-card" style="display:flex; justify-content:space-between; align-items:center;"><div><h3 style="font-size:16px; margin-bottom:8px;">${l.title} ${p.done?'<span style="color:#10b981; font-size:12px;">(완료)</span>':''}</h3><div style="width:150px; height:4px; background:#334155; border-radius:2px;"><div style="width:${p.percent}%; height:100%; background:#3b82f6; border-radius:2px;"></div></div></div><button class="btn-primary btn-sm" style="width:auto;" data-action="open-lecture" data-id="${l.id}">시청</button></div>`;
            });
        }
    }
    else if (studentTab === 'materials') html += `<div class="stu-banner-mint">자료실</div><div class="stu-empty">자료 없음</div>`;
    else if (studentTab === 'community') html += `<h2 style="font-size:24px; font-weight:800; color:#60a5fa; margin-bottom:20px;">소통 커뮤니티</h2><div class="stu-card" style="padding:10px;"><form id="form-community" style="display:flex; gap:10px;"><input type="text" id="comm-text" required placeholder="질문방 작성..." style="flex:1; background:transparent; border:1px solid #334155; border-radius:8px; padding:12px 15px; color:white; outline:none; font-size:14px;"><button type="submit" class="btn-primary" style="width:auto; padding:0 20px;">등록</button></form></div>${(!data.community||data.community.length===0)?'<div style="text-align:center; color:#64748b; margin-top:60px; font-size:14px; font-weight:600;">등록된 글이 없습니다.</div>':data.community.map(c=>`<div class="stu-card"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="font-size:14px;">👤 ${c.author}</strong><span style="color:#64748b; font-size:12px;">${c.date||''}</span></div><p style="font-size:15px; line-height:1.5;">${c.content}</p></div>`).join('')}`;
    else if (studentTab === 'mypage') {
        html += `<div style="border:1px solid #7f1d1d; background:rgba(127,29,29,0.15); border-radius:16px; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><div style="display:flex; align-items:center; gap:12px; color:#f8fafc; font-weight:800; font-size:16px;"><span style="font-size:20px;">🔑</span> 수강권 상태</div><button class="btn-danger btn-sm" onclick="showToast('결제 모듈 연동 준비 중입니다.')">결제/연장</button></div><div class="stu-card"><h3 style="font-size:16px; font-weight:700; margin-bottom:15px; display:flex; align-items:center; gap:8px;">📝 주간 분석 리포트</h3><hr style="border-color:#334155; margin-bottom:15px;"><div style="text-align:center; color:#64748b; font-size:14px; padding:20px 0;">리포트 없음</div></div><div class="stu-card"><h3 style="font-size:16px; font-weight:700; margin-bottom:15px;">1:1 카카오톡 문의센터</h3><a href="http://pf.kakao.com/_xdxnxfXX" target="_blank" style="display:block; text-align:center; background:#3b82f6; color:white; border:none; width:100%; padding:15px; border-radius:8px; font-weight:800; cursor:pointer;">카톡으로 접수/연결</a></div><div style="text-align:right;"><button class="btn-text" style="color:#ef4444;" data-action="delete-account">회원탈퇴</button></div>`;
    }
    container.innerHTML = html;
}

// =========================================================
// [관리자 렌더링]
// =========================================================
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab;
    const data = AppState.data;
    const ld = data.landing || DEFAULT_STATE.landing;
    let html = '<div class="admin-grid">';

    document.querySelectorAll('#admin-top-nav .admin-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));

    if (tab === 'users') {
        html += `
        <div class="admin-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>👨‍🎓 가입 학생 명단</h2>
                <button class="btn-primary btn-sm" data-action="open-admin-modal" data-mode="add">+ 원생 추가</button>
            </div>
            <table class="admin-table">
                <thead><tr><th>이름(ID)</th><th>학교/학년</th><th>수강 기한</th><th>상태</th><th>관리</th></tr></thead>
                <tbody>
                ${(!data.users||data.users.length===0)?'<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">학생이 없습니다.</td></tr>':
                data.users.map(u => `
                    <tr>
                        <td><strong>${u.name}</strong><br><span style="color:var(--text-muted); font-size:0.85rem;">${u.id}</span></td>
                        <td>${u.school||'미기입'}<br><span style="color:var(--text-muted); font-size:0.85rem;">${u.grade||'미기입'}</span></td>
                        <td><span class="badge badge-blue">${u.ticketExpiry || '미설정'}</span></td>
                        <td><span style="color:${u.active?'#10b981':'#ef4444'}; font-weight:bold;">${u.active ? '정상' : '정지'}</span></td>
                        <td>
                            <div style="display:flex; gap:5px;">
                                <button class="btn-sm btn-outline" data-action="open-admin-modal" data-mode="edit" data-id="${u.id}">수정</button>
                                <button class="btn-sm ${u.active ? 'btn-outline' : 'btn-primary'}" data-action="toggle-user" data-id="${u.id}">${u.active ? '정지' : '복구'}</button>
                                <button class="btn-sm btn-danger" data-action="delete-user" data-id="${u.id}">삭제</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
        </div>`;

        if (AppState.adminModal && AppState.adminModal.isOpen) {
            const mode = AppState.adminModal.mode;
            const stu = mode === 'edit' ? data.users.find(u => u.id === AppState.adminModal.studentId) : {};
            html += `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h2 class="modal-title">${mode === 'add' ? '✨ 신규 원생 추가' : '📝 원생 정보 수정'}</h2>
                    <form id="form-admin-student">
                        <input type="text" id="mod-stu-name" class="admin-input" placeholder="학생 이름" required value="${stu.name || ''}">
                        <input type="text" id="mod-stu-id" class="admin-input" placeholder="아이디" required value="${stu.id || ''}" ${mode === 'edit' ? 'disabled' : ''}>
                        <input type="password" id="mod-stu-pw" class="admin-input" placeholder="${mode === 'edit' ? '비밀번호 (변경 시에만 입력)' : '초기 비밀번호'}" ${mode === 'add' ? 'required' : ''}>
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="mod-stu-school" class="admin-input" placeholder="학교명" value="${stu.school || ''}">
                            <input type="text" id="mod-stu-grade" class="admin-input" placeholder="학년 (예: 고2)" value="${stu.grade || ''}">
                        </div>
                        <input type="date" id="mod-stu-expiry" class="admin-input" value="${stu.ticketExpiry || ''}" placeholder="수강 만료일">
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
        const autoWeek = getCurrentWeekString();
        html += `
            <div class="admin-card"><h2>📢 공지 배포</h2><form id="form-admin-notice"><input type="text" id="adm-notice-title" class="admin-input" required placeholder="공지 제목"><textarea id="adm-notice-content" class="admin-input" style="height:100px; resize:none;" required placeholder="내용"></textarea><button type="submit" class="btn-primary">공지 올리기</button></form></div>
            <div class="admin-card"><h2>📝 주간 과제 배포</h2><form id="form-admin-hw"><select id="hw-target" class="admin-input"><option value="all">전체</option>${(data.users||[]).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select><div style="display:flex; gap:10px;"><input type="text" id="hw-week" class="admin-input" value="${autoWeek}" required><input type="date" id="hw-date" class="admin-input" required></div><textarea id="hw-desc" class="admin-input" placeholder="과제 내용" required style="height:80px;"></textarea><button type="submit" class="btn-primary">배포</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>📁 강의 업로드</h2><form id="form-admin-lec" style="display:flex; gap:10px;"><input type="text" id="lec-title" class="admin-input" placeholder="강의 제목" required style="margin:0;"><input type="url" id="lec-link" class="admin-input" placeholder="URL 링크" required style="margin:0;"><button type="submit" class="btn-primary" style="width:auto; padding:0 30px;">업로드</button></form></div>
            <div class="admin-card" style="grid-column:1/-1;"><h2>💬 학생 제출함</h2>${(!data.hwSubmissions || data.hwSubmissions.length===0) ? '<p style="color:var(--text-muted); text-align:center;">제출된 숙제가 없습니다.</p>' : data.hwSubmissions.map(s => `<div style="border:1px solid var(--border); padding:20px; border-radius:12px; margin-bottom:15px; background:var(--bg-dark);"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><strong>👤 ${s.studentName} 학생 제출본</strong><span style="color:${s.status==='approved'?'#10b981':(s.status==='rejected'?'#ef4444':'#60a5fa')}">${s.status === 'approved' ? '승인' : (s.status === 'rejected' ? '반려' : '대기중')}</span></div><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:15px; border-bottom:1px solid var(--border);">${s.files.map((f) => `<a href="${f.data}" download="${f.name}" style="background:#1e293b; padding:10px 15px; border-radius:8px; font-size:12px; font-weight:600; color:white; border:1px solid #334155; white-space:nowrap;">📄 ${f.name}</a>`).join('')}</div><div style="display:flex; gap:10px;">${s.status === 'pending' ? `<button class="btn-primary btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="approved">✅ 승인</button><button class="btn-primary btn-sm" style="background:#ef4444;" data-action="review-hw" data-subid="${s.id}" data-status="rejected">❌ 반려</button>` : `<button class="btn-text btn-sm" data-action="review-hw" data-subid="${s.id}" data-status="pending">상태 초기화</button>`}</div></div>`).join('')}</div>
        `;
    }
    else if (tab === 'settings') {
        html += `
        <div class="admin-card" style="grid-column:1/-1;">
            <h2 style="margin-bottom:20px;">⚙️ 홈페이지 실시간 편집</h2>
            <form id="form-admin-settings" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:var(--primary);">1. 메인 배너</h3>
                    <input type="text" id="set-h-sub" class="admin-input" value="${ld.heroSub}">
                    <textarea id="set-h-tit" class="admin-input" style="height:70px;">${ld.heroTitle.replace(/<br>/g, '\n')}</textarea>
                    <input type="text" id="set-h-desc" class="admin-input" value="${ld.heroDesc}">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:var(--primary);">2. 통계 지표</h3>
                    <div style="display:flex; gap:10px;"><input type="text" id="set-s1-n" class="admin-input" value="${ld.s1Num}"><input type="text" id="set-s1-t" class="admin-input" value="${ld.s1Txt}"></div>
                    <div style="display:flex; gap:10px;"><input type="text" id="set-s2-n" class="admin-input" value="${ld.s2Num}"><input type="text" id="set-s2-t" class="admin-input" value="${ld.s2Txt}"></div>
                    <div style="display:flex; gap:10px;"><input type="text" id="set-s3-n" class="admin-input" value="${ld.s3Num}"><input type="text" id="set-s3-t" class="admin-input" value="${ld.s3Txt}"></div>
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:var(--primary);">3. 특징 섹션 (왼쪽)</h3>
                    <div style="display:flex; gap:10px;"><input type="text" id="set-f1-b" class="admin-input" value="${ld.f1Badge}"><select id="set-f1-c" class="admin-input"><option value="red" ${ld.f1Col==='red'?'selected':''}>빨강</option><option value="blue" ${ld.f1Col==='blue'?'selected':''}>파랑</option><option value="green" ${ld.f1Col==='green'?'selected':''}>초록</option></select></div>
                    <input type="text" id="set-f1-t" class="admin-input" value="${ld.f1Title}"><input type="text" id="set-f1-d" class="admin-input" value="${ld.f1Desc}"><input type="text" id="set-f1-e" class="admin-input" value="${ld.f1Emoji}">
                </div>
                <div style="background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:var(--primary);">4. 특징 섹션 (오른쪽)</h3>
                    <div style="display:flex; gap:10px;"><input type="text" id="set-f2-b" class="admin-input" value="${ld.f2Badge}"><select id="set-f2-c" class="admin-input"><option value="red" ${ld.f2Col==='red'?'selected':''}>빨강</option><option value="blue" ${ld.f2Col==='blue'?'selected':''}>파랑</option><option value="green" ${ld.f2Col==='green'?'selected':''}>초록</option></select></div>
                    <input type="text" id="set-f2-t" class="admin-input" value="${ld.f2Title}"><input type="text" id="set-f2-d" class="admin-input" value="${ld.f2Desc}"><input type="text" id="set-f2-e" class="admin-input" value="${ld.f2Emoji}">
                </div>
                <div style="grid-column:1/-1; background:var(--bg-dark); padding:20px; border-radius:12px;">
                    <h3 style="margin-bottom:15px; font-size:1rem; color:var(--primary);">5. 하단 CTA 배너</h3><input type="text" id="set-b-tit" class="admin-input" value="${ld.botTitle}" style="margin:0;">
                </div>
                <button type="submit" class="btn-primary" style="grid-column:1/-1; padding:15px; font-size:1.1rem;">홈페이지 저장 및 실시간 반영</button>
            </form>
        </div>`;
    }
    else { html += `<div class="admin-card" style="grid-column:1/-1;"><p style="text-align:center; padding:40px; color:var(--text-muted);">준비 중입니다.</p></div>`; }
    html += '</div>';
    container.innerHTML = html;
}

// =========================================================
// [5] 통합 이벤트 위임 컨트롤러 (클릭 씹힘 완벽 방어)
// =========================================================
document.body.addEventListener('change', async (e) => {
    if (e.target.matches('input[type="file"][data-hwid]')) {
        const files = Array.from(e.target.files);
        if(files.length === 0) return;
        if(files.some(f => f.size > 2 * 1024 * 1024)) { e.target.value = ''; return showToast('⚠️ 2MB 이하 파일만 가능'); }
        showToast("파일 처리 중...");
        try {
            const b64 = await Promise.all(files.map(f => new Promise(res => {
                const r = new FileReader(); r.onload = ev => res({ name: f.name, data: ev.target.result }); r.readAsDataURL(f);
            })));
            if(!AppState.data.hwSubmissions) AppState.data.hwSubmissions = [];
            AppState.data.hwSubmissions.push({ id: generateId(), hwId: e.target.dataset.hwid, studentId: AppState.currentUser.id, studentName: AppState.currentUser.name, files: b64, status: 'pending' });
            syncData(); showToast("✅ 제출 완료!");
        } catch (err) { showToast("❌ 파일 오류 발생"); }
    }
});

document.body.addEventListener('click', (e) => {
    // 버튼 내 아이콘이나 텍스트를 클릭해도 무조건 data-action을 찾음
    const actionNode = e.target.closest('[data-action]');
    if (!actionNode) return;
    
    const action = actionNode.dataset.action;

    // 네비게이션
    if (action === 'nav') {
        switchView(actionNode.dataset.target);
    }
    else if (action === 'auth-toggle') {
        if(AppState.currentUser) { AppState.currentUser = null; localStorage.removeItem('studycampus_session'); showToast("로그아웃 완료"); switchView('landing'); }
        else switchView('auth');
    }
    else if (action === 'switch-auth') {
        switchAuthMode(actionNode.dataset.mode);
    }
    
    // 탭 스위치
    else if (action === 'switch-admin-tab') { 
        AppState.adminTab = actionNode.dataset.tab; 
        renderAdminDashboard(); 
    }
    else if (action === 'switch-student-tab') { 
        AppState.studentTab = actionNode.dataset.tab; 
        if(AppState.studentTab !== 'lectures') { clearInterval(AppState.lectureTimer); AppState.activeLecture = null; }
        renderStudentDashboard(); 
    }
    
    // 학생 액션
    else if (action === 'open-lecture') { 
        AppState.activeLecture = AppState.data.lectures.find(l => l.id === actionNode.dataset.id); 
        renderStudentDashboard(); 
    }
    else if (action === 'play-video') {
        if(AppState.lectureTimer) clearInterval(AppState.lectureTimer);
        const lecId = AppState.activeLecture.id;
        const userIdx = AppState.data.users.findIndex(u => u.id === AppState.currentUser.id);
        if(!AppState.data.users[userIdx].lectureProgress) AppState.data.users[userIdx].lectureProgress = {};
        
        let prog = AppState.data.users[userIdx].lectureProgress[lecId]?.percent || 0;
        actionNode.innerHTML = '⏸️'; showToast("수강 기록 시작됨");
        
        AppState.lectureTimer = setInterval(() => {
            prog += 5; 
            if (prog >= 90) { prog = 100; clearInterval(AppState.lectureTimer); AppState.data.users[userIdx].lectureProgress[lecId] = { percent: 100, done: true }; syncData(); showToast("🎉 90% 달성 완료!"); } 
            else { AppState.data.users[userIdx].lectureProgress[lecId] = { percent: prog, done: false }; }
            
            const bar = document.getElementById('live-progress-bar'); const txt = document.getElementById('live-progress-text');
            if(bar) bar.style.width = prog + '%'; if(txt) txt.textContent = prog + '%';
        }, 1000);
    }
    else if (action === 'trigger-file') {
        document.getElementById(`hw-file-${actionNode.dataset.id}`).click();
    }
    else if (action === 'cancel-hw') { 
        AppState.data.hwSubmissions = AppState.data.hwSubmissions.filter(s => s.id !== actionNode.dataset.subid); 
        syncData(); showToast("기존 제출본이 취소되었습니다."); 
    }
    else if (action === 'delete-account') { 
        if(confirm("탈퇴하시겠습니까? (데이터 삭제)")) { AppState.data.users = AppState.data.users.filter(u => u.id !== AppState.currentUser.id); syncData(); localStorage.removeItem('studycampus_session'); AppState.currentUser = null; switchView('landing'); } 
    }
    
    // 관리자 액션
    else if (action === 'toggle-user') { 
        const user = AppState.data.users.find(u => String(u.id) === String(actionNode.dataset.id)); 
        if(user) user.active = !user.active; syncData(); showToast("상태가 변경되었습니다.");
    }
    else if (action === 'delete-user') {
        if(confirm("정말 삭제하시겠습니까?")) {
            AppState.data.users = AppState.data.users.filter(u => u.id !== actionNode.dataset.id);
            syncData(); showToast("삭제되었습니다."); renderAdminDashboard();
        }
    }
    else if (action === 'open-admin-modal') {
        AppState.adminModal = { isOpen: true, mode: actionNode.dataset.mode, studentId: actionNode.dataset.id || null };
        renderAdminDashboard();
    }
    else if (action === 'close-admin-modal') {
        AppState.adminModal.isOpen = false;
        renderAdminDashboard();
    }
    else if (action === 'review-hw') { 
        const sub = AppState.data.hwSubmissions.find(s => s.id === actionNode.dataset.subid); 
        if(sub) { sub.status = actionNode.dataset.status; syncData(); showToast("검사 상태 변경"); } 
    }
});

document.body.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if(e.target.id === 'form-login') {
        const id = document.getElementById('login-id').value.trim(); 
        const pw = document.getElementById('login-pw').value.trim();
        
        if(id === 'studycampus' && pw === 'studycampus26') { 
            AppState.currentUser = { id: 'admin', name: '최고관리자', role: 'admin' }; 
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); 
            switchView('admin'); 
        } 
        else {
            const user = (AppState.data.users||[]).find(u => u.id === id);
            if(user && user.active && (!user.pw || user.pw === pw)) { 
                AppState.currentUser = user; localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser)); switchView('student'); 
            } else showToast("계정 정보나 비밀번호를 확인해주세요.");
        }
    }
    else if(e.target.id === 'form-register') {
        const id = document.getElementById('reg-id').value.trim();
        if(!AppState.data.users) AppState.data.users = [];
        if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("존재하는 아이디입니다.");
        
        const d = new Date(); d.setDate(d.getDate() + 30);
        AppState.data.users.push({ 
            id, name: document.getElementById('reg-name').value || id, pw: document.getElementById('reg-pw').value,
            school: document.getElementById('reg-school').value, grade: document.getElementById('reg-grade').value,
            role: 'student', active: true, xp: 0, ticketExpiry: d.toISOString().split('T')[0]
        });
        syncData(); showToast("가입 완료. 로그인 해주세요!"); 
        switchAuthMode('login');
    }
    else if(e.target.id === 'form-admin-student') {
        const mode = AppState.adminModal.mode;
        const id = document.getElementById('mod-stu-id').value.trim();
        const name = document.getElementById('mod-stu-name').value.trim();
        const pw = document.getElementById('mod-stu-pw').value.trim();
        const school = document.getElementById('mod-stu-school').value.trim();
        const grade = document.getElementById('mod-stu-grade').value.trim();
        const expiry = document.getElementById('mod-stu-expiry').value;

        if(!AppState.data.users) AppState.data.users = [];

        if (mode === 'add') {
            if(AppState.data.users.some(u => u.id === id) || id === 'studycampus') return showToast("존재하는 아이디입니다.");
            AppState.data.users.unshift({ id, name, pw, school, grade, role: 'student', active: true, xp: 0, ticketExpiry: expiry || '' });
            showToast("원생이 추가되었습니다.");
        } else if (mode === 'edit') {
            const userIdx = AppState.data.users.findIndex(u => u.id === AppState.adminModal.studentId);
            if(userIdx > -1) {
                AppState.data.users[userIdx].name = name;
                AppState.data.users[userIdx].school = school;
                AppState.data.users[userIdx].grade = grade;
                AppState.data.users[userIdx].ticketExpiry = expiry || '';
                if(pw) AppState.data.users[userIdx].pw = pw;
            }
            showToast("정보가 수정되었습니다.");
        }
        AppState.adminModal.isOpen = false;
        syncData(); renderAdminDashboard();
    }
    else if(e.target.id === 'form-community') {
        if (!AppState.data.community) AppState.data.community = [];
        AppState.data.community.unshift({ id: generateId(), author: AppState.currentUser.name, content: document.getElementById('comm-text').value, date: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
        syncData(); showToast("게시물 등록됨");
    }
    else if(e.target.id === 'form-admin-hw') {
        if(!AppState.data.homework) AppState.data.homework = [];
        const tVal = document.getElementById('hw-target').value;
        AppState.data.homework.unshift({ id: generateId(), target: tVal, type: tVal === 'all' ? 'all' : 'individual', week: document.getElementById('hw-week').value, date: document.getElementById('hw-date').value, day: document.getElementById('hw-day').value, desc: document.getElementById('hw-desc').value });
        syncData(); showToast("배포 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-lec') {
        if(!AppState.data.lectures) AppState.data.lectures = [];
        AppState.data.lectures.push({ id: generateId(), title: document.getElementById('lec-title').value, link: document.getElementById('lec-link').value });
        syncData(); showToast("업로드 완료"); e.target.reset();
    }
    else if(e.target.id === 'form-admin-settings') {
        AppState.data.landing = {
            heroSub: document.getElementById('set-h-sub').value, heroTitle: document.getElementById('set-h-tit').value.replace(/\n/g, '<br>'), heroDesc: document.getElementById('set-h-desc').value,
            s1Num: document.getElementById('set-s1-n').value, s1Txt: document.getElementById('set-s1-t').value, s2Num: document.getElementById('set-s2-n').value, s2Txt: document.getElementById('set-s2-t').value, s3Num: document.getElementById('set-s3-n').value, s3Txt: document.getElementById('set-s3-t').value,
            f1Badge: document.getElementById('set-f1-b').value, f1Col: document.getElementById('set-f1-c').value, f1Title: document.getElementById('set-f1-t').value, f1Desc: document.getElementById('set-f1-d').value, f1Emoji: document.getElementById('set-f1-e').value,
            f2Badge: document.getElementById('set-f2-b').value, f2Col: document.getElementById('set-f2-c').value, f2Title: document.getElementById('set-f2-t').value, f2Desc: document.getElementById('set-f2-d').value, f2Emoji: document.getElementById('set-f2-e').value,
            botTitle: document.getElementById('set-b-tit').value
        };
        syncData(); showToast("홈페이지 실시간 변경 완료!");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    try {
        const session = localStorage.getItem('studycampus_session');
        if (session) AppState.currentUser = JSON.parse(session);
    } catch (e) {}
    switchView(AppState.currentUser ? (AppState.currentUser.role === 'admin' ? 'admin' : 'student') : 'landing');
});
