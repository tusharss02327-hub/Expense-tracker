// ═══════════════════════════════════════════
//  EXPENSE TRACKER — script.js
//  Firebase Auth + Firestore + Multi-Page
// ═══════════════════════════════════════════

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyBsUnxy10-PTnajWsbnIk41oXXQNKX-aYw",
  authDomain: "expense-tracker-9b6f4.firebaseapp.com",
  projectId: "expense-tracker-9b6f4",
  storageBucket: "expense-tracker-9b6f4.firebasestorage.app",
  messagingSenderId: "740282931834",
  appId: "1:740282931834:web:ae5d6243217475f3e2b9c3"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── State ──
let currentUser    = null;
let allExpenses    = [];
let authMode       = 'login';
let selectedCat    = 'Food';
let activeFilter   = 'all';
let analyticsPeriod= 'monthly';
let unsubscribe    = null;
let pickerDate     = new Date();   // calendar navigator
let chosenDate     = null;         // user selected date
let datePickerFor  = 'expense';    // 'expense' or 'filter'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const CAT_BG = {
  Food:'#FEF3C7', Home:'#DCFCE7', Birthday:'#FCE7F3', Travel:'#E0F2FE',
  Shopping:'#F3E8FF', Health:'#D1FAE5', Entertainment:'#FEF9C3', Other:'#F3F4F6'
};
const CAT_EMOJI = {
  Food:'🍔', Home:'🏠', Birthday:'🎂', Travel:'🚌',
  Shopping:'🛍️', Health:'💊', Entertainment:'🎮', Other:'📌'
};

// ═══════════════════════════════════
//  AUTH
// ═══════════════════════════════════

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    initApp();
    startListening();
  } else {
    currentUser = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display  = 'none';
  }
});

function initApp() {
  const name  = currentUser.displayName || currentUser.email.split('@')[0];
  const email = currentUser.email;
  const init  = name.charAt(0).toUpperCase();

  // Populate all name/email/avatar fields
  ['acc-avatar','user-avatar'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=init; });
  const nameEl = document.getElementById('acc-name'); if(nameEl) nameEl.textContent = name;
  const mailEl = document.getElementById('acc-email'); if(mailEl) mailEl.textContent = email;

  // Set header date
  updateHeaderDate();

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'flex';
  goPage('home');
}

function updateHeaderDate() {
  const now = new Date();
  const d = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS_S[now.getMonth()]}`;
  const el = document.getElementById('hdr-date-txt');
  if (el) el.textContent = d;
}

function toggleMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const s = authMode === 'signup';
  document.getElementById('auth-heading').textContent = s ? 'Create Account' : 'Welcome back';
  document.getElementById('auth-btn').textContent     = s ? 'Sign Up'        : 'Log In';
  document.getElementById('auth-switch').textContent  = s ? 'Log In'         : 'Sign Up';
  document.getElementById('name-field').style.display = s ? 'block'          : 'none';
  document.getElementById('auth-err').textContent     = '';
}

async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const pw    = document.getElementById('auth-password').value;
  const err   = document.getElementById('auth-err');
  err.textContent = '';
  if (!email || !pw) { err.textContent = 'Fill in all fields.'; return; }
  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, pw);
    } else {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) { err.textContent = 'Enter your name.'; return; }
      const cred = await auth.createUserWithEmailAndPassword(email, pw);
      await cred.user.updateProfile({ displayName: name });
    }
  } catch(e) { err.textContent = e.message.replace('Firebase: ','').replace(/ \(.+\)/,''); }
}

function logout() {
  if (confirm('Are you sure you want to logout?')) auth.signOut();
}

// Enter key on auth
document.addEventListener('keypress', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') handleAuth();
});

// ═══════════════════════════════════
//  FIRESTORE
// ═══════════════════════════════════

function startListening() {
  if (unsubscribe) unsubscribe();
  unsubscribe = db.collection('expenses')
    .where('userId','==', currentUser.uid)
    .onSnapshot(snap => {
      allExpenses = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      allExpenses.sort((a,b) => (b.date > a.date ? 1 : -1));
      renderAll();
    }, e => console.error(e));
}

async function addExpense() {
  const name   = document.getElementById('exp-name').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!name)                     { alert('Enter expense name.');    return; }
  if (isNaN(amount) || amount<=0){ alert('Enter valid amount.');     return; }
  if (!chosenDate)               { alert('Select a date.');          return; }

  const [y, m] = chosenDate.split('-').map(Number);
  try {
    await db.collection('expenses').add({
      userId:   currentUser.uid,
      name, amount,
      category: selectedCat,
      date:     chosenDate,
      month:    m,
      year:     y,
      addedAt:  firebase.firestore.FieldValue.serverTimestamp()
    });
    closeAddModal();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try { await db.collection('expenses').doc(id).delete(); }
  catch(e) { alert('Error: ' + e.message); }
}

// ═══════════════════════════════════
//  RENDER
// ═══════════════════════════════════

function renderAll() {
  renderHome();
  renderTransactions();
  renderAnalytics();
  renderAccountStats();
}

// ── HOME ──
function renderHome() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  const thisMonth = allExpenses.filter(e => e.month === m && e.year === y);
  const total = thisMonth.reduce((s,e) => s+e.amount, 0);

  // Last month
  let lm = m - 1, ly = y;
  if (lm === 0) { lm = 12; ly--; }
  const lastMonth = allExpenses.filter(e => e.month === lm && e.year === ly);
  const lastTotal = lastMonth.reduce((s,e) => s+e.amount, 0);

  document.getElementById('home-total').textContent = '₹' + total.toFixed(2);

  const allTime = allExpenses.reduce((s,e) => s+e.amount, 0);
  document.getElementById('home-wallet').textContent = '₹' + allTime.toFixed(2);

  // Diff label
  const diffEl = document.getElementById('home-diff');
  if (lastTotal > 0) {
    const pct = Math.abs(((total - lastTotal) / lastTotal) * 100).toFixed(0);
    const up  = total > lastTotal;
    diffEl.innerHTML = `<span class="${up?'diff-up':'diff-down'}">${up?'↑':'↓'} ${pct}%</span>&nbsp;vs last month`;
  } else {
    diffEl.textContent = 'No data for last month';
  }

  // Recent 5
  const recent = thisMonth.slice(0, 5);
  const el = document.getElementById('recent-list');
  el.innerHTML = recent.length ? recent.map(e => txnItemHTML(e)).join('') : '<p class="empty-msg">No expenses this month</p>';
}

// ── TRANSACTIONS ──
function renderTransactions() {
  let list = [...allExpenses];
  if (activeFilter !== 'all') list = list.filter(e => e.category === activeFilter);
  const el = document.getElementById('full-list');
  el.innerHTML = list.length ? list.map(e => txnItemHTML(e)).join('') : '<p class="empty-msg">No transactions found</p>';
}

function txnItemHTML(e) {
  return `
    <div class="txn-item">
      <div class="txn-emoji" style="background:${CAT_BG[e.category]||'#F3F4F6'}">${CAT_EMOJI[e.category]||'📌'}</div>
      <div class="txn-info">
        <span class="txn-name">${e.name}</span>
        <span class="txn-meta">${e.category} · ${fmtDate(e.date)}</span>
      </div>
      <div class="txn-right">
        <span class="txn-amt">-₹${e.amount.toFixed(2)}</span>
        <button class="del-btn" onclick="deleteExpense('${e.id}')">✕</button>
      </div>
    </div>`;
}

function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${parseInt(day)} ${MONTHS_S[parseInt(m)-1]} ${y}`;
}

// ── ANALYTICS ──
function renderAnalytics() {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear  = now.getFullYear();

  // Last 6 months data
  const data = [];
  for (let i = 5; i >= 0; i--) {
    let mo = curMonth - i, yr = curYear;
    if (mo < 0) { mo += 12; yr--; }
    const total = allExpenses
      .filter(e => e.month === mo+1 && e.year === yr)
      .reduce((s,e) => s+e.amount, 0);
    data.push({ label: MONTHS_S[mo], total });
  }

  const max = Math.max(...data.map(d => d.total), 1);

  // Bars
  document.getElementById('chart-bars').innerHTML = data.map(d =>
    `<div class="bar-col"><div class="bar-fill" style="height:${Math.max(d.total/max*100,3)}%"></div></div>`
  ).join('');

  // Month labels
  document.getElementById('chart-months').innerHTML = data.map(d =>
    `<div class="bar-month">${d.label}</div>`
  ).join('');

  // Stats
  const allTotal = allExpenses.reduce((s,e) => s+e.amount, 0);
  const months   = [...new Set(allExpenses.map(e => `${e.year}-${e.month}`))].length || 1;
  document.getElementById('stat-total-amt').textContent = '₹' + allTotal.toFixed(0);
  document.getElementById('stat-avg-amt').textContent   = '₹' + (allTotal / months).toFixed(0);

  // Monthly history
  const grouped = {};
  allExpenses.forEach(e => {
    const key = `${e.year}-${String(e.month).padStart(2,'0')}`;
    if (!grouped[key]) grouped[key] = { label:`${MONTHS[e.month-1]} ${e.year}`, total:0, count:0 };
    grouped[key].total += e.amount;
    grouped[key].count++;
  });
  const sorted = Object.entries(grouped).sort((a,b) => b[0].localeCompare(a[0]));
  const histEl = document.getElementById('history-list');
  histEl.innerHTML = sorted.length ? sorted.map(([,v]) => `
    <div class="hist-item">
      <div><div class="hist-month">${v.label}</div><div class="hist-count">${v.count} expenses</div></div>
      <div class="hist-amt">₹${v.total.toFixed(2)}</div>
    </div>`).join('') : '<p class="empty-msg">No data yet</p>';
}

function setAnalyticsPeriod(p) {
  analyticsPeriod = p;
  document.getElementById('ptog-m').classList.toggle('active', p==='monthly');
  document.getElementById('ptog-y').classList.toggle('active', p==='yearly');
}

// ── ACCOUNT STATS ──
function renderAccountStats() {
  const now = new Date();
  const m = now.getMonth()+1, y = now.getFullYear();
  const allTotal   = allExpenses.reduce((s,e)=>s+e.amount,0);
  const monthTotal = allExpenses.filter(e=>e.month===m&&e.year===y).reduce((s,e)=>s+e.amount,0);
  document.getElementById('qs-total').textContent = '₹'+allTotal.toFixed(0);
  document.getElementById('qs-month').textContent = '₹'+monthTotal.toFixed(0);
  document.getElementById('qs-count').textContent = allExpenses.length;
}

// ═══════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════

function goPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(n => n.classList.remove('active'));

  // Show selected
  const page = document.getElementById('p-'+name);
  const nav  = document.getElementById('nav-'+name);
  if (page) page.classList.add('active');
  if (nav)  nav.classList.add('active');

  // Scroll to top
  if (page) { const s = page.querySelector('.pg-scroll'); if(s) s.scrollTop = 0; }
}

// ═══════════════════════════════════
//  CATEGORY FILTER
// ═══════════════════════════════════

function filterCat(el, cat) {
  document.querySelectorAll('.cchip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = cat;
  renderTransactions();
}

// ═══════════════════════════════════
//  ADD EXPENSE MODAL
// ═══════════════════════════════════

function openAddModal() {
  // Reset form
  document.getElementById('exp-name').value   = '';
  document.getElementById('exp-amount').value = '';
  chosenDate = null;
  document.getElementById('date-display-txt').textContent = 'Select date';
  document.querySelectorAll('.mcat').forEach(c => c.classList.remove('active'));
  document.querySelector('.mcat[data-cat="Food"]').classList.add('active');
  selectedCat = 'Food';

  document.getElementById('modal-bg').style.display  = 'block';
  document.getElementById('add-modal').style.display = 'flex';
}

function closeAddModal() {
  document.getElementById('modal-bg').style.display  = 'none';
  document.getElementById('add-modal').style.display = 'none';
}

function selectCat(el) {
  document.querySelectorAll('.mcat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedCat = el.dataset.cat;
}

// ═══════════════════════════════════
//  CUSTOM DATE PICKER
// ═══════════════════════════════════

function openDatePicker() {
  datePickerFor = 'expense';
  // Start calendar on today
  pickerDate = chosenDate ? new Date(chosenDate + 'T00:00:00') : new Date();
  renderCalendar();
  document.getElementById('datepicker-bg').style.display = 'block';
  document.getElementById('datepicker').style.display    = 'flex';
}

function openDateFilter() {
  datePickerFor = 'filter';
  pickerDate = new Date();
  renderCalendar();
  document.getElementById('datepicker-bg').style.display = 'block';
  document.getElementById('datepicker').style.display    = 'flex';
}

function closeDatePicker() {
  document.getElementById('datepicker-bg').style.display = 'none';
  document.getElementById('datepicker').style.display    = 'none';
}

function calPrevMonth() {
  pickerDate.setDate(1);
  pickerDate.setMonth(pickerDate.getMonth() - 1);
  renderCalendar();
}

function calNextMonth() {
  pickerDate.setDate(1);
  pickerDate.setMonth(pickerDate.getMonth() + 1);
  renderCalendar();
}

function renderCalendar() {
  const y  = pickerDate.getFullYear();
  const m  = pickerDate.getMonth();
  const firstDay    = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayStr    = new Date().toISOString().split('T')[0];

  document.getElementById('cal-lbl').textContent = `${MONTHS[m]} ${y}`;

  let html = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = ['cal-day',
      ds === chosenDate ? 'selected' : '',
      ds === todayStr   ? 'today'    : ''
    ].join(' ').trim();
    html += `<div class="${cls}" onclick="pickDay('${ds}')">${d}</div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function pickDay(dateStr) {
  chosenDate = dateStr;
  renderCalendar(); // re-render to highlight selection
}

function confirmDate() {
  if (!chosenDate) { alert('Please select a date.'); return; }
  if (datePickerFor === 'expense') {
    document.getElementById('date-display-txt').textContent = fmtDate(chosenDate);
  }
  closeDatePicker();
}

// ═══════════════════════════════════
//  ACCOUNT FEATURES
// ═══════════════════════════════════

function editProfile() {
  const name = prompt('Enter new display name:', currentUser.displayName || '');
  if (!name || !name.trim()) return;
  currentUser.updateProfile({ displayName: name.trim() }).then(() => {
    const n = name.trim();
    document.getElementById('acc-name').textContent = n;
    document.getElementById('acc-avatar').textContent = n.charAt(0).toUpperCase();
    alert('Name updated!');
  }).catch(e => alert('Error: ' + e.message));
}

function exportCSV() {
  if (!allExpenses.length) { alert('No expenses to export.'); return; }
  const rows  = [['Date','Name','Category','Amount (₹)']];
  allExpenses.forEach(e => rows.push([e.date, e.name, e.category, e.amount.toFixed(2)]));
  const csv   = rows.map(r => r.join(',')).join('\n');
  const blob  = new Blob([csv], { type:'text/csv' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = 'expenses.csv'; a.click();
  URL.revokeObjectURL(url);
}
