(() => {
  'use strict';

  const canvas = document.getElementById('adminSalesChart');
  if (!canvas || typeof window.Chart !== 'function') return;

  let rawPoints = [];
  try {
    rawPoints = JSON.parse(canvas.dataset.chart || '[]');
  } catch (_) {
    rawPoints = [];
  }

  const valueByDate = new Map(
    rawPoints.map((item) => [String(item._id), {
      total: Number(item.total || 0),
      count: Number(item.count || 0)
    }])
  );

  const jakartaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const [year, month, day] = jakartaToday.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, month - 1, day));

  const labels = [];
  const revenue = [];
  const orders = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const point = valueByDate.get(key) || { total: 0, count: 0 };
    labels.push(new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date));
    revenue.push(point.total);
    orders.push(point.count);
  }

  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.30)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.02)');

  const rupiah = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(Number(value || 0));

  new window.Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Pendapatan',
          data: revenue,
          yAxisID: 'revenue',
          borderColor: '#4f46e5',
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#4f46e5',
          pointBorderWidth: 2,
          tension: 0.35,
          fill: true,
          order: 1
        },
        {
          type: 'bar',
          label: 'Transaksi',
          data: orders,
          yAxisID: 'orders',
          backgroundColor: 'rgba(15, 23, 42, 0.12)',
          hoverBackgroundColor: 'rgba(15, 23, 42, 0.24)',
          borderRadius: 7,
          borderSkipped: false,
          maxBarThickness: 16,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 650 },
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (ctx) => ctx.dataset.yAxisID === 'revenue'
              ? ` Pendapatan: ${rupiah(ctx.raw)}`
              : ` Transaksi: ${ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#98a2b3', maxTicksLimit: 8, maxRotation: 0, font: { size: 11 } }
        },
        revenue: {
          position: 'left',
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.16)' },
          border: { display: false },
          ticks: {
            color: '#98a2b3',
            maxTicksLimit: 6,
            callback: (value) => {
              const number = Number(value || 0);
              if (number >= 1000000) return `Rp${(number / 1000000).toFixed(number % 1000000 ? 1 : 0)}jt`;
              if (number >= 1000) return `Rp${Math.round(number / 1000)}rb`;
              return `Rp${number}`;
            }
          }
        },
        orders: {
          position: 'right',
          beginAtZero: true,
          suggestedMax: Math.max(3, ...orders),
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { display: false, precision: 0 }
        }
      }
    }
  });
})();
