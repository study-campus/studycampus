// [1] 파이어베이스 및 모듈 임포트
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// [2] 파이어베이스 설정 (본인 코드로 변경 필수)
const firebaseConfig = {
    apiKey: "AIzaSyCHwxv-MJBK8wXA4C1Q98jDEh_ESRbhaBI",
    authDomain: "studycampus-6e42f.firebaseapp.com",
    projectId: "studycampus-6e42f",
    storageBucket: "studycampus-6e42f.firebasestorage.app",
    messagingSenderId: "1076988511909",
    appId: "1:1076988511909:web:93cb4044969146543f2f4c",
    measurementId: "G-GCJXB5YGGZ"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// [3] 전역 상태 (State) 관리 객체
const AppState = {
    data: {
        users: [], notices: [], weeklyControls: [], lectures: [], community: [], payments: []
    },
    currentUser: null,
    currentView: 'landing',
    authMode: 'login',
    studentTab: 'notices',
    adminTab: 'users'
};

// ==========================================
// 유틸리티 함수 (체계화의 핵심)
// ==========================================

// 커스텀 토스트 알림 (기존 투박한 alert 대체)
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

// 고유 ID 생성기
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 테마 자동 감지
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
// 파이어베이스 데이터 통신 (Model)
// ==========================================

const dbRef = ref(db, 'studycampus_data');

// 실시간 수신
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) {
        AppState.data = serverData;
    } else {
        set(dbRef, AppState.data); // 서버가 비어있으면 초기 뼈대 전송
    }
    renderCurrentDashboard();
});

// 데이터 저장 (서버 전송)
function syncData() {
    set(dbRef, AppState.data).catch(err => {
        console.error(err);
        showToast("데이터 저장 실패: 네트워크를 확인하세요.");
    });
}

// ==========================================
// 화면 렌더링 (View)
// ==========================================

function switchView(viewName) {
    AppState.currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    
    // 푸터 표시 제어
    document.getElementById('main-footer').classList.toggle('hidden', viewName === 'auth');
    
    renderNavbar();
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
        
        if (AppState.currentUser.role === 'admin') {
            linksHTML += `<li data-action="nav" data-target="admin">관리자 패널</li>`;
        } else {
            linksHTML += `<li data-action="nav" data-target="student">대시보드</li>`;
        }
    } else {
        profileTag.classList.add('hidden');
        authBtn.textContent = '로그인';
    }
    navLinks.innerHTML = linksHTML;
}

function renderCurrentDashboard() {
    if (!AppState.currentUser) return;
    if (AppState.currentUser.role === 'admin' && AppState.currentView === 'admin') {
        renderAdminDashboard();
    } else if (AppState.currentUser.role === 'student' && AppState.currentView === 'student') {
        renderStudentDashboard();
    }
}

// 학생 렌더링
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const tab = AppState.studentTab;
    const { data, currentUser } = AppState;
    let html = '';

    // 탭 UI 액티브 상태 업데이트
    document.querySelectorAll('#student-sidebar li').forEach(li => {
        li.classList.toggle('active', li.dataset.tab === tab);
    });

    if (tab === 'notices') {
        html += `<h2>📢 전체 공지사항</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        if (!data.notices || data.notices.length === 0) html += `<p style="color:var(--text-muted);">등록된 공지사항이 없습니다.</p>`;
        else data.notices.forEach(n => html += `<div class="item-card"><h3 style="margin-bottom:0.5rem">${n.title}</h3><p style="color:var(--text-muted); white-space:pre-wrap;">${n.content}</p></div>`);
    } else if (tab === 'weekly') {
        html += `<h2>📊 나의 주간 관제 현황</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        const myControls = (data.weeklyControls || []).filter(c => c.userId === currentUser.id);
        if(myControls.length === 0) html += `<p style="color:var(--text-muted);">배포된 관제 계획이 없습니다.</p>`;
        else myControls.forEach(c => html += `<div class="item-card"><h3>📆 주차: ${c.week}</h3><p style="margin:0.5rem 0; color:var(--text-muted);">🎯 배포 목표: ${c.target}</p><p style="font-weight:600;">📈 달성 현황: ${c.tracking}</p></div>`);
    } else if (tab === 'lectures') {
        html += `<h2>📖 업로드 자료 및 강의 시청</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        if (!data.lectures || data.lectures.length === 0) html += `<p style="color:var(--text-muted);">등록된 강의가 없습니다.</p>`;
        else data.lectures.forEach(l => html += `<div class="item-card"><h3>${l.title}</h3><p style="margin:0.5rem 0; color:var(--text-muted);">${l.description}</p><a href="${l.link}" target="_blank" style="color:var(--primary); font-weight:bold; text-decoration:underline;">강의/자료 바로가기</a></div>`);
    } else if (tab === 'community') {
        html += `<h2>💭 커뮤니티 공간</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form id="form-community" style="margin-bottom:2rem;">
                <textarea id="comm-text" required placeholder="공부 피드백이나 질문을 남겨보세요." style="width:100%; padding:1rem; border-radius:8px; border:1px solid var(--border); background:var(--bg-main); color:var(--text-primary); resize:none; height:100px; margin-bottom:1rem;"></textarea>
                <button type="submit" class="btn-primary" style="float:right;">게시물 등록</button>
                <div style="clear:both;"></div>
            </form>`;
        if (!data.community || data.community.length === 0) html += `<p style="color:var(--text-muted);">첫 게시물을 작성해 보세요!</p>`;
        else data.community.forEach(c => html += `<div class="item-card"><strong>👤 ${c.author}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">${c.date || ''}</span><p style="margin-top:0.75rem; color:var(--text-muted); white-space:pre-wrap;">${c.content}</p></div>`);
    } else if (tab === 'payments') {
        html += `<h2>💳 결제 승인 요청</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form id="form-payment" style="margin-bottom:2rem; background:var(--bg-main); padding:1.5rem; border-radius:12px;">
                <div class="form-group"><label>수강 상품 항목</label><select id="pay-item"><option>종합반 패키지</option><option>1:1 멤버십</option></select></div>
                <div class="form-group"><label>청구 금액 (원)</label><input type="number" id="pay-amount" required placeholder="예: 150000"></div>
                <button type="submit" class="btn-primary" style="margin-top:0.5rem;">승인 청구 요청</button>
            </form>
            <h3 style="margin-bottom:1rem;">내 승인 요청 이력</h3>
            <table><thead><tr><th>신청 상품</th><th>금액</th><th>상태</th></tr></thead><tbody>
            ${(data.payments || []).filter(p => p.userId === currentUser.id).map(p => `<tr><td>${p.item}</td><td>${Number(p.amount).toLocaleString()}원</td><td><span class="${p.status === '승인완료' ? 'status-approved' : 'status-pending'}">${p.status}</span></td></tr>`).join('')}
            </tbody></table>`;
    }
    container.innerHTML = html;
}

// 관리자 렌더링
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab;
    const { data } = AppState;
    let html = '';

    document.querySelectorAll('#admin-sidebar li').forEach(li => {
        li.classList.toggle('active', li.dataset.tab === tab);
    });

    if (tab === 'users') {
        html += `<h2>👥 학생 회원 관리</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <table><thead><tr><th>아이디</th><th>학생명</th><th>현재 상태</th><th>통제 관리</th></tr></thead><tbody>
            ${!data.users || data.users.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem 0;">가입 학생 없음</td></tr>' : 
            data.users.map(u => `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.active ? '✅ 활성' : '❌ 정지'}</td><td><button class="${u.active ? 'btn-secondary' : 'btn-primary'}" data-action="toggle-user" data-id="${u.id}">${u.active ? '접근 제한' : '접근 복구'}</button></td></tr>`).join('')}
            </tbody></table>`;
    } else if (tab === 'notices') {
        html += `<h2>📢 공지 배포</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form id="form-admin-notice" style="margin-bottom:2.5rem; background:var(--bg-main); padding:1.5rem; border-radius:12px;">
                <div class="form-group"><label>공지 제목</label><input type="text" id="adm-notice-title" required></div>
                <div class="form-group"><label>내용</label><textarea id="adm-notice-content" required style="height:100px; resize:none;"></textarea></div>
                <button type="submit" class="btn-primary">공지 배포</button>
            </form>
            <h3>배포된 공지 리스트</h3><div style="margin-top:1rem;">
            ${!data.notices || data.notices.length === 0 ? '<p style="color:var(--text-muted);">배포된 공지 없음</p>' : 
            data.notices.map(n => `<div class="item-card flex-between"><div><h4 style="margin-bottom:0.5rem;">${n.title}</h4><p style="color:var(--text-muted); font-size:0.875rem; white-space:pre-wrap;">${n.content}</p></div><button class="btn-secondary" data-action="delete-notice" data-id="${n.id}">삭제</button></div>`).join('')}
            </div>`;
    } else if (tab === 'weekly') {
        html += `<h2>📈 주간 관제 배포</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form id="form-admin-weekly" style="background:var(--bg-main); padding:1.5rem; border-radius:12px;">
                <div class="form-group"><label>대상 학생 선택</label><select id="adm-week-user">${!data.users || data.users.length === 0 ? '<option value="">가입 학생 없음</option>' : data.users.map(u => `<option value="${u.id}">${u.name}(${u.id})</option>`).join('')}</select></div>
                <div class="form-group"><label>주차 정보</label><input type="text" id="adm-week-date" placeholder="예: 7월 1주차" required></div>
                <div class="form-group"><label>학습 목표</label><input type="text" id="adm-week-target" required></div>
                <div class="form-group"><label>피드백 상태</label><input type="text" id="adm-week-track" value="대기중" required></div>
                <button type="submit" class="btn-primary" style="margin-top:0.5rem;">관제 업데이트</button>
            </form>`;
    } else if (tab === 'lectures') {
        html += `<h2>📁 자료/강의 업로드</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form id="form-admin-lecture" style="background:var(--bg-main); padding:1.5rem; border-radius:12px;">
                <div class="form-group"><label>강의/교재 명칭</label><input type="text" id="adm-lec-title" required></div>
                <div class="form-group"><label>접근 URL</label><input type="url" id="adm-lec-link" required placeholder="https://"></div>
                <div class="form-group"><label>가이드 설명</label><textarea id="adm-lec-desc" style="height:80px; resize:none;"></textarea></div>
                <button type="submit" class="btn-primary" style="margin-top:0.5rem;">업로드</button>
            </form>`;
    } else if (tab === 'community') {
        html += `<h2>💬 커뮤니티 통합 관리</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            ${!data.community || data.community.length === 0 ? '<p style="color:var(--text-muted);">작성된 글 없음</p>' : 
            data.community.map(c => `<div class="item-card flex-between"><div style="flex:1;"><strong>${c.author}</strong><p style="margin-top:0.5rem; white-space:pre-wrap;">${c.content}</p></div><button class="btn-secondary" data-action="delete-post" data-id="${c.id}">삭제</button></div>`).join('')}`;
    } else if (tab === 'payments') {
        html += `<h2>💰 결제 승인 관리</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <table><thead><tr><th>신청 학생</th><th>요청 상품</th><th>금액</th><th>상태 조치</th></tr></thead><tbody>
            ${!data.payments || data.payments.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem 0;">요청 내역 없음</td></tr>' : 
            data.payments.map(p => `<tr><td>${p.userId}</td><td>${p.item}</td><td>${Number(p.amount).toLocaleString()}원</td><td>${p.status === '승인대기' ? `<button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.875rem;" data-action="approve-payment" data-id="${p.id}">승인 처리</button>` : `<span class="status-approved">승인 완료</span>`}</td></tr>`).join('')}
            </tbody></table>`;
    }
    container.innerHTML = html;
}


// ==========================================
// 이벤트 핸들러 및 리스너 (Event Binding)
// ==========================================

function handleAuthSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('auth-id').value.trim();
    const pw = document.getElementById('auth-pw').value.trim();
    const name = document.getElementById('auth-name').value.trim();

    if (AppState.authMode === 'login') {
        if (id === 'studycampus' && pw === 'studycampus26') {
            AppState.currentUser = { id: 'admin', name: '관리자', role: 'admin' };
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser));
            showToast("관리자 로그인 성공");
            switchView('admin');
            return;
        }
        const user = (AppState.data.users || []).find(u => u.id === id);
        if (user && user.active) {
            AppState.currentUser = { id: user.id, name: user.name, role: 'student' };
            localStorage.setItem('studycampus_session', JSON.stringify(AppState.currentUser));
            showToast(`${user.name}님 환영합니다!`);
            switchView('student');
        } else {
            showToast('가입 정보를 확인하시거나 비활성화된 계정인지 문의하세요.');
        }
    } else {
        if (!id || id === 'studycampus' || (AppState.data.users || []).some(u => u.id === id)) {
            return showToast('사용할 수 없거나 이미 존재하는 아이디입니다.');
        }
        if (!AppState.data.users) AppState.data.users = [];
        AppState.data.users.push({ id, name: name || id, role: 'student', active: true });
        syncData();
        showToast('회원가입이 완료되었습니다. 로그인 해주세요.');
        setAuthMode('login');
    }
}

function setAuthMode(mode) {
    AppState.authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('reg-name-group').classList.toggle('hidden', mode === 'login');
    document.getElementById('auth-submit-btn').textContent = mode === 'login' ? '로그인' : '회원가입 완료';
}

// 초기화 구동 함수
function initializeAppLogic() {
    try {
        const session = localStorage.getItem('studycampus_session');
        if (session) AppState.currentUser = JSON.parse(session);
    } catch (e) {}

    initTheme();
    switchView('landing');

    // 이벤트 위임 (Event Delegation)을 통한 전역 이벤트 처리
    document.body.addEventListener('click', (e) => {
        // 네비게이션 및 라우팅 액션
        if (e.target.dataset.action === 'nav') {
            switchView(e.target.dataset.target);
        }
        // 로그아웃 / 로그인 창 토글
        else if (e.target.dataset.action === 'auth-toggle') {
            if (AppState.currentUser) {
                AppState.currentUser = null;
                localStorage.removeItem('studycampus_session');
                showToast("로그아웃 되었습니다.");
                switchView('landing');
            } else {
                switchView('auth');
            }
        }
        // 인증 모드 토글
        else if (e.target.dataset.authMode) {
            setAuthMode(e.target.dataset.authMode);
        }
        // 사이드바 탭 전환
        else if (e.target.dataset.tab) {
            const tab = e.target.dataset.tab;
            if (e.target.closest('#student-sidebar')) {
                AppState.studentTab = tab;
                renderStudentDashboard();
            } else if (e.target.closest('#admin-sidebar')) {
                AppState.adminTab = tab;
                renderAdminDashboard();
            }
        }
        // 관리자: 유저 상태 토글
        else if (e.target.dataset.action === 'toggle-user') {
            const id = e.target.dataset.id;
            const user = AppState.data.users.find(u => String(u.id) === String(id));
            if(user) user.active = !user.active;
            syncData();
            showToast(user.active ? "접근 복구 완료" : "접근 제한 처리됨");
        }
        // 관리자: 항목 삭제 (공지, 커뮤니티)
        else if (e.target.dataset.action === 'delete-notice') {
            const id = e.target.dataset.id;
            AppState.data.notices = AppState.data.notices.filter(n => String(n.id) !== String(id));
            syncData();
            showToast("공지가 삭제되었습니다.");
        }
        else if (e.target.dataset.action === 'delete-post') {
            const id = e.target.dataset.id;
            AppState.data.community = AppState.data.community.filter(c => String(c.id) !== String(id));
            syncData();
            showToast("게시물이 삭제되었습니다.");
        }
        // 관리자: 결제 승인
        else if (e.target.dataset.action === 'approve-payment') {
            const id = e.target.dataset.id;
            const payment = AppState.data.payments.find(p => String(p.id) === String(id));
            if(payment) payment.status = '승인완료';
            syncData();
            showToast("결제가 승인되었습니다.");
        }
    });

    // 동적 폼 제출 이벤트 처리 (이벤트 위임)
    document.body.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (e.target.id === 'auth-form') {
            handleAuthSubmit(e);
        }
        else if (e.target.id === 'form-community') {
            if (!AppState.data.community) AppState.data.community = [];
            const text = document.getElementById('comm-text').value;
            const date = new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            AppState.data.community.unshift({ id: generateId(), author: AppState.currentUser.name, content: text, date: date });
            syncData();
            showToast("게시물이 등록되었습니다.");
        }
        else if (e.target.id === 'form-payment') {
            if (!AppState.data.payments) AppState.data.payments = [];
            const item = document.getElementById('pay-item').value;
            const amount = document.getElementById('pay-amount').value;
            AppState.data.payments.push({ id: generateId(), userId: AppState.currentUser.id, item, amount, status: '승인대기' });
            syncData();
            showToast("결제 승인이 요청되었습니다.");
        }
        else if (e.target.id === 'form-admin-notice') {
            if (!AppState.data.notices) AppState.data.notices = [];
            AppState.data.notices.unshift({ id: generateId(), title: document.getElementById('adm-notice-title').value, content: document.getElementById('adm-notice-content').value });
            syncData();
            showToast("공지가 배포되었습니다.");
        }
        else if (e.target.id === 'form-admin-weekly') {
            const userId = document.getElementById('adm-week-user').value;
            if(!userId) return showToast('학생을 먼저 선택해주세요.');
            if (!AppState.data.weeklyControls) AppState.data.weeklyControls = [];
            AppState.data.weeklyControls.unshift({ id: generateId(), userId, week: document.getElementById('adm-week-date').value, target: document.getElementById('adm-week-target').value, tracking: document.getElementById('adm-week-track').value });
            syncData();
            showToast("주간 관제가 업데이트 되었습니다.");
        }
        else if (e.target.id === 'form-admin-lecture') {
            if (!AppState.data.lectures) AppState.data.lectures = [];
            AppState.data.lectures.unshift({ id: generateId(), title: document.getElementById('adm-lec-title').value, link: document.getElementById('adm-lec-link').value, description: document.getElementById('adm-lec-desc').value });
            syncData();
            showToast("자료가 업로드 되었습니다.");
        }
    });
}

// DOM 로드 완료 시 초기화 실행
document.addEventListener('DOMContentLoaded', initializeAppLogic);
