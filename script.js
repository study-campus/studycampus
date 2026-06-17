// 엄격 모드 활성화로 잠재적 오류 방지
'use strict';

// [1] 시스템 기본값 정의
const DEFAULT_STATE = {
    users: [
        { id: 'student1', name: '김철수', role: 'student', active: true },
        { id: 'student2', name: '이영희', role: 'student', active: true }
    ],
    notices: [
        { id: 1, title: 'StudyCampus 정식 오픈 안내', content: '자기주도학습 통합 관제 플랫폼에 오신 것을 환영합니다.' }
    ],
    weeklyControls: [
        { id: 1, userId: 'student1', week: '2026년 6월 3주차', target: '수학 3단원 마스터 및 오답노트 정리', tracking: '진행률 85% - 우수' }
    ],
    lectures: [
        { id: 1, title: '자기주도학습법 총론 핵심 강의', link: 'https://example.com/lecture1', description: '효율적인 시간 관리를 위한 가이드북 자료 포함' }
    ],
    community: [
        { id: 1, author: '김철수', content: '오늘 뽀모도로 타이머로 4시간 채웠습니다! 다들 화이팅입니다.' }
    ],
    payments: [
        { id: 1, userId: 'student1', item: '6월 프리미엄 종합 관제 멤버십', amount: '150,000', status: '승인대기' }
    ],
    paymentSettings: {
        gatewayName: '토스페이먼츠 연동 통합 모듈',
        autoApproval: '수동 승인 운영'
    }
};

// [2] 자동 저장된 데이터 복구 및 초기 상태 설정
let state = DEFAULT_STATE;
try {
    const savedData = localStorage.getItem('studycampus_db');
    if (savedData) state = JSON.parse(savedData);
} catch (e) {
    console.warn('저장된 데이터를 불러오는 중 오류 발생. 기본 데이터로 시작합니다.');
}

let currentUser = null;
try {
    const session = localStorage.getItem('studycampus_session');
    if (session) currentUser = JSON.parse(session);
} catch (e) {}

let currentAuthMode = 'login';
let currentStudentTab = 'notices';
let currentAdminTab = 'users';

// [3] 다크/라이트 테마 자동 감지 및 수동 설정 기능
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('studycampus_theme');

    if (savedTheme) {
        document.body.classList.add(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.add('light-theme');
    }

    themeToggle.addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('studycampus_theme', 'light-theme');
        } else if (document.body.classList.contains('light-theme')) {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('studycampus_theme', 'dark-theme');
        } else {
            document.body.classList.add('dark-theme');
            localStorage.setItem('studycampus_theme', 'dark-theme');
        }
    });
}

// [4] 로컬 스토리지에 데이터 자동 저장 기능
function saveState() {
    try {
        localStorage.setItem('studycampus_db', JSON.stringify(state));
    } catch (e) {
        alert('데이터를 안전하게 저장할 수 없습니다. 시크릿 모드를 해제하거나 캐시를 비워주세요.');
    }
}

// [5] 뷰(View) 전환 컨트롤러
function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.remove('hidden');
    
    if (viewName === 'student') renderStudentDashboard();
    if (viewName === 'admin') renderAdminDashboard();
    renderNavbar();
}

function renderNavbar() {
    const navLinks = document.getElementById('nav-links');
    const authBtn = document.getElementById('auth-action-btn');
    const profileTag = document.getElementById('user-profile-tag');
    
    let linksHTML = `<li onclick="showView('landing')">홈</li>`;
    
    if (currentUser) {
        profileTag.classList.remove('hidden');
        profileTag.innerText = `${currentUser.name}(${currentUser.role === 'admin' ? '관리자' : '학생'})`;
        authBtn.innerText = '로그아웃';
        
        if (currentUser.role === 'admin') {
            linksHTML += `<li onclick="showView('admin')">관리자 패널</li>`;
        } else {
            linksHTML += `<li onclick="showView('student')">마이 대시보드</li>`;
        }
    } else {
        profileTag.classList.add('hidden');
        authBtn.innerText = '로그인';
    }
    navLinks.innerHTML = linksHTML;
}

function handleAuthAction() {
    if (currentUser) {
        currentUser = null;
        localStorage.removeItem('studycampus_session');
        showView('landing');
    } else {
        showView('auth');
    }
}

// [6] 인증 모듈 (로그인 및 회원가입 로직)
function toggleAuthMode(mode) {
    currentAuthMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('reg-name-group').classList.toggle('hidden', mode === 'login');
    document.getElementById('auth-submit-btn').innerText = mode === 'login' ? '로그인' : '회원가입 완료';
}

function processAuth(e) {
    e.preventDefault();
    const id = document.getElementById('auth-id').value.trim();
    const pw = document.getElementById('auth-pw').value.trim();
    const name = document.getElementById('auth-name').value.trim();

    if (currentAuthMode === 'login') {
        if (id === 'studycampus' && pw === 'studycampus26') {
            currentUser = { id: 'admin', name: '최고관리자', role: 'admin' };
            localStorage.setItem('studycampus_session', JSON.stringify(currentUser));
            showView('admin');
            return;
        }
        
        const user = state.users.find(u => u.id === id);
        if (user && user.active) {
            currentUser = { id: user.id, name: user.name, role: 'student' };
            localStorage.setItem('studycampus_session', JSON.stringify(currentUser));
            showView('student');
        } else {
            alert('가입 정보를 확인하시거나 비활성화된 계정인지 문의하세요.');
        }
    } else {
        if (!id || id === 'studycampus' || state.users.some(u => u.id === id)) {
            alert('사용할 수 없거나 이미 존재하는 아이디입니다.');
            return;
        }
        const newUser = { id, name: name || id, role: 'student', active: true };
        state.users.push(newUser);
        saveState();
        alert('회원가입이 완료되었습니다. 로그인 해주세요.');
        toggleAuthMode('login');
    }
}

function switchDashboardTab(role, tabName) {
    if (role === 'student') {
        currentStudentTab = tabName;
        renderStudentDashboard();
    } else {
        currentAdminTab = tabName;
        renderAdminDashboard();
    }
}

// [7] 학생 패널 렌더링
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    if (!currentUser) return;
    let html = '';

    if (currentStudentTab === 'notices') {
        html += `<h2>📢 전체 공지사항</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        state.notices.forEach(n => {
            html += `<div class="item-card"><h3>${n.title}</h3><p style="margin-top:0.5rem; color:var(--text-muted);">${n.content}</p></div>`;
        });
    } else if (currentStudentTab === 'weekly') {
        html += `<h2>📊 나의 주간 관제 현황</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        const myControls = state.weeklyControls.filter(c => c.userId === currentUser.id);
        if(myControls.length === 0) {
            html += `<p style="color:var(--text-muted);">아직 등록된 주간 배포 관제 계획이 없습니다.</p>`;
        } else {
            myControls.forEach(c => {
                html += `<div class="item-card"><h3>📆 주차: ${c.week}</h3><p style="margin:0.5rem 0;">🎯 <b>배포 목표:</b> ${c.target}</p><p>📈 <b>달성 현황 관제:</b> ${c.tracking}</p></div>`;
            });
        }
    } else if (currentStudentTab === 'lectures') {
        html += `<h2>📖 업로드 자료 및 강의 시청</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">`;
        state.lectures.forEach(l => {
            html += `<div class="item-card"><h3>${l.title}</h3><p style="margin:0.5rem 0; color:var(--text-muted);">${l.description}</p><a href="${l.link}" target="_blank" style="color:var(--primary); font-weight:bold; text-decoration:none;">🔗 강의 교재 및 링크 바로가기</a></div>`;
        });
    } else if (currentStudentTab === 'community') {
        html += `
            <h2>💭 커뮤니티 공간</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form onsubmit="addCommunityPost(event)" style="margin-bottom:2rem;">
                <textarea id="comm-text" required placeholder="공부 피드백이나 질문을 남겨보세요." style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border); background:var(--bg-main); color:var(--text-primary); resize:none; height:80px;"></textarea>
                <button type="submit" class="btn-primary" style="margin-top:0.5rem; float:right;">게시물 등록</button>
                <div style="clear:both;"></div>
            </form>
        `;
        state.community.forEach(c => {
            html += `<div class="item-card"><strong>👤 ${c.author}</strong><p style="margin-top:0.5rem;">${c.content}</p></div>`;
        });
    } else if (currentStudentTab === 'payments') {
        html += `
            <h2>💳 결제 승인 요청</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form onsubmit="requestPayment(event)" style="margin-bottom:2rem; background:var(--bg-main); padding:1rem; border-radius:8px;">
                <div class="form-group"><label>수강 상품 항목 선택</label><select id="pay-item"><option>7월 자기주도학습 종합반 패키지</option><option>프리미엄 1:1 관제 멤버십</option></select></div>
                <div class="form-group"><label>청구 금액</label><input type="text" id="pay-amount" value="180,000" readonly></div>
                <button type="submit" class="btn-primary">승인 청구 및 연동 요청</button>
            </form>
            <h3>내 승인 요청 이력</h3>
            <table>
                <thead><tr><th>신청 상품</th><th>금액</th><th>상태</th></tr></thead>
                <tbody>
                    ${state.payments.filter(p => p.userId === currentUser.id).map(p => `
                        <tr>
                            <td>${p.item}</td>
                            <td>${p.amount}원</td>
                            <td><span class="${p.status === '승인완료' ? 'status-approved' : 'status-pending'}">${p.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    container.innerHTML = html;
}

window.addCommunityPost = function(e) {
    e.preventDefault();
    const txt = document.getElementById('comm-text').value;
    state.community.unshift({ id: Date.now(), author: currentUser.name, content: txt });
    saveState();
    renderStudentDashboard();
};

window.requestPayment = function(e) {
    e.preventDefault();
    const item = document.getElementById('pay-item').value;
    const amount = document.getElementById('pay-amount').value;
    state.payments.push({ id: Date.now(), userId: currentUser.id, item, amount, status: '승인대기' });
    saveState();
    renderStudentDashboard();
    alert('결제 승인 요청이 성공적으로 전송되었습니다.');
};

// [8] 관리자 패널 렌더링 (따옴표 처리를 통해 VS Code 에러 원천 방지)
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    let html = '';

    if (currentAdminTab === 'users') {
        html += `
            <h2>👥 학생 통합 명부 및 접근 관리</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <table>
                <thead><tr><th>아이디</th><th>학생명</th><th>현재 상태</th><th>통제 관리</th></tr></thead>
                <tbody>
                    ${state.users.map(u => `
                        <tr>
                            <td>${u.id}</td>
                            <td>${u.name}</td>
                            <td>${u.active ? '✅ 활성 수강생' : '❌ 정지/만료'}</td>
                            <td><button class="${u.active ? 'btn-danger' : 'btn-primary'}" onclick="toggleUserStatus('${u.id}')">${u.active ? '접근 제한' : '접근 복구'}</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (currentAdminTab === 'notices') {
        html += `
            <h2>📢 전체 공지사항 일제 배포</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form onsubmit="adminAddNotice(event)" style="margin-bottom:2rem;">
                <div class="form-group"><label>공지 제목</label><input type="text" id="adm-notice-title" required></div>
                <div class="form-group"><label>내용</label><textarea id="adm-notice-content" required></textarea></div>
                <button type="submit" class="btn-primary">공지사항 전방 배포</button>
            </form>
            <h3>현재 배포된 공지 리스트</h3>
            ${state.notices.map(n => `<div class="item-card flex-between"><h4>${n.title}</h4><button class="btn-danger" style="padding:0.25rem 0.5rem; font-size:0.8rem;" onclick="adminDeleteNotice('${n.id}')">삭제</button></div>`).join('')}
        `;
    } else if (currentAdminTab === 'weekly') {
        html += `
            <h2>📈 개별 맞춤형 주간 관제 배포 및 모니터링 설정</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form onsubmit="adminAddWeekly(event)" style="margin-bottom:2rem;">
                <div class="form-group"><label>관제 대상 학생 지정</label><select id="adm-week-user">${state.users.map(u => `<option value="${u.id}">${u.name}(${u.id})</option>`).join('')}</select></div>
                <div class="form-group"><label>해당 주차 정보</label><input type="text" id="adm-week-date" value="2026년 6월 4주차" required></div>
                <div class="form-group"><label>지정 학습 목표 지표</label><input type="text" id="adm-week-target" required></div>
                <div class="form-group"><label>현재 달성 피드백 관제상태</label><input type="text" id="adm-week-track" value="관리자 배정 대기중" required></div>
                <button type="submit" class="btn-primary">관제 정보 업데이트 배포</button>
            </form>
        `;
    } else if (currentAdminTab === 'lectures') {
        html += `
            <h2>📁 강의 미디어 및 학습 자료실 관리</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <form onsubmit="adminAddLecture(event)" style="margin-bottom:2rem;">
                <div class="form-group"><label>강의 및 교재 명칭</label><input type="text" id="adm-lec-title" required></div>
                <div class="form-group"><label>자료 접근 URL</label><input type="url" id="adm-lec-link" required placeholder="https://"></div>
                <div class="form-group"><label>간략 가이드 설명</label><textarea id="adm-lec-desc"></textarea></div>
                <button type="submit" class="btn-primary">학습 리소스 업로드</button>
            </form>
        `;
    } else if (currentAdminTab === 'community') {
        html += `
            <h2>💬 커뮤니티 전수 통합 관리 모니터</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            ${state.community.map(c => `
                <div class="item-card flex-between">
                    <div style="flex:1;"><strong>${c.author}</strong>: ${c.content}</div>
                    <button class="btn-danger" onclick="adminDeletePost('${c.id}')">유해물 삭제</button>
                </div>
            `).join('')}
        `;
    } else if (currentAdminTab === 'payments') {
        html += `
            <h2>💰 원격 결제 청구 요청 승인 및 모듈 연동</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <div style="background:var(--bg-main); padding:1rem; border-radius:8px; margin-bottom:2rem;">
                <h3>⚙️ PG 전자 결재 연동 실시간 상태</h3>
                <p style="margin:0.5rem 0;">현재 연동 게이트웨이: <b>${state.paymentSettings.gatewayName}</b></p>
                <p>승인 방식 표준: <b>${state.paymentSettings.autoApproval}</b></p>
            </div>
            <h3>입금 및 승인 대기 대장 목록</h3>
            <table>
                <thead><tr><th>신청 학생</th><th>요청 상품</th><th>금액</th><th>상태 조치</th></tr></thead>
                <tbody>
                    ${state.payments.map(p => `
                        <tr>
                            <td>${p.userId}</td>
                            <td>${p.item}</td>
                            <td>${p.amount}원</td>
                            <td>
                                ${p.status === '승인대기' 
                                    ? `<button class="btn-primary" style="padding:0.25rem 0.5rem; font-size:0.8rem;" onclick="adminApprovePayment('${p.id}')">승인 연동</button>` 
                                    : `<span class="status-approved">승인 완료</span>`
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (currentAdminTab === 'system') {
        html += `
            <h2>⚙️ 수동 백업 원격 시스템 제어</h2><hr style="margin:1rem 0; border:0; border-top:1px solid var(--border)">
            <p style="color:var(--text-muted); margin-bottom:1.5rem;">현재 모든 상호작용 지표는 이중 분할 LocalStorage 저장소에 실시간 자동 저장되고 있습니다. 데이터 이관 시 아래의 백업/복구 기능을 이용하세요.</p>
            <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <button class="btn-primary" onclick="exportSystemBackup()">현재 데이터 백업본(.json) 추출 다운로드</button>
                <div style="border:1px dashed var(--border); padding:1rem; border-radius:8px; width:100%;">
                    <label style="display:block; margin-bottom:0.5rem; font-weight:bold;">백업 유실본 복구 파일 업로드(.json)</label>
                    <input type="file" id="backup-file-input" accept=".json" onchange="importSystemBackup(event)">
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// [9] 관리자 이벤트 제어
window.toggleUserStatus = function(id) {
    const user = state.users.find(u => String(u.id) === String(id));
    if(user) user.active = !user.active;
    saveState();
    renderAdminDashboard();
};

window.adminAddNotice = function(e) {
    e.preventDefault();
    const title = document.getElementById('adm-notice-title').value;
    const content = document.getElementById('adm-notice-content').value;
    state.notices.unshift({ id: Date.now(), title, content });
    saveState();
    renderAdminDashboard();
};

window.adminDeleteNotice = function(id) {
    state.notices = state.notices.filter(n => String(n.id) !== String(id));
    saveState();
    renderAdminDashboard();
};

window.adminAddWeekly = function(e) {
    e.preventDefault();
    const userId = document.getElementById('adm-week-user').value;
    const week = document.getElementById('adm-week-date').value;
    const target = document.getElementById('adm-week-target').value;
    const tracking = document.getElementById('adm-week-track').value;
    state.weeklyControls.unshift({ id: Date.now(), userId, week, target, tracking });
    saveState();
    renderAdminDashboard();
};

window.adminAddLecture = function(e) {
    e.preventDefault();
    const title = document.getElementById('adm-lec-title').value;
    const link = document.getElementById('adm-lec-link').value;
    const description = document.getElementById('adm-lec-desc').value;
    state.lectures.unshift({ id: Date.now(), title, link, description });
    saveState();
    renderAdminDashboard();
};

window.adminDeletePost = function(id) {
    state.community = state.community.filter(c => String(c.id) !== String(id));
    saveState();
    renderAdminDashboard();
};

window.adminApprovePayment = function(id) {
    const payment = state.payments.find(p => String(p.id) === String(id));
    if(payment) payment.status = '승인완료';
    saveState();
    renderAdminDashboard();
};

window.exportSystemBackup = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `studycampus_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
};

window.importSystemBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.users && importedData.notices) {
                state = importedData;
                saveState();
                alert('데이터베이스 복구가 완료되었습니다.');
                if (currentUser && currentUser.role === 'admin') renderAdminDashboard();
            } else {
                alert('올바른 백업 파일 규격이 아닙니다.');
            }
        } catch (err) {
            alert('파일 해석 중 오류가 발생했습니다.');
        }
    };
    reader.readAsText(file);
};

// [10] 초기 실행 (이벤트 리스너)
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderNavbar();
    showView('landing');
});