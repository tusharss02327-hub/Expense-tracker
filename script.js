// ─────────────────────────────────────────
//  EXPENSE TRACKER — JavaScript Logic
//  Design by you · Logic by Claude
// ─────────────────────────────────────────

let expenses = [];

// ── Load saved data when page opens ──
function loadExpenses() {
  const saved = localStorage.getItem('tushar_expenses');
  if (saved) {
    expenses = JSON.parse(saved);
  }
  renderList();
  updateSummary();
}

// ── Save data to browser storage ──
function saveExpenses() {
  localStorage.setItem('tushar_expenses', JSON.stringify(expenses));
}

// ── Add new expense ──
function addExpense() {
  const nameInput   = document.getElementById('expense-name');
  const amountInput = document.getElementById('expense-amount');

  const name   = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);

  // Validation — stop if fields are empty or invalid
  if (!name) {
    alert('Please enter an expense name.');
    nameInput.focus();
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount greater than 0.');
    amountInput.focus();
    return;
  }

  // Build expense object
  const expense = {
    id     : Date.now(),                              // unique ID using timestamp
    name   : name,
    amount : amount,
    date   : new Date().toLocaleDateString('en-IN')   // e.g. 16/06/2026
  };

  expenses.push(expense);
  saveExpenses();
  renderList();
  updateSummary();

  // Clear inputs and focus name field for next entry
  nameInput.value   = '';
  amountInput.value = '';
  nameInput.focus();
}

// ── Delete one expense by ID ──
function deleteExpense(id) {
  expenses = expenses.filter(exp => exp.id !== id);
  saveExpenses();
  renderList();
  updateSummary();
}

// ── Render the expense list ──
function renderList() {
  const list = document.getElementById('expense-list');

  if (expenses.length === 0) {
    list.innerHTML = '<p class="empty-msg">No expenses yet. Add one above!</p>';
    return;
  }

  // Newest expense shown at top
  const reversed = [...expenses].reverse();

  list.innerHTML = reversed.map(exp => `
    <div class="expense-item" id="item-${exp.id}">
      <div class="expense-info">
        <span class="expense-name">${exp.name}</span>
        <span class="expense-date">${exp.date}</span>
      </div>
      <div class="expense-right">
        <span class="expense-amount">₹${exp.amount.toFixed(2)}</span>
        <button class="delete-btn" onclick="deleteExpense(${exp.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

// ── Update total and count ──
function updateSummary() {
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  document.getElementById('total-amount').textContent  = '₹' + total.toFixed(2);
  document.getElementById('expense-count').textContent = expenses.length + ' expense' + (expenses.length !== 1 ? 's' : '');
}

// ── Keyboard shortcuts ──
// Press Enter on name field → jump to amount field
document.getElementById('expense-name').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    document.getElementById('expense-amount').focus();
  }
});

// Press Enter on amount field → add expense
document.getElementById('expense-amount').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    addExpense();
  }
});

// ── Button click ──
document.getElementById('add-btn').addEventListener('click', addExpense);

// ── Run everything on page load ──
loadExpenses();
