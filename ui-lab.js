/* Interface enhancements only; use the existing simulator and chart data. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const byId = id => document.getElementById(id);
    const tabs = Array.from(document.querySelectorAll('.chart-tab'));
    const setText = (id, text) => { byId(id).textContent = text; };
    const read = id => byId(id).value;
    let activeChart = 'rank';
    const generated = { rank: false, distance: false };
    const dirty = { rank: false, distance: false };
    const lastResults = { rank: null, distance: null };
    function syncChartNote() {
      setText('labChartNote', dirty[activeChart] && generated[activeChart]
        ? '配置已修改 · 当前图表为上次结果，请重新生成分析。'
        : generated[activeChart]
          ? activeChart === 'rank' ? '模拟已完成 · 左右滚动对比武器，点击排行柱查看逐发伤害。' : '曲线已生成 · 点击图例可切换武器显示。'
          : activeChart === 'rank' ? '模拟结果受命中分布影响；点击排行柱查看逐发伤害。' : '生成曲线后，可以比较不同交战距离下的武器表现。');
    }

    function selectChart(kind) {
      activeChart = kind;
      tabs.forEach(tab => {
        const selected = tab.dataset.chart === kind;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        byId(tab.getAttribute('aria-controls')).hidden = !selected;
      });
      const chart = window.Chart?.getChart(kind === 'rank' ? 'ttkChart' : 'distanceChart');
      if (chart) requestAnimationFrame(() => chart.resize());
      syncChartNote();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectChart(tab.dataset.chart));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + 1) % tabs.length;
        selectChart(tabs[next].dataset.chart);
        tabs[next].focus();
      });
    });
    [['calcBtn', 'rank'], ['distChartBtn', 'distance']].forEach(([id, kind]) => {
      byId(id).addEventListener('click', () => {
        selectChart(kind);
      });
    });

    function syncConditions() {
      setText('labDistance', read('distance') || '—');
      const rate = Number(read('hitRate'));
      setText('labHitRate', read('hitRate') && Number.isFinite(rate) ? Math.round(rate * 100) : '—');
      setText('labHealth', read('healthValue'));
      setText('labArmor', `Lv.${read('armorLevel')} / ${read('armorValue')}`);
      setText('labHelmet', `Lv.${read('helmetLevel')} / ${read('helmetValue')}`);
      setText('labModel', byId('markovModelEnable').checked ? '马尔可夫联动模型' : '独立命中模型');
    }
    function markStale() {
      syncConditions();
      dirty.rank = dirty.distance = true;
      syncChartNote();
      if (generated.rank) {
        setText('labTopStatus', '上次模拟结果 · 待重新计算');
      }
    }
    document.querySelector('.config-sidebar').addEventListener('input', markStale);
    document.querySelector('.config-sidebar').addEventListener('change', markStale);
    byId('attachmentTable').addEventListener('change', markStale);

    const palette = ['#b9e877', '#7c9a6c', '#d8aa68', '#749ea6', '#d6e7b7'];
    if (window.Chart) {
      Chart.register({
        id: 'deltaLabPresentation',
        beforeUpdate(chart) {
          if (chart.canvas.id !== 'ttkChart') return;
          const minWidth = chart.data.labels.length ? `${Math.max(600, chart.data.labels.length * 43)}px` : '0px';
          if (chart.canvas.parentElement.style.minWidth !== minWidth) chart.canvas.parentElement.style.minWidth = minWidth;
          chart.options.plugins.datalabels.display = context => context.datasetIndex === 4 ? 'auto' : false;
          chart.data.datasets.forEach((dataset, index) => {
            dataset.backgroundColor = palette[index % palette.length];
            dataset.borderColor = palette[index % palette.length];
            dataset.borderWidth = 0;
            dataset.borderRadius = 2;
            dataset.maxBarThickness = 34;
          });
        },
        afterUpdate(chart) {
          const isRank = chart.canvas.id === 'ttkChart';
          const kind = isRank ? 'rank' : 'distance';
          const hasData = chart.data.labels?.length > 0 && chart.data.datasets?.some(dataset => dataset.data.length > 0);
          byId(`labEmpty-${kind}`).hidden = Boolean(hasData);
          if (!hasData) {
            if (isRank) {
              byId('labTopWeapons').replaceChildren();
              const placeholder = document.createElement('li');
              placeholder.className = 'lab-top-placeholder';
              placeholder.textContent = generated.rank ? '当前筛选没有结果' : '等待模拟结果';
              byId('labTopWeapons').append(placeholder);
              setText('labTopStatus', '按当前排行榜排序');
            }
            return;
          }
          generated[kind] = true;
          const results = isRank ? window.app?.lastCalcResults : window.app?.chartManager?.distanceChart?.lastResults;
          if (results && results !== lastResults[kind]) {
            lastResults[kind] = results;
            dirty[kind] = false;
          }
          if (isRank && !dirty.rank) {
            const totals = chart.data.labels.map((_, index) => chart.data.datasets.reduce((sum, ds) => sum + Number(ds.data[index] || 0), 0));
            const leaders = totals.map((time, index) => ({ time, index })).filter(item => Number.isFinite(item.time)).sort((a, b) => a.time - b.time).slice(0, 3);
            byId('labTopWeapons').replaceChildren(...leaders.map(({time, index}, rank) => {
              const row = document.createElement('li');
              const badge = document.createElement('span');
              badge.className = 'lab-top-rank';
              badge.textContent = String(rank + 1).padStart(2, '0');
              const name = document.createElement('span');
              name.className = 'lab-top-name';
              const label = chart.data.labels[index];
              name.textContent = Array.isArray(label) ? label.join(' ') : String(label);
              name.title = name.textContent;
              const value = document.createElement('b');
              value.textContent = `${Math.round(time * 1000)} ms`;
              row.append(badge, name, value);
              return row;
            }));
            setText('labTopStatus', `当前排行前 ${leaders.length} 项配置`);
          }
          syncChartNote();
        }
      });
    }

    const tableBody = byId('attachmentTable').querySelector('tbody');
    function filterArmory() {
      const query = byId('labWeaponSearch').value.trim().toLocaleLowerCase();
      const rows = Array.from(tableBody.rows);
      let visibleCount = 0;
      rows.forEach(row => {
        const name = `${row.cells[0]?.textContent || ''} ${row.cells[1]?.textContent || ''}`.toLocaleLowerCase();
        const matched = !query || name.includes(query);
        if (row.hidden === matched) row.hidden = !matched;
        if (matched && row.dataset.excluded !== '1' && row.dataset.trimExcluded !== '1') visibleCount++;
      });
      setText('labWeaponCount', `${visibleCount} 项`);
      byId('labArmoryEmpty').hidden = visibleCount !== 0;
    }
    byId('labWeaponSearch').addEventListener('input', filterArmory);
    let filterFrame;
    new MutationObserver(() => {
      cancelAnimationFrame(filterFrame);
      filterFrame = requestAnimationFrame(filterArmory);
    }).observe(tableBody, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-excluded', 'data-trim-excluded'] });
    document.querySelectorAll('.rail-link').forEach(link => link.addEventListener('click', () => {
      document.querySelectorAll('.rail-link').forEach(item => item.classList.toggle('active', item === link));
    }));
    syncConditions();
    filterArmory();
    // Existing saved settings are restored after initial table construction.
    window.addEventListener('load', syncConditions, { once: true });
    setTimeout(syncConditions, 500);
  });
})();
