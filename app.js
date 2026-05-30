'use strict';

const CATEGORY_ICONS = {
  'Makanan': '🍔',
  'Transportasi': '🚗',
  'Hiburan': '🎬',
  'Kesehatan': '🏥',
  'Belanja': '🛍️',
  'Pendidikan': '📚',
  'Lainnya': '📦',
};

const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899',
];

let transactions = JSON.parse(localStorage.getItem('bv_transactions') || '[]');
let chartInstance = null;

function formatRp(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function saveData() {
  localStorage.setItem('bv_transactions', JSON.stringify(transactions));
}

function getSortedTransactions() {
  const order = document.getElementById('sortOrder').value;
  const list = [...transactions];
  if (order === 'newest')  return list.sort((a, b) => b.id - a.id);
  if (order === 'oldest')  return list.sort((a, b) => a.id - b.id);
  if (order === 'highest') return list.sort((a, b) => b.amount - a.amount);
  if (order === 'lowest')  return list.sort((a, b) => a.amount - b.amount);
  return list;
}

function updateSummary() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const count = transactions.length;
  const max   = count ? Math.max(...transactions.map(t => t.amount)) : 0;
  const maxTx = transactions.find(t => t.amount === max);
  const avg   = count ? total / count : 0;

  document.getElementById('totalAmount').textContent = formatRp(total);
  document.getElementById('totalCount').textContent  = count + ' transaksi';
  document.getElementById('maxAmount').textContent   = formatRp(max);
  document.getElementById('maxCategory').textContent = maxTx ? maxTx.category : '—';
  document.getElementById('avgAmount').textContent   = formatRp(avg);
}

function updateChart() {
  const container = document.getElementById('chartContainer');
  const legendEl  = document.getElementById('chartLegend');

  if (!transactions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Belum ada data</p>
        <p class="empty-sub">Tambahkan transaksi untuk melihat grafik</p>
      </div>`;
    legendEl.innerHTML = '';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (!document.getElementById('bvChart')) {
    container.innerHTML = '<canvas id="bvChart" role="img" aria-label="Pie chart distribusi pengeluaran per kategori"></canvas>';
  }

  const canvas = document.getElementById('bvChart');

  if (chartInstance) {
    chartInstance.data.labels   = labels;
    chartInstance.data.datasets[0].data            = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + formatRp(ctx.parsed),
            },
          },
        },
      },
    });
  }

  legendEl.innerHTML = labels.map((lbl, i) =>
    `<span class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      ${CATEGORY_ICONS[lbl] || '📦'} ${lbl}
    </span>`
  ).join('');
}

function renderTransactions() {
  const list = getSortedTransactions();
  const el   = document.getElementById('transactionList');

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <p>Belum ada transaksi</p>
        <p class="empty-sub">Tambahkan pengeluaran pertama Anda</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(t => {
    const icon    = CATEGORY_ICONS[t.category] || '📦';
    const date    = new Date(t.id).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
    const hasBudget = t.budget > 0;
    const pct     = hasBudget ? Math.min((t.amount / t.budget) * 100, 100) : 0;
    const isOver  = hasBudget && t.amount > t.budget;
    const barHtml = hasBudget ? `
      <div class="transaction-budget-bar">
        <div class="transaction-budget-fill ${isOver ? 'over' : ''}" style="width:${pct}%"></div>
      </div>` : '';

    return `
      <div class="transaction-item" data-id="${t.id}">
        <div class="transaction-icon">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-name">${t.name}</div>
          <div class="transaction-meta">${t.category} · ${date}${hasBudget ? ` · Batas: ${formatRp(t.budget)}` : ''}</div>
          ${barHtml}
        </div>
        <div class="transaction-amount">${formatRp(t.amount)}</div>
        <button class="transaction-delete" data-id="${t.id}" aria-label="Hapus transaksi">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>`;
  }).join('');
}

function render() {
  updateSummary();
  updateChart();
  renderTransactions();
}

document.getElementById('btnAdd').addEventListener('click', () => {
  const name     = document.getElementById('itemName').value.trim();
  const amount   = parseFloat(document.getElementById('itemAmount').value);
  const category = document.getElementById('itemCategory').value;
  const budget   = parseFloat(document.getElementById('itemBudget').value) || 0;
  const warning  = document.getElementById('budgetWarning');

  if (!name || isNaN(amount) || amount <= 0 || !category) {
    alert('Nama item, jumlah, dan kategori wajib diisi.');
    return;
  }

  if (budget > 0 && amount > budget) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }

  transactions.push({ id: Date.now(), name, amount, category, budget });
  saveData();
  render();

  document.getElementById('itemName').value     = '';
  document.getElementById('itemAmount').value   = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemBudget').value   = '';
});

document.getElementById('transactionList').addEventListener('click', e => {
  const btn = e.target.closest('.transaction-delete');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  render();
});

document.getElementById('sortOrder').addEventListener('change', renderTransactions);

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Hapus semua transaksi? Tindakan ini tidak bisa dibatalkan.')) {
    transactions = [];
    saveData();
    render();
  }
});

render();