// ===== DATA MANAGEMENT =====
const STORAGE_KEY = 'homeFinanceData';
const SETTINGS_KEY = 'homeFinanceSettings';

let transactions = [];
let settings = { currency: '₹', theme: 'light' };
let currentType = 'expense';
let charts = {};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadSettings();
    setDefaultDateTime();
    updatePeopleDatalist();
    navigateTo('dashboard');
    applyTheme();
    populateFilterCategories();
});

// Load data from localStorage
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    transactions = data ? JSON.parse(data) : [];
}

// Save data to localStorage
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// Load settings
function loadSettings() {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
        settings = JSON.parse(data);
        document.getElementById('currencySelect').value = settings.currency;
    }
}

// Save settings
function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ===== NAVIGATION =====
function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Render page content
    switch(page) {
        case 'dashboard': renderDashboard(); break;
        case 'transactions': renderTransactions(); break;
        case 'people': renderPeople(); break;
        case 'reports': generateReports(); break;
    }

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
}

// Nav click handlers
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===== TRANSACTION FORM =====
function setDefaultDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('dateTime').value = now.toISOString().slice(0, 16);
}

function setType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
}

function addTransaction(e) {
    e.preventDefault();

    const transaction = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        type: currentType,
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        person: document.getElementById('personName').value.trim(),
        status: document.getElementById('paymentStatus').value,
        dateTime: document.getElementById('dateTime').value,
        method: document.getElementById('paymentMethod').value,
        notes: document.getElementById('notes').value.trim(),
        createdAt: new Date().toISOString()
    };

    transactions.unshift(transaction);
    saveData();
    updatePeopleDatalist();
    resetForm();
    showToast('✅ Transaction saved successfully!', 'success');
    navigateTo('transactions');
}

function resetForm() {
    document.getElementById('transactionForm').reset();
    setDefaultDateTime();
    setType('expense');
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const pending = transactions.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);

    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expense);
    document.getElementById('totalBalance').textContent = formatCurrency(income - expense);
    document.getElementById('totalPending').textContent = formatCurrency(pending);

    renderMonthlyChart();
    renderCategoryChart();
    renderRecentTransactions();
}

function renderRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    const recent = transactions.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No transactions yet. Add your first entry!</p></div>`;
        return;
    }

    container.innerHTML = recent.map(t => createTransactionHTML(t)).join('');
}

// ===== RENDER TRANSACTIONS =====
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    let filtered = [...transactions];

    // Search
    const search = document.getElementById('searchInput').value.toLowerCase();
    if (search) {
        filtered = filtered.filter(t =>
            t.notes.toLowerCase().includes(search) ||
            (t.person && t.person.toLowerCase().includes(search)) ||
            t.category.toLowerCase().includes(search)
        );
    }

    // Type filter
    const type = document.getElementById('filterType').value;
    if (type !== 'all') filtered = filtered.filter(t => t.type === type);

    // Category filter
    const cat = document.getElementById('filterCategory').value;
    if (cat !== 'all') filtered = filtered.filter(t => t.category === cat);

    // Status filter
    const status = document.getElementById('filterStatus').value;
    if (status !== 'all') filtered = filtered.filter(t => t.status === status);

    // Month filter
    const month = document.getElementById('filterMonth').value;
    if (month) {
        filtered = filtered.filter(t => t.dateTime.startsWith(month));
    }

    // Sort
    const sort = document.getElementById('sortBy').value;
    switch(sort) {
        case 'date-desc': filtered.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)); break;
        case 'date-asc': filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)); break;
        case 'amount-desc': filtered.sort((a, b) => b.amount - a.amount); break;
        case 'amount-asc': filtered.sort((a, b) => a.amount - b.amount); break;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No transactions found.</p></div>`;
    } else {
        container.innerHTML = filtered.map(t => createTransactionHTML(t, true)).join('');
    }

    document.getElementById('transactionCount').textContent = `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`;
}

function createTransactionHTML(t, showActions = false) {
    const emoji = getCategoryEmoji(t.category);
    const date = new Date(t.dateTime);
    const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="transaction-item">
            <div class="transaction-left">
                <div class="transaction-emoji">${emoji}</div>
                <div class="transaction-details">
                    <div class="transaction-notes">${escapeHtml(t.notes)}</div>
                    <div class="transaction-meta">
                        <span>📅 ${dateStr} ${timeStr}</span>
                        ${t.person ? `<span>👤 ${escapeHtml(t.person)}</span>` : ''}
                        <span>💳 ${t.method}</span>
                        <span>📁 ${formatCategory(t.category)}</span>
                    </div>
                </div>
            </div>
            <div class="transaction-right">
                <span class="status-badge ${t.status}">${t.status}</span>
                <span class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                </span>
                ${showActions ? `
                <div class="transaction-actions">
                    <button class="btn-icon" onclick="editTransaction('${t.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteTransaction('${t.id}')" title="Delete">🗑️</button>
                </div>` : ''}
            </div>
        </div>
    `;
}

// ===== PEOPLE & DEBTS =====
function renderPeople() {
    const container = document.getElementById('peopleListContainer');
    const peopleMap = {};

    transactions.forEach(t => {
        if (!t.person) return;
        const name = t.person.toLowerCase();
        if (!peopleMap[name]) {
            peopleMap[name] = { name: t.person, total: 0, count: 0, pending: 0 };
        }
        if (t.status === 'pending') {
            if (t.type === 'expense') {
                peopleMap[name].total += t.amount;
                peopleMap[name].pending += t.amount;
            } else {
                peopleMap[name].total -= t.amount;
                peopleMap[name].pending -= t.amount;
            }
        }
        peopleMap[name].count++;
    });

    const people = Object.values(peopleMap).filter(p => p.pending !== 0);
    const totalOwe = people.filter(p => p.pending > 0).reduce((s, p) => s + p.pending, 0);
    const totalReceive = people.filter(p => p.pending < 0).reduce((s, p) => s + Math.abs(p.pending), 0);

    document.getElementById('totalYouOwe').textContent = formatCurrency(totalOwe);
    document.getElementById('totalYouReceive').textContent = formatCurrency(totalReceive);

    if (people.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>No pending payments with people. All settled! 🎉</p></div>`;
        return;
    }

    container.innerHTML = people
        .sort((a, b) => Math.abs(b.pending) - Math.abs(a.pending))
        .map(p => `
            <div class="person-card">
                <div class="person-info">
                    <div class="person-avatar">${p.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="person-name">${escapeHtml(p.name)}</div>
                        <div class="person-count">${p.count} transaction${p.count !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div class="person-amount ${p.pending > 0 ? 'owe' : 'receive'}">
                    ${p.pending > 0 ? 'You owe: ' : 'You\'ll get: '}${formatCurrency(Math.abs(p.pending))}
                </div>
            </div>
        `).join('');
}

// ===== CHARTS =====
function renderMonthlyChart() {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (charts.monthly) charts.monthly.destroy();

    const months = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = { income: 0, expense: 0, label: d.toLocaleDateString('en-IN', { month: 'short' }) };
    }

    transactions.forEach(t => {
        const key = t.dateTime.substring(0, 7);
        if (months[key]) {
            months[key][t.type] += t.amount;
        }
    });

    const labels = Object.values(months).map(m => m.label);
    const incomeData = Object.values(months).map(m => m.income);
    const expenseData = Object.values(months).map(m => m.expense);

    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Income', data: incomeData, backgroundColor: '#10b981', borderRadius: 6 },
                { label: 'Expense', data: expenseData, backgroundColor: '#ef4444', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (charts.category) charts.category.destroy();

    const cats = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(cats).map(c => formatCategory(c));
    const data = Object.values(cats);
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];

    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 2 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } }
        }
    });
}

// ===== REPORTS =====
function generateReports() {
    const period = document.getElementById('reportPeriod').value;
    let filtered = [...transactions];
    const now = new Date();

    switch(period) {
        case 'this-month':
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            filtered = filtered.filter(t => t.dateTime.startsWith(monthKey));
            break;
        case 'last-month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lmKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
            filtered = filtered.filter(t => t.dateTime.startsWith(lmKey));
            break;
        case 'this-year':
            filtered = filtered.filter(t => t.dateTime.startsWith(String(now.getFullYear())));
            break;
    }

    renderReportBarChart(filtered);
    renderReportPieChart(filtered);
    renderReportLineChart(filtered);
    renderReportTable(filtered);
}

function renderReportBarChart(data) {
    const ctx = document.getElementById('reportBarChart').getContext('2d');
    if (charts.reportBar) charts.reportBar.destroy();

    const income = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    charts.reportBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expense', 'Net'],
            datasets: [{
                data: [income, expense, income - expense],
                backgroundColor: ['#10b981', '#ef4444', '#6366f1'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderReportPieChart(data) {
    const ctx = document.getElementById('reportPieChart').getContext('2d');
    if (charts.reportPie) charts.reportPie.destroy();

    const cats = {};
    data.filter(t => t.type === 'expense').forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + t.amount;
    });

    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7'];

    charts.reportPie = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(cats).map(c => formatCategory(c)),
            datasets: [{ data: Object.values(cats), backgroundColor: colors, borderWidth: 2 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
        }
    });
}

function renderReportLineChart(data) {
    const ctx = document.getElementById('reportLineChart').getContext('2d');
    if (charts.reportLine) charts.reportLine.destroy();

    const daily = {};
    data.forEach(t => {
        const day = t.dateTime.substring(0, 10);
        if (!daily[day]) daily[day] = { income: 0, expense: 0 };
        daily[day][t.type] += t.amount;
    });

    const sortedDays = Object.keys(daily).sort();
    const labels = sortedDays.map(d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

    charts.reportLine = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Expense',
                    data: sortedDays.map(d => daily[d].expense),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Income',
                    data: sortedDays.map(d => daily[d].income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderReportTable(data) {
    const tbody = document.getElementById('reportTableBody');
    const cats = {};
    const totalExpense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    data.filter(t => t.type === 'expense').forEach(t => {
        if (!cats[t.category]) cats[t.category] = { count: 0, total: 0 };
        cats[t.category].count++;
        cats[t.category].total += t.amount;
    });

    const rows = Object.entries(cats)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cat, info]) => `
            <tr>
                <td>${getCategoryEmoji(cat)} ${formatCategory(cat)}</td>
                <td>${info.count}</td>
                <td>${formatCurrency(info.total)}</td>
                <td>${formatCurrency(info.total / info.count)}</td>
                <td>${totalExpense > 0 ? ((info.total / totalExpense) * 100).toFixed(1) : 0}%</td>
            </tr>
        `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;padding:24px;">No data for this period</td></tr>';
}

// ===== EDIT & DELETE =====
function editTransaction(id) {
    const t = transactions.find(tr => tr.id === id);
    if (!t) return;

    document.getElementById('editId').value = t.id;
    document.getElementById('editAmount').value = t.amount;
    document.getElementById('editPerson').value = t.person || '';
    document.getElementById('editStatus').value = t.status;
    document.getElementById('editDateTime').value = t.dateTime;
    document.getElementById('editNotes').value = t.notes;

    // Populate category select
    const catSelect = document.getElementById('editCategory');
    catSelect.innerHTML = document.getElementById('category').innerHTML;
    catSelect.value = t.category;

    document.getElementById('editModal').classList.add('active');
}

function saveEdit(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) return;

    transactions[idx] = {
        ...transactions[idx],
        amount: parseFloat(document.getElementById('editAmount').value),
        category: document.getElementById('editCategory').value,
        person: document.getElementById('editPerson').value.trim(),
        status: document.getElementById('editStatus').value,
        dateTime: document.getElementById('editDateTime').value,
        notes: document.getElementById('editNotes').value.trim(),
        updatedAt: new Date().toISOString()
    };

    saveData();
    closeModal();
    renderTransactions();
    showToast('✅ Transaction updated!', 'success');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    renderTransactions();
    showToast('🗑️ Transaction deleted!', 'info');
}

function clearAllData() {
    if (!confirm('⚠️ This will delete ALL your data permanently. Are you sure?')) return;
    if (!confirm('This action CANNOT be undone. Type OK to confirm.')) return;
    transactions = [];
    saveData();
    navigateTo('dashboard');
    showToast('🗑️ All data cleared!', 'error');
}

// ===== EXPORT / IMPORT =====
function exportData() {
    const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        settings,
        transactions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-finance-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Data exported successfully!', 'success');
}

function exportCSV() {
    const headers = ['Date', 'Type', 'Category', 'Amount', 'Person', 'Status', 'Method', 'Notes'];
    const rows = transactions.map(t => [
        t.dateTime,
        t.type,
        t.category,
        t.amount,
        t.person || '',
        t.status,
        t.method,
        `"${t.notes.replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `home-finance-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 CSV exported!', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions && Array.isArray(data.transactions)) {
                if (confirm(`Import ${data.transactions.length} transactions? This will merge with existing data.`)) {
                    const existingIds = new Set(transactions.map(t => t.id));
                    const newTransactions = data.transactions.filter(t => !existingIds.has(t.id));
                    transactions = [...newTransactions, ...transactions];
                    saveData();
                    if (data.settings) {
                        settings = { ...settings, ...data.settings };
                        saveSettings();
                    }
                    navigateTo('dashboard');
                    showToast(`📥 Imported ${newTransactions.length} new transactions!`, 'success');
                }
            } else {
                showToast('❌ Invalid file format!', 'error');
            }
        } catch (err) {
            showToast('❌ Error reading file!', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ===== SETTINGS =====
function changeCurrency() {
    settings.currency = document.getElementById('currencySelect').value;
    saveSettings();
    navigateTo('dashboard');
    showToast('💱 Currency updated!', 'info');
}

function setTheme(theme) {
    settings.theme = theme;
    saveSettings();
    applyTheme();
    document.querySelectorAll('.btn-theme').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.querySelectorAll('.btn-theme').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });
}

// ===== UTILITIES =====
function formatCurrency(amount) {
    return `${settings.currency}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCategory(cat) {
    return cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getCategoryEmoji(cat) {
    const emojis = {
        groceries: '🛒', rent: '🏠', electricity: '💡', water: '💧',
        internet: '🌐', phone: '📱', transport: '🚗', food: '🍕',
        medical: '🏥', education: '📚', shopping: '🛍️', entertainment: '🎬',
        maintenance: '🔧', insurance: '🛡️', emi: '🏦', gifts: '🎁',
        'other-expense': '📦', salary: '💼', freelance: '💻',
        business: '🏪', 'rental-income': '🏘️', interest: '📈', 'other-income': '💰'
    };
    return emojis[cat] || '📋';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updatePeopleDatalist() {
    const people = [...new Set(transactions.map(t => t.person).filter(Boolean))];
    document.getElementById('peopleList').innerHTML = people.map(p => `<option value="${escapeHtml(p)}">`).join('');
}

function populateFilterCategories() {
    const select = document.getElementById('filterCategory');
    const categories = [
        'groceries', 'rent', 'electricity', 'water', 'internet', 'phone',
        'transport', 'food', 'medical', 'education', 'shopping', 'entertainment',
        'maintenance', 'insurance', 'emi', 'gifts', 'other-expense',
        'salary', 'freelance', 'business', 'rental-income', 'interest', 'other-income'
    ];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${getCategoryEmoji(cat)} ${formatCategory(cat)}`;
        select.appendChild(opt);
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Close modal on outside click
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editModal')) closeModal();
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});