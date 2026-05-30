// === STATE ===
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let spendLimit = parseFloat(localStorage.getItem('spendLimit')) || 0;
let chart = null;

// === HELPERS ===
const formatRupiah = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const parseAmount = (str) =>
  parseFloat(str.replace(/\./g, '').replace(/,/g, '').replace(/[^0-9]/g, '')) || 0;

const formatInput = (str) => {
  const cleaned = str.replace(/[^0-9]/g, '');
  if (!cleaned) return '';
  return new Intl.NumberFormat('id-ID').format(Number(cleaned));
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// === FORMAT INPUT ON TYPE ===
document.getElementById('itemAmount').addEventListener('input', function () {
  const pos = this.selectionStart;
  this.value = formatInput(this.value);
});

document.getElementById('spendLimit').addEventListener('input', function () {
  this.value = formatInput(this.value);
});

// === SAVE & LOAD ===
const save = () => {
  localStorage.setItem('transactions', JSON.stringify(transactions));
  localStorage.setItem('spendLimit', spendLimit);
};

// === VALIDATE ===
const validate = () => {
  let valid = true;
  const name = document.getElementById('itemName').value.trim();
  const amount = document.getElementById('itemAmount').value.trim();
  const category = document.getElementById('itemCategory').value;

  document.getElementById('errName').textContent = '';
  document.getElementById('errAmount').textContent = '';
  document.getElementById('errCategory').textContent = '';
  document.getElementById('itemName').classList.remove('error');
  document.getElementById('itemAmount').classList.remove('error');
  document.getElementById('itemCategory').classList.remove('error');

  if (!name) {
    document.getElementById('errName').textContent = 'Nama item tidak boleh kosong';
    document.getElementById('itemName').classList.add('error');
    valid = false;
  }
  if (!amount || parseAmount(amount) <= 0) {
    document.getElementById('errAmount').textContent = 'Jumlah harus lebih dari 0';
    document.getElementById('itemAmount').classList.add('error');
    valid = false;
  }
  if (!category) {
    document.getElementById('errCategory').textContent = 'Pilih salah satu kategori';
    document.getElementById('itemCategory').classList.add('error');
    valid = false;
  }
  return valid;
};

// === ADD TRANSACTION ===
document.getElementById('btnAdd').addEventListener('click', () => {
  if (!validate()) return;

  const limitVal = document.getElementById('spendLimit').value.trim();
  if (limitVal) spendLimit = parseAmount(limitVal);

  const tx = {
    id: Date.now().toString(),
    name: document.getElementById('itemName').value.trim(),
    amount: parseAmount(document.getElementById('itemAmount').value),
    category: document.getElementById('itemCategory').value,
    createdAt: new Date().toISOString(),
  };

  transactions.unshift(tx);
  save();
  render();

  document.getElementById('itemName').value = '';
  document.getElementById('itemAmount').value = '';
  document.getElementById('itemCategory').value = '';
});

// === DELETE ===
const deleteTransaction = (id) => {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
};

// === SORT ===
const getSorted = () => {
  const sort = document.getElementById('sortSelect').value;
  const arr = [...transactions];
  if (sort === 'oldest') return arr.reverse();
  if (sort === 'highest') return arr.sort((a, b) => b.amount - a.amount);
  if (sort === 'lowest') return arr.sort((a, b) => a.amount - b.amount);
  if (sort === 'category') return arr.sort((a, b) => a.category.localeCompare(b.category));
  return arr; // newest (default)
};

document.getElementById('sortSelect').addEventListener('change', render);

// === RENDER TRANSACTIONS ===
const renderList = () => {
  const list = document.getElementById('txList');
  const empty = document.getElementById('txEmpty');
  const sorted = getSorted();
  const total = transactions.reduce((a, t) => a + t.amount, 0);

  if (sorted.length === 0) {
    empty.style.display = 'flex';
    list.innerHTML = '';
    list.appendChild(empty);
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = '';

  sorted.forEach(t => {
    const isOver = spendLimit > 0 && t.amount > spendLimit;
    const div = document.createElement('div');
    div.className = 'tx-item' + (isOver ? ' over-limit' : '');
    div.innerHTML = `
      <div class="tx-left">
        <span class="tx-name">${t.name}</span>
        <div class="tx-meta">
          <span class="tx-cat cat-${t.category.toLowerCase()}">${t.category}</span>
          <span class="tx-date">${formatDate(t.createdAt)}</span>
          ${isOver ? '<span style="font-size:0.7rem;color:#f59e0b;">⚠️ Melebihi batas</span>' : ''}
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount">${formatRupiah(t.amount)}</span>
        <button class="btn-delete" onclick="deleteTransaction('${t.id}')" aria-label="Hapus">🗑️</button>
      </div>
    `;
    list.appendChild(div);
  });
};

// === RENDER BALANCE ===
const renderBalance = () => {
  const total = transactions.reduce((a, t) => a + t.amount, 0);
  document.getElementById('totalBalance').textContent = formatRupiah(total);
  document.getElementById('txCount').textContent = `${transactions.length} transaksi`;

  const limitEl = document.getElementById('limitIndicator');
  if (spendLimit > 0 && total > spendLimit) {
    limitEl.style.display = 'inline';
  } else {
    limitEl.style.display = 'none';
  }
};

// === RENDER CHART ===
const renderChart = () => {
  const ctx = document.getElementById('pieChart').getContext('2d');
  const emptyEl = document.getElementById('chartEmpty');

  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(t => { if (totals[t.category] !== undefined) totals[t.category] += t.amount; });

  const labels = Object.keys(totals).filter(k => totals[k] > 0);
  const data = labels.map(k => totals[k]);

  if (data.length === 0) {
    emptyEl.style.display = 'block';
    document.getElementById('pieChart').style.display = 'none';
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  emptyEl.style.display = 'none';
  document.getElementById('pieChart').style.display = 'block';

  const colors = { Food: '#f97316', Transport: '#8b5cf6', Fun: '#ec4899' };

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(l => colors[l]),
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#1a1d2e',
            font: { family: 'DM Sans', size: 12 },
            padding: 16,
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatRupiah(ctx.raw)}`
          }
        }
      }
    }
  });
};

// === RENDER ALL ===
const render = () => {
  renderBalance();
  renderList();
  renderChart();
};

// === DARK MODE ===
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.querySelector('.theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeToggle.querySelector('.theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
  render(); // re-render chart with correct colors
});

// === INIT ===
render();
