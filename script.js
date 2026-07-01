// ─────────────────────────────────────────
//  EXPENSE TRACKER — script.js
//  Firebase Auth + Firestore
// ─────────────────────────────────────────

// ── FIREBASE CONFIG ──
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

// ── APP STATE ──
let currentUser  = null;
let allExpenses  = [];
let currentPeriod = 'monthly';
let currentMonth  = new Date().getMonth();      // 0–11
let currentYear   = new Date().getFullYear();
let activeFilter  = 'all';
let selectedCat   = 'Food';
let authMode      = 'login';
let unsubscribe   = null;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const CAT_BG = {
  Food: '#fef3c7', Home: '#dcfce7', Birthday: '#fce7f3',
  Travel: '#e0f2fe', Shopping: '#f3e8ff', Health: '#d1fae5',
  Entertainment: '#fef9c3', Other: '#f3f4f6'
};

const CAT_EMOJI = {
  Food:'🍔', Home:'🏠', Birthday:'🎂', Travel:'🚌',
  Shopping:'🛍️', Health:'💊', Entertainment:'🎮', Other:'📌'
};

// ═══════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════

// Listen for login/logout
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    const name = user.displayName || user.email.split('@')[0];
    document.getElementById('user-name').textContent  = name + ' 👋';
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display  = 'flex';
    updatePeriodUI();
    startListening();
  } else {
    currentUser = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display  = 'none';
  }
});

// Toggle Login ↔ Signup form
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const isSignup = authMode === 'signup';
  document.getElementById('auth-title').textContent         = isSignup ? 'Create Account' : 'Welcome back';
  document.getElementById('auth-btn').textContent           = isSignup ? 'Sign Up'        : 'Log In';
  document.getElementById('auth-switch-link').textContent   = isSignup ? 'Log In'         : 'Sign Up';
  document.getElementById('name-group').style.display       = isSignup ? 'block'          : 'none';
  document.getElementById('auth-error').textContent         = '';
  document.querySelector('.auth-switch').firstChild.textContent =
    isSignup ? 'Already have an account? ' : "Don't have an account? ";
}

// Handle Login / Signup button
async function handleAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  try {
    if (authMode === 'login') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) { errEl.textContent = 'Please enter your name.'; return; }
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      // Refresh so displayName updates
      currentUser = auth.currentUser;
      const n = currentUser.displayName || email.split('@')[0];
      document.getElementById('user-name').textContent   = n + ' 👋';
      document.getElementById('user-avatar').textContent = n.charAt(0).toUpperCase();
    }
  } catch (err) {
    errEl.textContent = err.message.replace('Firebase: ', '');
  }
}

// Logout
function logout() {
  if (confirm('Are you sure you want to logout?')) auth.signOut();
}

// Enter key on auth form
document.addEventListener('keypress', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') {
    handleAuth();
  }
});

// ═══════════════════════════════════════
//  FIRESTORE — REAL-TIME LISTENER
// ═══════════════════════════════════════

function startListening() {
  if (unsubscribe) unsubscribe();
  unsubscribe = db.collection('expenses')
    .where('userId', '==', currentUser.uid)
    .onSnapshot(snapshot => {
      allExpenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort newest first by date string (YYYY-MM-DD sorts correctly)
      allExpenses.sort((a, b) => (b.date > a.date ? 1 : -1));
      renderExpenses();
    }, err => console.error('Firestore error:', err));
}

// ═══════════════════════════════════════
//  ADD EXPENSE
// ═══════════════════════════════════════

async function addExpense() {
  const name    = document.getElementById('expense-name').value.trim();
  const amount  = parseFloat(document.getElementById('expense-amount').value);
  const dateVal = document.getElementById('expense-date').value;  // YYYY-MM-DD

  if (!name)                    { alert('Please enter expense name.');    return; }
  if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!dateVal)                 { alert('Please select a date.');          return; }

  const [year, month] = dateVal.split('-').map(Number);  // month = 1–12

  try {
    await db.collection('expenses').add({
      userId  : currentUser.uid,
      name    : name,
      amount  : amount,
      category: selectedCat,
      date    : dateVal,      // "YYYY-MM-DD"
      month   : month,        // 1–12
      year    : year,
      addedAt : firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal();
  } catch (err) {
    alert('Error saving: ' + err.message);
  }
}

// ═══════════════════════════════════════
//  DELETE EXPENSE
// ═══════════════════════════════════════

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    await db.collection('expenses').doc(id).delete();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
}

// ═══════════════════════════════════════
//  RENDER EXPENSE LIST
// ═══════════════════════════════════════

function renderExpenses() {
  let list = [...allExpenses];

  // Filter by selected period
  if (currentPeriod === 'monthly') {
    list = list.filter(e => e.month === currentMonth + 1 && e.year === currentYear);
  } else {
    list = list.filter(e => e.year === currentYear);
  }

  // Filter by category
  if (activeFilter !== 'all') {
    list = list.filter(e => e.category === activeFilter);
  }

  // Update summary
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('total-amount').textContent  = '₹' + total.toFixed(2);
  document.getElementById('expense-count').textContent =
    list.length + ' expense' + (list.length !== 1 ? 's' : '');

  // Render items
  const el = document.getElementById('expense-list');
  if (list.length === 0) {
    el.innerHTML = '<p class="empty-msg">No expenses found!</p>';
    return;
  }

  el.innerHTML = list.map(e => `
    <div class="expense-item">
      <div class="expense-emoji" style="background:${CAT_BG[e.category] || '#f3f4f6'}">
        ${CAT_EMOJI[e.category] || '📌'}
      </div>
      <div class="expense-info">
        <span class="expense-name">${e.name}</span>
        <span class="expense-meta">${e.category} · ${formatDate(e.date)}</span>
      </div>
      <div class="expense-right">
        <span class="expense-amount">₹${e.amount.toFixed(2)}</span>
        <button class="del-btn" onclick="deleteExpense('${e.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

// "2026-06-15" → "15 Jun 2026"
function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${mon[parseInt(m)-1]} ${y}`;
}

// ═══════════════════════════════════════
//  PERIOD (Monthly / Yearly)
// ═══════════════════════════════════════

function setPeriod(p) {
  currentPeriod = p;
  document.getElementById('btn-monthly').classList.toggle('active', p === 'monthly');
  document.getElementById('btn-yearly').classList.toggle('active',  p === 'yearly');
  document.getElementById('month-nav').style.display = p === 'monthly' ? 'flex' : 'none';
  document.getElementById('year-nav').style.display  = p === 'yearly'  ? 'flex' : 'none';
  updatePeriodUI();
  renderExpenses();
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0;  currentYear++; }
  updatePeriodUI();
  renderExpenses();
}

function changeYear(dir) {
  currentYear += dir;
  updatePeriodUI();
  renderExpenses();
}

function updatePeriodUI() {
  document.getElementById('month-label').textContent = MONTHS[currentMonth] + ' ' + currentYear;
  document.getElementById('year-label').textContent  = currentYear;
  const lbl = currentPeriod === 'monthly' ? MONTHS[currentMonth] : currentYear;
  document.getElementById('total-label').textContent = 'Total Spent — ' + lbl;
}

// ═══════════════════════════════════════
//  CATEGORY FILTER
// ═══════════════════════════════════════

function filterCat(el, cat) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = cat;
  renderExpenses();
}

// ═══════════════════════════════════════
//  ADD EXPENSE MODAL
// ═══════════════════════════════════════

function openModal() {
  // Default date = today
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('expense-name').value   = '';
  document.getElementById('expense-amount').value = '';
  document.getElementById('modal-bg').style.display  = 'block';
  document.getElementById('add-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-bg').style.display  = 'none';
  document.getElementById('add-modal').style.display = 'none';
}

function selectCat(el) {
  document.querySelectorAll('.mcat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedCat = el.dataset.cat;
}
