import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// 파이어베이스 설정
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

const AppState = {
    data: { users: [], lectures: [], homework: [], hwSubmissions: [] },
    currentUser: null, currentView: 'landing', studentTab: 'home', adminTab: 'users',
    activeLecture: null, lectureTimer: null
};

// 유틸리티: 현재 주차 계산 (일요일~토요일 기준)
function getCurrentWeekString(dateObj = new Date()) {
    const firstDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const pastDaysOfMonth = dateObj.getDate() - 1;
    const weekOfMonth = Math.ceil((pastDaysOfMonth + firstDayOfMonth.getDay() + 1) / 7);
    return `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${weekOfMonth}주차`;
}

// 토스트 메시지
function showToast(msg) {
    const box = document.createElement('div');
    box.style = "position:fixed; bottom:20px; right:20px; background:#333; color:#fff; padding:12px 24px; border-radius:8px; z-index:9999;";
    box.textContent = msg;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2500);
}

// 실시간 DB 연동
const dbRef = ref(db, 'studycampus_data');
onValue(dbRef, (snapshot) => {
    const serverData = snapshot.val();
    if (serverData) AppState.data = serverData;
    else set(dbRef, AppState.data);
    renderCurrentView();
});

function syncData() { set(dbRef, AppState.data); }

// ==========================================
// 뷰 및 라우팅 제어
// ==========================================
function switchView(view) {
    AppState.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.querySelectorAll('.global-element').forEach(el => el.classList.toggle('hidden', view === 'student' || view === 'admin'));
    renderCurrentView();
}

function renderCurrentView() {
    if (!AppState.currentUser) return;
    if (AppState.currentView === 'student') renderStudentDashboard();
    else if (AppState.currentView === 'admin') renderAdminDashboard();
}

// ==========================================
// [학생 화면] 앱 레이아웃 렌더링
// ==========================================
function renderStudentDashboard() {
    const container = document.getElementById('student-dash-content');
    const { currentUser, data, studentTab } = AppState;
    const me = (data.users || []).find(u => u.id === currentUser.id) || currentUser;
    let html = '';

    // [학생 - 홈 그리드 화면]
    if (studentTab === 'home') {
        const ticketDday = me.ticketExpiry ? Math.ceil((new Date(me.ticketExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : '만료';
        
        html += `
            <div class="dash-banner">
                <h2 style="font-size:1.8rem; font-weight:800; margin-bottom:8px;">${me.name}님, 오늘도 파이팅!</h2>
                <p>StudyCampus 수강생 · ${me.xp || 0} XP</p>
            </div>
            
            <div class="ticket-card">
                <div><p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:5px;">나의 수강권</p><p style="font-weight:600;">프리미엄 정규반</p></div>
                <div style="text-align:right;"><span class="ticket-dday">D-${ticketDday > 0 ? ticketDday : '0'}</span><br><button class="btn-outline btn-sm" style="margin-top:5px;" onclick="window.studentGoPage('mypage')">연장하기</button></div>
            </div>

            <h3 style="margin-bottom:15px; font-size:1.1rem;">자주 찾는 메뉴</h3>
            <div class="menu-grid">
                <div class="menu-item" onclick="window.studentGoPage('homework')"><div class="menu-icon">📝</div><div class="menu-title">주차별 숙제</div></div>
                <div class="menu-item" onclick="window.studentGoPage('lectures')"><div class="menu-icon">📚</div><div class="menu-title">강의 목록</div></div>
                <div class="menu-item" onclick="window.studentGoPage('test')"><div class="menu-icon">🎯</div><div class="menu-title">대형 테스트</div></div>
                <div class="menu-item" onclick="window.studentGoPage('mypage')"><div class="menu-icon">⚙️</div><div class="menu-title">마이페이지</div></div>
            </div>
        `;
    } 
    // [학생 - 강의 및 플레이어 (90% 로직)]
    else if (studentTab === 'lectures') {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2>📚 나의 강의실</h2><button class="btn-outline btn-sm" onclick="window.studentGoPage('home')">돌아가기</button></div>`;
        
        if (AppState.activeLecture) {
            // 플레이어 화면
            const lec = AppState.activeLecture;
            const progress = me.lectureProgress?.[lec.id] || { percent: 0, done: false };
            
            html += `
                <div class="video-player-container" id="video-player">
                    ${progress.done ? '<div style="font-size:2rem; color:var(--success);">✅ 수강 완료</div>' : '<div class="play-btn-overlay" onclick="window.startSimulatedVideo()">▶️</div><p style="margin-top:10px; font-size:0.9rem; opacity:0.8;">재생 버튼을 누르면 수강률이 오릅니다.</p>'}
                    <div style="position:absolute; bottom:0; left:0; width:100%; height:6px; background:#333;"><div id="live-progress-bar" style="width:${progress.percent}%; height:100%; background:var(--primary); transition:width 1s linear;"></div></div>
                </div>
                <div class="ticket-card">
                    <div><h3>${lec.title}</h3><p style="color:var(--text-muted); margin-top:5px;">권장 수강시간 기준 90% 이상 시청 시 완료 처리됩니다.</p></div>
                    <div style="text-align:right;"><span style="font-size:1.5rem; font-weight:800; color:${progress.done ? 'var(--success)' : 'var(--primary)'}" id="live-progress-text">${progress.percent}%</span></div>
                </div>
            `;
        } else {
            // 강의 목록
            if (!data.lectures || data.lectures.length === 0) html += `<div style="padding:40px; text-align:center; border:1px dashed var(--border); border-radius:12px;">등록된 강의가 없습니다.</div>`;
            else data.lectures.forEach(l => {
                const prog = me.lectureProgress?.[l.id] || { percent: 0, done: false };
                html += `
                    <div class="lecture-list-item">
                        <div style="flex:1;">
                            <h3 style="margin-bottom:5px;">${l.title} ${prog.done ? '<span class="badge badge-green">완료</span>' : ''}</h3>
                            <div class="lecture-progress-bar"><div class="lecture-progress-fill" style="width:${prog.percent}%; background:${prog.done ? 'var(--success)' : 'var(--primary)'};"></div></div>
                        </div>
                        <button class="btn-primary" style="width:auto; margin-left:20px;" onclick="window.openLecture('${l.id}')">${prog.done ? '다시보기' : '시청하기'}</button>
                    </div>`;
            });
        }
    }
    // [학생 - 숙제 관리 (다중 파일 제출)]
    else if (studentTab === 'homework') {
        const currentWeek = getCurrentWeekString();
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2>📝 나의 과제함</h2><button class="btn-outline btn-sm" onclick="window.studentGoPage('home')">돌아가기</button></div>`;
        html += `<div class="hw-week-header"><span>${currentWeek}</span></div>`;
        
        const myHw = (data.homework || []).filter(h => h.week === currentWeek && (h.type === 'all' || h.target === me.id));
        
        if(myHw.length === 0) html += `<div style="text-align:center; padding:40px; color:var(--text-muted);">이번 주 배포된 숙제가 없습니다.😊</div>`;
        else {
            myHw.forEach(h => {
                const sub = (data.hwSubmissions || []).find(s => s.hwId === h.id && s.studentId === me.id);
                let subHtml = '';
                if (!sub) {
                    subHtml = `
                        <div class="file-upload-box" onclick="document.getElementById('hw-file-${h.id}').click()">
                            📎 파일 여러 개 선택해서 제출하기 (이미지, PDF 등)
                        </div>
                        <input type="file" id="hw-file-${h.id}" multiple class="hidden" onchange="window.submitHomework('${h.id}', this)">
                    `;
                } else {
                    const statusText = sub.status === 'approved' ? '<span class="badge badge-green">제출 승인됨</span>' : (sub.status === 'rejected' ? '<span class="badge badge-red">반려됨 (재제출 필요)</span>' : '<span class="badge badge-blue">검사 대기중</span>');
                    subHtml = `<div style="margin-top:15px; padding:15px; background:#f8fafc; border-radius:8px;">${statusText} <p style="margin-top:8px; font-size:0.9rem;">첨부된 파일 ${sub.files.length}개</p>${sub.status === 'rejected' ? `<button class="btn-danger btn-sm" style="margin-top:10px;" onclick="window.cancelSubmission('${sub.id}')">다시 제출하기</button>` : ''}</div>`;
                }
                
                html += `
                    <div class="hw-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong style="color:var(--primary);">${h.day} (${h.date})</strong></div>
                        <p style="font-weight:600; font-size:1.1rem;">${h.desc}</p>
                        ${subHtml}
                    </div>`;
            });
        }
    }
    // [학생 - 마이페이지 (카카오톡, 탈퇴, 수강권)]
    else if (studentTab === 'mypage') {
        html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2>⚙️ 마이페이지</h2><button class="btn-outline btn-sm" onclick="window.studentGoPage('home')">돌아가기</button></div>`;
        html += `
            <div class="admin-card">
                <h3 style="margin-bottom:15px;">💳 수강권 관리</h3>
                <p style="margin-bottom:15px; color:var(--text-muted);">현재 프리미엄반 수강 중입니다.</p>
                <button class="btn-primary" onclick="showToast('결제 모듈이 호출됩니다.')">결제하기 (기간 연장)</button>
            </div>
            <div class="admin-card">
                <h3 style="margin-bottom:15px;">🎧 고객 센터</h3>
                <div style="display:grid; gap:10px;">
                    <a href="http://pf.kakao.com/_xdxnxfXX" target="_blank" class="btn-outline" style="text-align:center; padding:14px; border-radius:8px; font-weight:700;">💬 1:1 문의하기 (카카오톡)</a>
                    <a href="http://pf.kakao.com/_xdxnxfXX" target="_blank" class="btn-outline" style="text-align:center; padding:14px; border-radius:8px; font-weight:700;">💡 서비스 제안하기 (카카오톡)</a>
                </div>
            </div>
            <div style="text-align:right;"><button class="btn-text" style="color:var(--danger);" onclick="window.deleteAccount()">회원 탈퇴</button></div>
        `;
    }

    container.innerHTML = html;
}

// 학생 뷰 전환 제어
window.studentGoPage = function(tab) {
    AppState.studentTab = tab;
    if(tab !== 'lectures') AppState.activeLecture = null; // 플레이어 초기화
    renderStudentDashboard();
};

// ==========================================
// [강의 시청 90% 달성 로직]
// ==========================================
window.openLecture = function(id) {
    AppState.activeLecture = AppState.data.lectures.find(l => l.id === id);
    renderStudentDashboard();
};

window.startSimulatedVideo = function() {
    if(AppState.lectureTimer) clearInterval(AppState.lectureTimer);
    const lecId = AppState.activeLecture.id;
    const me = AppState.currentUser;
    if(!AppState.data.users) return;
    const userIdx = AppState.data.users.findIndex(u => u.id === me.id);
    if(!AppState.data.users[userIdx].lectureProgress) AppState.data.users[userIdx].lectureProgress = {};
    
    let currentProg = AppState.data.users[userIdx].lectureProgress[lecId]?.percent || 0;
    
    document.querySelector('.play-btn-overlay').innerHTML = '⏸️';
    
    AppState.lectureTimer = setInterval(() => {
        currentProg += 5; // 시뮬레이션을 위해 빠르게(5%씩) 증가
        if (currentProg >= 90) { // ★ 90% 이상 시 완료 처리 ★
            currentProg = 100;
            clearInterval(AppState.lectureTimer);
            AppState.data.users[userIdx].lectureProgress[lecId] = { percent: 100, done: true };
            syncData();
            showToast("수강이 90% 이상 완료되어 출석 인정되었습니다!");
        } else {
            AppState.data.users[userIdx].lectureProgress[lecId] = { percent: currentProg, done: false };
        }
        
        const bar = document.getElementById('live-progress-bar');
        const txt = document.getElementById('live-progress-text');
        if(bar) bar.style.width = currentProg + '%';
        if(txt) txt.textContent = currentProg + '%';
        
    }, 1000); // 1초마다 업데이트
};

// ==========================================
// [다중 파일 숙제 제출 로직 (Base64)]
// ==========================================
window.submitHomework = async function(hwId, inputElement) {
    const files = Array.from(inputElement.files);
    if(files.length === 0) return;
    if(files.some(f => f.size > 2 * 1024 * 1024)) return alert('각 파일은 2MB 이하여야 합니다. (DB 한계 보호)');
    
    showToast("파일을 변환 중입니다. 잠시만 기다려주세요...");
    
    // 파일을 데이터 URL(Base64)로 변환
    const base64Files = await Promise.all(files.map(file => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve({ name: file.name, data: e.target.result });
            reader.readAsDataURL(file);
        });
    }));

    if(!AppState.data.hwSubmissions) AppState.data.hwSubmissions = [];
    AppState.data.hwSubmissions.push({
        id: generateId(),
        hwId: hwId,
        studentId: AppState.currentUser.id,
        studentName: AppState.currentUser.name,
        files: base64Files,
        status: 'pending'
    });
    
    syncData();
    showToast("숙제가 성공적으로 제출되었습니다!");
    renderStudentDashboard();
};

window.cancelSubmission = function(subId) {
    AppState.data.hwSubmissions = AppState.data.hwSubmissions.filter(s => s.id !== subId);
    syncData();
    renderStudentDashboard();
};

window.deleteAccount = function() {
    if(confirm("정말로 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다.")) {
        AppState.data.users = AppState.data.users.filter(u => u.id !== AppState.currentUser.id);
        syncData();
        localStorage.removeItem('studycampus_session');
        AppState.currentUser = null;
        switchView('landing');
    }
};

// ==========================================
// [관리자 화면] 렌더링
// ==========================================
function renderAdminDashboard() {
    const container = document.getElementById('admin-dash-content');
    const tab = AppState.adminTab;
    const data = AppState.data;
    let html = '';

    document.querySelectorAll('#admin-sidebar li').forEach(li => li.classList.toggle('active', li.dataset.tab === tab));

    if (tab === 'users') {
        html += `<div class="admin-card"><h2 style="margin-bottom:20px;">👥 학생 통합 관리</h2><table style="width:100%; border-collapse:collapse;"><thead><tr style="text-align:left; border-bottom:2px solid var(--border);"><th style="padding:10px;">이름(ID)</th><th style="padding:10px;">수강권 기한</th><th style="padding:10px;">상태</th></tr></thead><tbody>`;
        if(!data.users || data.users.length===0) html += `<tr><td colspan="3" style="padding:20px; text-align:center;">학생이 없습니다.</td></tr>`;
        else data.users.forEach(u => html += `<tr style="border-bottom:1px solid var(--border);"><td style="padding:15px;"><strong>${u.name}</strong> (${u.id})</td><td style="padding:15px;">${u.ticketExpiry || '미설정'}</td><td style="padding:15px;"><span class="badge ${u.active ? 'badge-blue' : 'badge-red'}">${u.active ? '정상' : '정지'}</span></td></tr>`);
        html += `</tbody></table></div>`;
    } 
    // [관리자 - 숙제 배포 및 검사]
    else if (tab === 'homework') {
        const autoWeek = getCurrentWeekString();
        html += `
            <div class="admin-card">
                <h2 style="margin-bottom:20px;">📝 신규 숙제 배포</h2>
                <form id="form-admin-hw" style="display:grid; gap:10px;">
                    <div style="display:flex; gap:10px;">
                        <select id="hw-target" class="input-field"><option value="all">전체 학생</option>${(data.users||[]).map(u=>`<option value="${u.id}">${u.name}</option>`).join('')}</select>
                        <input type="text" id="hw-week" class="input-field" value="${autoWeek}" required>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <input type="date" id="hw-date" class="input-field" required>
                        <select id="hw-day" class="input-field"><option>월요일</option><option>화요일</option><option>수요일</option><option>목요일</option><option>금요일</option><option>토요일</option><option>일요일</option></select>
                    </div>
                    <textarea id="hw-desc" class="input-field" placeholder="숙제 내용/설명 작성" required style="height:80px;"></textarea>
                    <button type="submit" class="btn-primary">배포하기</button>
                </form>
            </div>
            <div class="admin-card">
                <h2 style="margin-bottom:20px;">📥 학생 제출함 (검사)</h2>
                ${(!data.hwSubmissions || data.hwSubmissions.length===0) ? '<p style="color:var(--text-muted);">제출된 숙제가 없습니다.</p>' : 
                data.hwSubmissions.map(s => `
                    <div style="border:1px solid var(--border); padding:15px; border-radius:8px; margin-bottom:10px; background:${s.status==='pending' ? '#fffbeb' : '#fff'};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong>👤 ${s.studentName} 학생 제출본</strong>
                            <span class="badge badge-${s.status==='approved'?'green':(s.status==='rejected'?'red':'blue')}">${s.status}</span>
                        </div>
                        <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">
                            ${s.files.map((f, i) => `<a href="${f.data}" download="${f.name}" style="background:#f1f5f9; padding:8px 12px; border-radius:6px; font-size:0.8rem; border:1px solid var(--border); white-space:nowrap;">📄 ${f.name} 다운로드/보기</a>`).join('')}
                        </div>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            ${s.status==='pending' ? `<button class="btn-sm btn-primary" onclick="window.reviewHw('${s.id}', 'approved')">승인</button><button class="btn-sm btn-danger" onclick="window.reviewHw('${s.id}', 'rejected')">반려(재제출)</button>` : `<button class="btn-sm btn-outline" onclick="window.reviewHw('${s.id}', 'pending')">상태 초기화</button>`}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (tab === 'lectures') {
        html += `
            <div class="admin-card">
                <h2 style="margin-bottom:20px;">📖 신규 강의 등록</h2>
                <form id="form-admin-lec" style="display:grid; gap:10px;">
                    <input type="text" id="lec-title" class="input-field" placeholder="강의명" required>
                    <input type="url" id="lec-link" class="input-field" placeholder="자료/영상 URL" required>
                    <button type="submit" class="btn-primary">등록</button>
                </form>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.reviewHw = function(subId, status) {
    const sub = AppState.data.hwSubmissions.find(s => s.id === subId);
    if(sub) sub.status = status;
    syncData();
};

// ==========================================
// 폼 이벤트 및 공통 제어
// ==========================================
document.body.addEventListener('click', e => {
    if(e.target.dataset.action === 'nav') switchView(e.target.dataset.target);
    else if(e.target.dataset.action === 'auth-toggle') {
        if(AppState.currentUser) { AppState.currentUser = null; localStorage.removeItem('studycampus_session'); switchView('landing'); }
        else switchView('auth');
    }
    else if(e.target.dataset.authMode) {
        AppState.authMode = e.target.dataset.authMode;
        document.getElementById('tab-login').classList.toggle('active', AppState.authMode === 'login');
        document.getElementById('tab-register').classList.toggle('active', AppState.authMode === 'register');
        document.getElementById('reg-name-group').classList.toggle('hidden', AppState.authMode === 'login');
    }
    else if(e.target.dataset.tab) {
        if(e.target.closest('#admin-sidebar')) { AppState.adminTab = e.target.dataset.tab; renderAdminDashboard(); }
    }
});

document.body.addEventListener('submit', e => {
    e.preventDefault();
    if(e.target.id === 'auth-form') {
        const id = document.getElementById('auth-id').value;
        const pw = document.getElementById('auth-pw').value;
        if(AppState.authMode === 'login') {
            if(id === 'studycampus' && pw === 'studycampus26') {
                AppState.currentUser = { id: 'admin', name: '최고관리자', role: 'admin' };
                switchView('admin');
            } else {
                const user = (AppState.data.users||[]).find(u => u.id === id);
                if(user) { AppState.currentUser = user; switchView('student'); }
                else showToast("계정 정보를 확인하세요.");
            }
        } else {
            if(!AppState.data.users) AppState.data.users = [];
            const d = new Date(); d.setDate(d.getDate() + 30); // 기본 한달 수강권 지급
            AppState.data.users.push({ id, name: document.getElementById('auth-name').value||id, role: 'student', active: true, ticketExpiry: d.toISOString().split('T')[0], xp: 0 });
            syncData(); showToast("가입 완료. 로그인하세요!");
            document.querySelector('[data-auth-mode="login"]').click();
        }
    }
    else if(e.target.id === 'form-admin-hw') {
        if(!AppState.data.homework) AppState.data.homework = [];
        AppState.data.homework.unshift({
            id: generateId(),
            target: document.getElementById('hw-target').value,
            type: document.getElementById('hw-target').value === 'all' ? 'all' : 'individual',
            week: document.getElementById('hw-week').value,
            date: document.getElementById('hw-date').value,
            day: document.getElementById('hw-day').value,
            desc: document.getElementById('hw-desc').value
        });
        syncData(); showToast("숙제가 배포되었습니다.");
    }
    else if(e.target.id === 'form-admin-lec') {
        if(!AppState.data.lectures) AppState.data.lectures = [];
        AppState.data.lectures.push({ id: generateId(), title: document.getElementById('lec-title').value, link: document.getElementById('lec-link').value });
        syncData(); showToast("강의가 등록되었습니다.");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    switchView('landing');
});
