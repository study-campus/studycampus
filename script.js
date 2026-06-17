// 깃허브 Pages에서 안전하게 실행되는 모듈 불러오기 방식
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// 🔥 미국 서버 주소(databaseURL)가 추가된 완벽한 설정 코드
const firebaseConfig = {
    apiKey: "AIzaSyCHwxv-MJBK8wXA4C1Q98jDEh_ESRbhaBI",
    authDomain: "studycampus-6e42f.firebaseapp.com",
    databaseURL: "https://studycampus-6e42f-default-rtdb.firebaseio.com",
    projectId: "studycampus-6e42f",
    storageBucket: "studycampus-6e42f.firebasestorage.app",
    messagingSenderId: "1076988511909",
    appId: "1:1076988511909:web:93cb4044969146543f2f4c",
    measurementId: "G-GCJXB5YGGZ"
};

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// 앱 통합 상태 관리 (State)
const AppState = {
    data: { users: [], notices: [], weeklyControls: [], lectures: [], community: [], payments: [] },
    currentUser: null,
    currentView: 'landing',
    authMode: 'login',
    studentTab: 'notices',
    adminTab: 'users'
};

// ==========================================
// 유틸리티 함수
// ==========================================
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

function initTheme() {
    const applySystemTheme = () => {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.remove('dark-theme', 'light-theme');
        document.body.classList.add(isDark ? 'dark-theme' : 'light-theme');
    };
    applySystemTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);
}

// ==========================================
// 파이어베이스 실시간 데이터 동기화
// ==========================================
const dbRef = ref(db, 'studycampus_data');

// 데이터가 변경될 때마다 자동으로 화면을 새로고침하는 핵심 로직
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) {
        AppState.data = serverData;
    } else {
        set(dbRef, AppState.data); // 서버가 비어있으면 초기 세팅 전송
    }
    renderCurrentDashboard(); // 데이터 수신 시 화면 즉시 렌더링
});

function syncData() {
    set(dbRef, AppState.data).catch(err => {
        console.error(err);
        showToast("데이터베이스 저장 오류! 파이어베이스 보안 규칙을 확인하세요.");
    });
}

// ==========================================
// 화면 전환 (Router) 및 렌더링
// ==========================================
function switchView(viewName) {
    AppState.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    
    // 학생/관리자 대시보드 진입 시 랜딩화면 요소 숨김 처리
    const isAppView = viewName === 'student' || viewName === 'admin';
    document.querySelectorAll('.global-element').forEach(el => el.classList.toggle('hidden', isAppView));
    
    if (AppState.currentUser) {
        if (viewName === 'student') document.getElementById('student-profile-name').textContent = AppState.currentUser.name;
        else if (viewName === 'admin') document.getElementById('admin-profile-name').textContent = AppState.currentUser.name;
    }
    
    if (!isAppView) renderNavbar();
    renderCurrentDashboard();
}

function renderNavbar() {
    const navLinks = document.getElementById('nav-links');
    const authBtn = document.getElementById('auth-action-btn');
    const profileTag = document.getElementById('user-profile-tag');
    let linksHTML = `<li data-action="nav" data-target="landing">홈</li>`;
    
    if (AppState.currentUser) {
        profileTag.classList.remove('hidden');
        profileTag.textContent = `${AppState.currentUser.name}(${AppState.currentUser.role === 'admin' ? '관리자' : '학생'})`;
        authBtn.textContent = '로그아웃';
        linksHTML += `<li data-action="nav" data-target="${AppState.currentUser.role === 'admin' ? 'admin' : 'student'}">대시보드</li>`;
    } else {
        profileTag.classList.add('hidden');
        authBtn.textContent = '로그인';
    }
    navLinks.innerHTML = linksHTML;
}

function renderCurrentDashboard() {
    if (!AppState.currentUser) return;
    if (AppState.currentUser.role === 'admin' && AppState.currentView === 'admin') renderAdminDashboard();
    else if (AppState.currentUser.role === 'student' && AppState.currentView === 'student') renderStudentDashboard();
}

// 학생 렌더링 시스템
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const tab = AppState.studentTab;
    const data = AppState.data;
    let html = '<div class="app-content-inner">';

    const tabTitles = { notices: '📢 공지사항', weekly: '📊 나의 주간 관제', lectures: '📖 강의 및 자료', community: '💭 커뮤니티', payments: '💳 결제/승인 요청' };
    document.getElementById('student-page-title').textContent = tabTitles[tab];
    document.querySelectorAll('#student-sidebar li').forEach(li => li.classList.toggle('active', li.dataset.tab === tab));

    if (tab === 'notices') {
        if (!data.notices || data.notices.length === 0) html += `<div class="empty-state">등록된 공지사항이 없습니다.</div>`;
        else data.notices.forEach(n => html += `<div class="modern-card"><h3 style="margin-bottom:0.75rem; font-size:1.15rem;">${n.title}</h3><p style="color:var(--text-muted); line-height:1.6; white-space:pre-wrap;">${n.content}</p></div>`);
    } else if (tab === 'weekly') {
        const myControls = (data.weeklyControls || []).filter(c => c.userId === AppState.currentUser.id);
        if(myControls.length === 0) html += `<div class="empty-state">배포된 주간 관제 계획이 없습니다.</div>`;
        else myControls.forEach(c => html += `<div class="modern-card"><div class="flex-between" style="margin-bottom:1rem;"><h3 style="font-size:1.15rem;">📆 ${c.week}</h3><span class="badge badge-success">관제 진행중</span></div><div style="background:var(--bg-hover); padding:1rem; border-radius:8px; margin-bottom:1rem;"><span style="color:var(--text-muted); font-size:0.85rem; display:block;">🎯 배포 목표</span><strong style="font-size:1.05rem;">${c.target}</strong></div><span style="color:var(--text-muted); font-size:0.85rem; display:block;">📈 달성 현황</span><span style="font-weight:600; color:var(--accent);">${c.tracking}</span></div>`);
    } else if (tab === 'lectures') {
        if (!data.lectures || data.lectures.length === 0) html += `<div class="empty-state">등록된 강의가 없습니다.</div>`;
        else data.lectures.forEach(l => html += `<div class="modern-card flex-between"><div><h3 style="margin-bottom:0.5rem; font-size:1.1rem;">${l.title}</h3><p style="color:var(--text-muted); font-size:0.95rem;">${l.description}</p></div><a href="${l.link}" target="_blank" class="btn-primary" style="padding:0.6rem 1.2rem;">자료 열기</a></div>`);
    } else if (tab === 'community') {
        html += `<div class="modern-card" style="margin-bottom:2rem;"><form id="form-community"><textarea id="comm-text" class="modern-input" required placeholder="질문이나 피드백을 남겨보세요." style="height:100px; margin-bottom:1rem;"></textarea><div style="text-align:right;"><button type="submit" class="btn-primary">게시물 등록</button></div></form></div>`;
        if (!data.community || data.community.length === 0) html += `<div class="empty-state">첫 게시물을 작성해 보세요!</div>`;
        else data.community.forEach(c => html += `<div class="modern-card"><div class="flex-between" style="margin-bottom:0.75rem;"><strong style="font-size:1rem;">👤 ${c.author}</strong><span style="color:var(--text-muted); font-size:0.85rem;">${c.date || ''}</span></div><p style="line-height:1.6; white-space:pre-wrap;">${c.content}</p></div>`);
    } else if (tab === 'payments') {
        html += `<div class="modern-card" style="margin-bottom:2rem;"><h3 style="margin-bottom:1.5rem;">새 결제 승인 요청</h3><form id="form-payment"><div class="form-group"><label>수강 상품</label><select id="pay-item" class="modern-input"><option>7월 종합반 패키지</option><option>프리미엄 1:1 멤버십</option></select></div><div class="form-group"><label>금액 (원)</label><input type="number" id="pay-amount" class="modern-input" required placeholder="150000"></div><div style="text-align:right;"><button type="submit" class="btn-primary">승인 청구 요청</button></div></form></div><h3 style="margin-bottom:1rem;">내 승인 요청 이력</h3><div class="modern-card" style="padding:0;"><table class="modern-table"><thead><tr><th>신청 상품</th><th>금액</th><th>상태</th></tr></thead><tbody>`;
        const myPayments = (data.payments || []).filter(p => p.userId === AppState.currentUser.id);
        if(myPayments.length === 0) html += `<tr><td colspan="3" class="empty-state" style="border:none;">요청 이력이 없습니다.</td></tr>`;
        else myPayments.forEach(p => html += `<tr><td>${p.item}</td><td>${Number(p.amount).toLocaleString()}원</td><td><span class="badge ${p.status === '승인완료' ? 'badge-success' : 'badge-danger'}">${p.status}</span></td></tr>`);
        html += `</tbody></table></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// 관리자 렌더링 시스템
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab;
    const data = AppState.data;
    let html = '<div class="app-content-inner">';

    const tabTitles = { users: '👥 학생 회원 관리', notices: '📢 공지 배포', weekly: '📈 주간 관제 배포', lectures: '📁 자료/강의 업로드', community: '💬 커뮤니티 관리', payments: '💰 결제 승인 관리' };
    document.getElementById('admin-page-title').textContent = tabTitles[tab];
    document.querySelectorAll('#admin-sidebar li').forEach(li => li.classList.toggle('active', li.dataset.tab === tab));

    if (tab === 'users') {
        html += `<div class="modern-card" style="padding:0;"><table class="modern-table"><thead><tr><th>아이디</th><th>학생명</th><th>상태</th><th>관리</th></tr></thead><tbody>`;
        if (!data.users || data.users.length === 0) html += `<tr><td colspan="4" class="empty-state" style="border:none;">가입 학생이 없습니다.</td></tr>`;
        else data.users.forEach(u => html += `<tr><td><span style="font-weight:500;">${u.id}</span></td><td>${u.name}</td><td><span class="badge ${u.active ? 'badge-success' : 'badge-danger'}">${u.active ? '활성' : '정지'}</span></td><td><button class="btn-sm ${u.active ? 'btn-outline' : 'btn-primary'}" data-action="toggle-user" data-id="${u.id}">${u.active ? '접근 제한' : '접근 복구'}</button></td></tr>`);
        html += `</tbody></table></div>`;
    } else if (tab === 'notices') {
        html += `<div class="modern-card"><h3 style="margin-bottom:1.5rem;">새 공지사항 작성</h3><form id="form-admin-notice"><div class="form-group"><label>공지 제목</label><input type="text" id="adm-notice-title" class="modern-input" required></div><div class="form-group"><label>내용</label><textarea id="adm-notice-content" class="modern-input" style="height:120px;" required></textarea></div><div style="text-align:right;"><button type="submit" class="btn-primary">공지 배포하기</button></div></form></div><h3 style="margin:2rem 0 1rem;">배포된 공지 리스트</h3>`;
        if (!data.notices || data.notices.length === 0) html += `<div class="empty-state">배포된 공지가 없습니다.</div>`;
        else data.notices.forEach(n => html += `<div class="modern-card flex-between"><div><h4 style="margin-bottom:0.5rem; font-size:1.05rem;">${n.title}</h4><p style="color:var(--text-muted); font-size:0.9rem; white-space:pre-wrap;">${n.content}</p></div><button class="btn-sm btn-danger-outline" style="flex-shrink:0; margin-left:1rem;" data-action="delete-notice" data-id="${n.id}">삭제</button></div>`);
    } else if (tab === 'weekly') {
        html += `<div class="modern-card"><h3 style="margin-bottom:1.5rem;">신규 주간 관제 설정</h3><form id="form-admin-weekly"><div class="form-group"><label>대상 학생 선택</label><select id="adm-week-user" class="modern-input">${!data.users || data.users.length === 0 ? '<option value="">가입 학생 없음</option>' : data.users.map(u => `<option value="${u.id}">${u.name} (${u.id})</option>`).join('')}</select></div><div class="form-group"><label>주차 정보</label><input type="text" id="adm-week-date" class="modern-input" placeholder="예: 7월 1주차" required></div><div class="form-group"><label>학습 목표</label><input type="text" id="adm-week-target" class="modern-input" required></div><div class="form-group"><label>피드백 상태</label><input type="text" id="adm-week-track" class="modern-input" value="대기중" required></div><div style="text-align:right;"><button type="submit" class="btn-primary">관제 업데이트 전송</button></div></form></div>`;
    } else if (tab === 'lectures') {
        html += `<div class="modern-card"><h3 style="margin-bottom:1.5rem;">신규 자료 및 강의 등록</h3><form id="form-admin-lecture"><div class="form-group"><label>강의/교재 명칭</label><input type="text" id="adm-lec-title" class="modern-input" required></div><div class="form-group"><label>접근 URL</label><input type="url" id="adm-lec-link" class="modern-input" required placeholder="https://"></div><div class="form-group"><label>가이드 설명</label><textarea id="adm-lec-desc" class="modern-input" style="height:100px; resize:none;"></textarea></div><div style="text-align:right;"><button type="submit" class="btn-primary">리소스 업로드</button></div></form></div>`;
    } else if (tab === 'community') {
        html += `<h3 style="margin-bottom:1.5rem;">작성된 게시물 관리</h3>`;
        if (!data.community || data.community.length === 0) html += `<div class="empty-state">작성된 게시물이 없습니다.</div>`;
        else data.community.forEach(c => html += `<div class="modern-card flex-between"><div style="flex:1;"><strong style="font-size:1rem; display:block; margin-bottom:0.5rem;">👤 ${c.author} <span style="color:var(--text-muted); font-size:0.85rem; font-weight:400; margin-left:0.5rem;">${c.date || ''}</span></strong><p style="line-height:1.6; white-space:pre-wrap;">${c.content}</p></div><button class="btn-sm btn-danger-outline" data-action="delete-post" data-id="${c.id}" style="margin-left:1rem; flex-shrink:0;">삭제</button></div>`);
    } else if (tab === 'payments') {
        html += `<h3 style="margin-bottom:1rem;">결제 승인 대기열</h3><div class="modern-card" style="padding:0;"><table class="modern-table"><thead><tr><th>신청 학생</th><th>요청 상품</th><th>금액</th><th>상태 조치</th></tr></thead><tbody>`;
        if (!data.payments || data.payments.length === 0) html += `<tr><td colspan="4" class="empty-state" style="border:none;">요청 내역이 없습니다.</td></tr>`;
        else data.payments.forEach(p => html += `<tr><td><span style="font-weight:500;">${p.userId}</span></td><td>${p.item}</td><td>${Number(p.amount).toLocaleString()}원</td><td>${p.status === '승인대기' ? `<button class="btn-sm btn-primary" data-action="approve-payment" data-id="${p.id}">승인 처리</button>` : `<span class="badge badge-success">승인 완료</span>`}</td></tr>`);
        html += `</tbody></table></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// 이벤트 핸들링 (이벤트 위임 기법)
// ==========================================
function setAuthMode(mode) {
    AppState.authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('reg-name-group').classList.toggle('hidden', mode === 'login');
    document.getElementById('auth-submit-btn').textContent = mode === 'login' ? '로그인' : '회원가입 완료';
}

function handleAuthSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('auth-id').value.trim();
    const pw = document.getElementById('auth-pw').value.trim();
    const name = document.getElementById('auth-name').value.trim();

    if (AppState.authMode === 'login') {
        if (id === 'studycampus' && pw === 'studycampus26') {
            AppState.currentUser = { id: 'admin', name: '최고관리자', role: 'admin' };
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser));
            showToast("관리자로 로그인되었습니다.");
            switchView('admin');
            return;
        }
        const user = (AppState.data.users || []).find(u => u.id === id);
        if (user && user.active) {
            AppState.currentUser = { id: user.id, name: user.name, role: 'student' };
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser));
            showToast(`${user.name}님 환영합니다!`);
            switchView('student');
        } else showToast('아이디를 확인하시거나 정지된 계정인지 문의하세요.');
    } else {
        if (!id || id === 'studycampus' || (AppState.data.users || []).some(u => u.id === id)) {
            return showToast('사용할 수 없거나 이미 존재하는 아이디입니다.');
        }
        if (!AppState.data.users) AppState.data.users = [];
        AppState.data.users.push({ id, name: name || id, role: 'student', active: true });
        syncData();
        showToast('회원가입 완료! 로그인 해주세요.');
        setAuthMode('login');
    }
}

// 글로벌 이벤트 리스너 바인딩
function initializeAppLogic() {
    try {
        const session = localStorage.getItem('studycampus_session');
        if (session) AppState.currentUser = JSON.parse(session);
    } catch (e) {}

    initTheme();
    switchView(AppState.currentUser ? (AppState.currentUser.role === 'admin' ? 'admin' : 'student') : 'landing');

    document.body.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'nav') switchView(e.target.dataset.target);
        else if (e.target.dataset.action === 'auth-toggle') {
            if (AppState.currentUser) {
                AppState.currentUser = null;
                localStorage.removeItem('studycampus_session');
                showToast("안전하게 로그아웃 되었습니다.");
                switchView('landing');
            } else switchView('auth');
        }
        else if (e.target.dataset.authMode) setAuthMode(e.target.dataset.authMode);
        else if (e.target.closest('li[data-tab]')) {
            const tab = e.target.closest('li[data-tab]').dataset.tab;
            if (e.target.closest('#student-sidebar')) { AppState.studentTab = tab; renderStudentDashboard(); }
            else if (e.target.closest('#admin-sidebar')) { AppState.adminTab = tab; renderAdminDashboard(); }
        }
        else if (e.target.dataset.action === 'toggle-user') {
            const user = AppState.data.users.find(u => String(u.id) === String(e.target.dataset.id));
            if(user) user.active = !user.active;
            syncData(); showToast(user.active ? "접근이 복구되었습니다." : "접근이 제한되었습니다.");
        }
        else if (e.target.dataset.action === 'delete-notice') {
            AppState.data.notices = AppState.data.notices.filter(n => String(n.id) !== String(e.target.dataset.id));
            syncData(); showToast("공지가 삭제되었습니다.");
        }
        else if (e.target.dataset.action === 'delete-post') {
            AppState.data.community = AppState.data.community.filter(c => String(c.id) !== String(e.target.dataset.id));
            syncData(); showToast("게시물이 삭제되었습니다.");
        }
        else if (e.target.dataset.action === 'approve-payment') {
            const payment = AppState.data.payments.find(p => String(p.id) === String(e.target.dataset.id));
            if(payment) payment.status = '승인완료';
            syncData(); showToast("결제가 승인되었습니다.");
        }
    });

    document.body.addEventListener('submit', (e) => {
        e.preventDefault();
        if (e.target.id === 'auth-form') handleAuthSubmit(e);
        else if (e.target.id === 'form-community') {
            if (!AppState.data.community) AppState.data.community = [];
            const date = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            AppState.data.community.unshift({ id: generateId(), author: AppState.currentUser.name, content: document.getElementById('comm-text').value, date });
            syncData(); showToast("게시물이 등록되었습니다.");
        }
        else if (e.target.id === 'form-payment') {
            if (!AppState.data.payments) AppState.data.payments = [];
            AppState.data.payments.push({ id: generateId(), userId: AppState.currentUser.id, item: document.getElementById('pay-item').value, amount: document.getElementById('pay-amount').value, status: '승인대기' });
            syncData(); showToast("결제 승인이 요청되었습니다.");
        }
        else if (e.target.id === 'form-admin-notice') {
            if (!AppState.data.notices) AppState.data.notices = [];
            AppState.data.notices.unshift({ id: generateId(), title: document.getElementById('adm-notice-title').value, content: document.getElementById('adm-notice-content').value });
            syncData(); showToast("공지가 배포되었습니다.");
        }
        else if (e.target.id === 'form-admin-weekly') {
            const userId = document.getElementById('adm-week-user').value;
            if(!userId) return showToast('대상 학생을 선택해주세요.');
            if (!AppState.data.weeklyControls) AppState.data.weeklyControls = [];
            AppState.data.weeklyControls.unshift({ id: generateId(), userId, week: document.getElementById('adm-week-date').value, target: document.getElementById('adm-week-target').value, tracking: document.getElementById('adm-week-track').value });
            syncData(); showToast("관제 정보가 업데이트 되었습니다.");
        }
        else if (e.target.id === 'form-admin-lecture') {
            if (!AppState.data.lectures) AppState.data.lectures = [];
            AppState.data.lectures.unshift({ id: generateId(), title: document.getElementById('adm-lec-title').value, link: document.getElementById('adm-lec-link').value, description: document.getElementById('adm-lec-desc').value });
            syncData(); showToast("자료가 업로드 되었습니다.");
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeAppLogic);
