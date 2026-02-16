/**
 * app.js — Application entry point for 신(新) 만세력
 * Initializes form handling, chart orchestration, and UI bindings.
 */

import { FormHandler } from './modules/form-handler.js';
import { SingleChart } from './modules/single-chart.js';
import { GunghapModule } from './modules/gunghap-module.js';
import { BirthMoment } from './models/birth-moment.js';
import { appState } from './core/state.js';

class SinsajuApp {
  constructor() {
    this.singleChart = null;
    this.formHandler = null;
    this.gunghapModule = null;
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._setup());
    } else {
      this._setup();
    }
  }

  _setup() {
    this.singleChart = new SingleChart();
    this.gunghapModule = new GunghapModule();

    // Single person form
    this.formHandler = new FormHandler('saju-form', (data) => {
      try {
        this.singleChart.analyze(data);
      } catch (err) {
        console.error('Analysis failed:', err);
        alert('분석 중 오류가 발생했습니다: ' + err.message);
      }
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // City select → longitude sync
    const citySelect = document.getElementById('in-city');
    const lonInput = document.getElementById('in-longitude');
    if (citySelect && lonInput) {
      citySelect.addEventListener('change', () => {
        if (citySelect.value) {
          lonInput.value = citySelect.value;
        }
      });
      lonInput.addEventListener('input', () => {
        citySelect.value = '';
      });
    }

    // Gunghap button
    const gunghapBtn = document.getElementById('gunghap-btn');
    if (gunghapBtn) {
      gunghapBtn.addEventListener('click', () => this._runGunghap());
    }

    console.log('신(新) 만세력 initialized');
  }

  _switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const content = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add('active');
    if (content) content.style.display = '';
  }

  _runGunghap() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const v = el.value;
      return v !== '' ? parseInt(v) : null;
    };

    const yearA = getVal('gA-year'), monthA = getVal('gA-month'), dayA = getVal('gA-day');
    const hourA = getVal('gA-hour'), minA = getVal('gA-min') ?? 0;
    const genderA = document.querySelector('input[name="gA-gender"]:checked')?.value || 'm';

    const yearB = getVal('gB-year'), monthB = getVal('gB-month'), dayB = getVal('gB-day');
    const hourB = getVal('gB-hour'), minB = getVal('gB-min') ?? 0;
    const genderB = document.querySelector('input[name="gB-gender"]:checked')?.value || 'f';

    if (!yearA || !monthA || !dayA) {
      alert('A의 생년월일을 입력해주세요.');
      return;
    }
    if (!yearB || !monthB || !dayB) {
      alert('B의 생년월일을 입력해주세요.');
      return;
    }

    try {
      const bmA = new BirthMoment(yearA, monthA, dayA, hourA, minA, genderA);
      const bmB = new BirthMoment(yearB, monthB, dayB, hourB, minB, genderB);

      const result = this.gunghapModule.analyze(bmA, bmB);

      const resultsSection = document.getElementById('gunghap-results');
      if (resultsSection) resultsSection.style.display = '';

      this.gunghapModule.renderComparison('gunghap-display', result);
    } catch (err) {
      console.error('Gunghap analysis failed:', err);
      alert('궁합 분석 중 오류가 발생했습니다: ' + err.message);
    }
  }
}

const app = new SinsajuApp();
app.init();
