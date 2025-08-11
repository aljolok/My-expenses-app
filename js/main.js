document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const balance = document.getElementById('balance-amount');
    const money_plus = document.getElementById('income-amount');
    const money_minus = document.getElementById('expense-amount');
    const list = document.getElementById('transaction-list');
    const form = document.getElementById('form');
    const text = document.getElementById('text');
    const amount = document.getElementById('amount');
    const category = document.getElementById('category');
    const categoryChartCanvas = document.getElementById('category-chart').getContext('2d');
    const timelineChartCanvas = document.getElementById('timeline-chart').getContext('2d');
    const searchText = document.getElementById('search-text');
    const filterCategory = document.getElementById('filter-category');
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const themeToggle = document.getElementById('theme-toggle');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const budgetForm = document.getElementById('budget-form');
    const budgetCategory = document.getElementById('budget-category');
    const budgetAmount = document.getElementById('budget-amount');
    const budgetList = document.getElementById('budget-list');

    let categoryChart;
    let timelineChart;
    let transactions = [];
    let masterPassword = '';
    let isGuestMode = false;
    let budgets = {};

    // --- ENCRYPTION & DATA ---
    function encryptData(data, password) { return CryptoJS.AES.encrypt(JSON.stringify(data), password).toString(); }
    function decryptData(encryptedData, password) { return JSON.parse(CryptoJS.AES.decrypt(encryptedData, password).toString(CryptoJS.enc.Utf8)); }

    function handlePassword() {
        const modal = document.getElementById('password-modal');
        modal.style.display = 'flex';
        document.getElementById('password-submit').onclick = () => {
            const passwordInput = document.getElementById('password-input');
            const password = passwordInput.value;
            const storedHash = localStorage.getItem('password_hash');
            const errorEl = document.getElementById('password-error');
            if (storedHash && !isGuestMode) {
                if (CryptoJS.SHA256(password).toString() === storedHash) {
                    masterPassword = password;
                    loadEncryptedData();
                    modal.style.display = 'none';
                } else { errorEl.textContent = 'Wrong password!'; }
            } else {
                if (password.length < 4) { errorEl.textContent = 'Password must be at least 4 characters.'; return; }
                localStorage.setItem('password_hash', CryptoJS.SHA256(password).toString());
                masterPassword = password;
                isGuestMode = false;
                document.getElementById('guest-mode-banner').style.display = 'none';
                updateLocalStorage(); // Save current (guest) transactions
                loadEncryptedData();
                modal.style.display = 'none';
            }
            passwordInput.value = '';
        };
        document.getElementById('guest-mode-btn').onclick = (e) => {
            e.preventDefault();
            isGuestMode = true;
            transactions = [];
            budgets = {};
            modal.style.display = 'none';
            document.getElementById('guest-mode-banner').style.display = 'block';
            render();
        };
    }

    function loadEncryptedData() {
        const encryptedTransactions = localStorage.getItem('transactions');
        if (encryptedTransactions) {
            try {
                transactions = decryptData(encryptedTransactions, masterPassword);
            } catch (e) {
                alert("Could not decrypt transaction data.");
                transactions = [];
            }
        } else { transactions = []; }

        const encryptedBudgets = localStorage.getItem('budgets');
        if (encryptedBudgets) {
            try {
                budgets = decryptData(encryptedBudgets, masterPassword);
            } catch (e) {
                alert("Could not decrypt budget data.");
                budgets = {};
            }
        } else { budgets = {}; }
        render();
    }

    const predefinedColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    let categoryColors = JSON.parse(localStorage.getItem('categoryColors')) || {};

    function getCategoryColor(category) {
        if (!categoryColors[category]) {
            const colorIndex = Object.keys(categoryColors).length % predefinedColors.length;
            categoryColors[category] = predefinedColors[colorIndex];
            if (!isGuestMode) localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
        }
        return categoryColors[category];
    }

    function updateLocalStorage() {
        if (isGuestMode || !masterPassword) return;
        localStorage.setItem('transactions', encryptData(transactions, masterPassword));
        localStorage.setItem('budgets', encryptData(budgets, masterPassword));
        localStorage.setItem('categoryColors', JSON.stringify(categoryColors));
    }

    // --- TRANSACTIONS ---
    function addTransaction(e) {
        e.preventDefault();
        if (text.value.trim() === '' || amount.value.trim() === '') return alert('Please add a description and amount');
        const transactionType = document.querySelector('input[name="type"]:checked').value;
        const transactionAmount = transactionType === 'expense' ? -Math.abs(amount.value) : +Math.abs(amount.value);
        const transaction = {
            id: generateID(), text: text.value, amount: +transactionAmount,
            category: category.value.trim() || 'Uncategorized', type: transactionType, date: new Date().toISOString()
        };
        transactions.push(transaction);
        checkBudget(transaction);
        updateLocalStorage();
        render(transaction.id);
        text.value = ''; amount.value = ''; category.value = '';
    }
    function generateID() { return Math.floor(Math.random() * 1000000000); }

    // --- UI RENDERING ---
    function addTransactionDOM(transaction, isNew = false) {
        const sign = transaction.amount < 0 ? '-' : '+';
        const item = document.createElement('li');
        item.dataset.id = transaction.id;
        item.classList.add(transaction.amount < 0 ? 'minus' : 'plus', isNew ? 'new' : '');
        if(isNew) setTimeout(() => item.classList.remove('new'), 500);
        const categoryColor = getCategoryColor(transaction.category);
        item.innerHTML = `
            <div>
                <span class="transaction-text">${transaction.text}</span>
                <small class="transaction-category"><span class="color-dot" style="background-color: ${categoryColor}"></span>${transaction.category}</small>
            </div>
            <span>${sign}${Math.abs(transaction.amount).toFixed(2)}</span>
            <button class="delete-btn" onclick="removeTransaction(${transaction.id})">x</button>`;
        list.appendChild(item);

        // Swipe to delete
        let touchstartX = 0;
        let touchmoveX = 0;
        let isSwiping = false;

        item.addEventListener('touchstart', (e) => {
            touchstartX = e.changedTouches[0].screenX;
            isSwiping = true;
        }, false);

        item.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            touchmoveX = e.changedTouches[0].screenX;
            const diff = touchmoveX - touchstartX;
            if (diff < 0) { // Only allow left swipe
                item.style.transform = `translateX(${diff}px)`;
            }
        }, false);

        item.addEventListener('touchend', (e) => {
            if (!isSwiping) return;
            isSwiping = false;
            const touchendX = e.changedTouches[0].screenX;
            item.style.transition = 'transform 0.3s ease';
            const diff = touchendX - touchstartX;

            if (diff < -100) {
                removeTransaction(transaction.id);
            } else {
                item.style.transform = 'translateX(0)';
            }
            setTimeout(() => {
                item.style.transition = '';
            }, 300);
        }, false);
    }

    window.removeTransaction = function(id) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        updateLocalStorage();
        render();
    }

    function updateValues(filteredTransactions) {
        const amounts = filteredTransactions.map(t => t.amount);
        const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
        const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0).toFixed(2);
        const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1).toFixed(2);
        balance.innerText = `$${total}`; money_plus.innerText = `+$${income}`; money_minus.innerText = `-$${expense}`;
        document.getElementById('widget-balance').innerText = `$${total}`;
    }

    function updateDashboard(filteredTransactions) {
        if (categoryChart) categoryChart.destroy();
        if (timelineChart) timelineChart.destroy();
        if (!filteredTransactions.length) return;
        const expenseByCategory = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount); return acc; }, {});
        categoryChart = new Chart(categoryChartCanvas, { type: 'pie', data: { labels: Object.keys(expenseByCategory), datasets: [{ data: Object.values(expenseByCategory), backgroundColor: predefinedColors }] } });
        const monthlyData = filteredTransactions.reduce((acc, t) => {
            if (!t.date) return acc;
            const month = new Date(t.date).toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!acc[month]) acc[month] = { income: 0, expense: 0 };
            if (t.type === 'income') acc[month].income += t.amount; else acc[month].expense += Math.abs(t.amount);
            return acc;
        }, {});
        const sortedMonths = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
        timelineChart = new Chart(timelineChartCanvas, { type: 'bar', data: { labels: sortedMonths, datasets: [ { label: 'Income', data: sortedMonths.map(m => monthlyData[m].income), backgroundColor: 'rgba(75, 192, 192, 0.5)' }, { label: 'Expense', data: sortedMonths.map(m => monthlyData[m].expense), backgroundColor: 'rgba(255, 99, 132, 0.5)' }]}});
    }

    function populateCategories() {
        const categories = ['all', ...new Set(transactions.map(t => t.category))];
        const currentCategoryFilter = filterCategory.value;
        filterCategory.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            if (cat === currentCategoryFilter) option.selected = true;
            filterCategory.appendChild(option);
        });
        const currentBudgetCategory = budgetCategory.value;
        budgetCategory.innerHTML = '';
        categories.filter(c => c !== 'all').forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            if (cat === currentBudgetCategory) option.selected = true;
            budgetCategory.appendChild(option);
        });
    }

    function updateKPIs() {
        const kpiContainer = document.getElementById('kpi-container');
        kpiContainer.innerHTML = '';
        const thisMonthExpenses = transactions.filter(t => {
            if (!t.date || t.type !== 'expense') return false;
            const d = new Date(t.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        if (thisMonthExpenses.length > 0) {
            const expenseByCategory = thisMonthExpenses.reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});
            const topCategory = Object.keys(expenseByCategory).reduce((a, b) => expenseByCategory[a] > expenseByCategory[b] ? a : b);
            kpiContainer.innerHTML = `<div class="kpi-badge"><span>Top spending this month: <strong>${topCategory}</strong></span></div>`;
        } else {
            kpiContainer.innerHTML = `<div class="kpi-badge"><span>No expenses recorded this month.</span></div>`;
        }
    }

    function render(newTransactionId = null) {
        let filtered = [...transactions];
        if (searchText.value.trim() !== '') {
            filtered = filtered.filter(t => t.text.toLowerCase().includes(searchText.value.toLowerCase()));
        }
        if (filterCategory.value !== 'all') {
            filtered = filtered.filter(t => t.category === filterCategory.value);
        }
        if (startDate.value) {
            filtered = filtered.filter(t => t.date && new Date(t.date) >= new Date(startDate.value));
        }
        if (endDate.value) {
            filtered = filtered.filter(t => t.date && new Date(t.date) <= new Date(endDate.value));
        }

        list.innerHTML = '';
        filtered.forEach(t => addTransactionDOM(t, t.id === newTransactionId));

        updateValues(filtered);
        updateDashboard(filtered);
        populateCategories();
        updateKPIs();
        renderBudgets();
    }

    function init() {
        if (localStorage.getItem('password_hash') || isGuestMode) {
            handlePassword();
        } else {
            handlePassword();
        }
    }

    // --- EXPORT/IMPORT ---
    function exportAsJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions));
        triggerDownload(dataStr, "transactions.json");
    }

    function exportAsCSV() {
        let csvContent = "data:text/csv;charset=utf-8,Date,Description,Category,Type,Amount\n";
        transactions.forEach(t => {
            const row = [new Date(t.date).toLocaleDateString(), t.text, t.category, t.type, t.amount].join(",");
            csvContent += row + "\n";
        });
        triggerDownload(csvContent, "transactions.csv");
    }

    function exportAsPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Transactions", 10, 10);
        let y = 20;
        transactions.forEach(t => {
            doc.text(`${new Date(t.date).toLocaleDateString()}: ${t.text} (${t.category}) - $${t.amount.toFixed(2)}`, 10, y);
            y += 10;
            if (y > 280) { // Page break
                doc.addPage();
                y = 10;
            }
        });
        doc.save("transactions.pdf");
    }

    function triggerDownload(dataStr, fileName) {
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedTransactions = JSON.parse(e.target.result);
                if (Array.isArray(importedTransactions)) {
                    transactions = importedTransactions;
                    updateLocalStorage();
                    render();
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                alert('Could not parse file. Is it a valid JSON?');
            }
        };
        reader.readAsText(file);
    }

    exportBtn.addEventListener('click', () => {
        const format = document.getElementById('export-format').value;
        switch (format) {
            case 'json': exportAsJSON(); break;
            case 'csv': exportAsCSV(); break;
            case 'pdf': exportAsPDF(); break;
        }
    });
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);


    // --- EVENT LISTENERS ---
    form.addEventListener('submit', addTransaction);
    budgetForm.addEventListener('submit', setBudget);
    [searchText, filterCategory, startDate, endDate].forEach(el => el.addEventListener('change', render));
    searchText.addEventListener('input', render);

    function toggleTheme() {
        let currentTheme = document.body.className || localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.className = newTheme;
        localStorage.setItem('theme', newTheme);
    }
    themeToggle.addEventListener('click', toggleTheme);

    const addTransactionSection = document.querySelector('.add-transaction');
    addTransactionSection.addEventListener('focusin', () => document.body.classList.add('focus-mode-active'));
    addTransactionSection.addEventListener('focusout', () => setTimeout(() => {
        if (!addTransactionSection.contains(document.activeElement)) document.body.classList.remove('focus-mode-active');
    }, 100));

    // Mini Widget Logic
    const widget = document.getElementById('mini-widget');
    const minimizeBtn = document.getElementById('minimize-widget');
    const widgetContent = document.querySelector('.widget-content');
    minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMinimized = widgetContent.style.display === 'none';
        widgetContent.style.display = isMinimized ? 'block' : 'none';
        minimizeBtn.textContent = isMinimized ? '-' : '+';
    });
    let isDragging = false, offsetX, offsetY;
    const startDrag = (e) => {
        isDragging = true;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        offsetX = clientX - widget.offsetLeft;
        offsetY = clientY - widget.offsetTop;
        widget.style.cursor = 'grabbing';
    };
    const drag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        widget.style.left = `${clientX - offsetX}px`;
        widget.style.top = `${clientY - offsetY}px`;
    };
    const stopDrag = () => { isDragging = false; widget.style.cursor = 'move'; };
    widget.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    widget.addEventListener('touchstart', startDrag, { passive: true });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    document.getElementById('save-session-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handlePassword();
    });

    document.addEventListener('keydown', e => {
        if (e.target.tagName.toLowerCase() === 'input') return;

        switch (e.key) {
            case 'n':
                e.preventDefault();
                text.focus();
                break;
            case 't':
                toggleTheme();
                break;
            case 'e':
                exportBtn.click();
                break;
            case 'i':
                importBtn.click();
                break;
        }
    });

    init();
});
