/**
 * single-chart.js — Orchestrator for single-person Saju analysis
 * Coordinates BirthMoment computation and all visualization renderers.
 */

import { BirthMoment } from '../models/birth-moment.js';
import { PillarDisplay } from '../viz/pillar-display.js';
import { CircularChart } from '../viz/circular-chart.js';
import { WaveformChart } from '../viz/waveform-chart.js';
import { CheonganWaveformChart } from '../viz/cheongan-waveform.js';
import { FortuneOverlayChart } from '../viz/fortune-overlay-chart.js';
import { FortuneModule } from './fortune-module.js';
import { OhengSipsungPanel } from '../viz/oheng-sipsung-panel.js';
import { FortuneTimeSeriesChart } from '../viz/fortune-timeseries-chart.js';
import { generateOhengWaves, generateToWave, generateCheonganWaves } from '../core/oheng-waves.js';
import { computeProfile } from '../core/fortune-scorer.js';
import { generateFortuneTimeSeries, generateMonthlyDetail, monthlyToChartData } from '../core/fortune-timeseries.js';
import { REF_YEAR, REF_YEAR_IDX, YUKSHIP_GAPJA } from '../lib/sajuwiki/constants.js';
import { applyLongitudeCorrection } from './longitude-correction.js';
import { appState } from '../core/state.js';

export class SingleChart {
  constructor() {
    this.pillarDisplay = new PillarDisplay('pillar-display');
    this.circularChart = new CircularChart('circular-chart');
    this.fortuneOverlayChart = new FortuneOverlayChart('fortune-overlay-chart');
    this.cheonganWaveformChart = new CheonganWaveformChart('cheongan-waveform', { width: 900, height: 380 });
    this.waveformChart = new WaveformChart('waveform-chart', { width: 900, height: 580 });
    this.fortuneModule = new FortuneModule();
    this.ohengSipsungPanel = new OhengSipsungPanel('oheng-sipsung-panel');
    this.fortuneTimeSeriesChart = new FortuneTimeSeriesChart('fortune-timeseries-chart', { width: 900, height: 400 });
    this.decadeChart = new FortuneTimeSeriesChart('fortune-decade-chart', { width: 900, height: 380 });
    this.yearChart = new FortuneTimeSeriesChart('fortune-year-chart', { width: 900, height: 380 });

    this._birthMoment = null;
    this._chartData = null;
    this._fortuneTimeSeriesData = null;
    this._tsMode = 'oheng';
    this._natalAngles = null;

    // 대운/연간 네비게이션 상태
    this._currentDecadeIdx = 0;
    this._currentYear = new Date().getFullYear();

    this._setupTimeSeriesToggle();
    this._setupDetailNav();
  }

  _setupTimeSeriesToggle() {
    const buttons = document.querySelectorAll('.ts-mode-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tsMode = btn.dataset.mode;
        this.fortuneTimeSeriesChart.setMode(this._tsMode);
        this.decadeChart.setMode(this._tsMode);
        this.yearChart.setMode(this._tsMode);
      });
    });
  }

  _setupDetailNav() {
    document.getElementById('decade-prev')?.addEventListener('click', () => {
      this._currentDecadeIdx = Math.max(0, this._currentDecadeIdx - 1);
      this._renderDecadeChart();
    });
    document.getElementById('decade-next')?.addEventListener('click', () => {
      const daeunList = this._getDaeunList();
      this._currentDecadeIdx = Math.min(daeunList.length - 1, this._currentDecadeIdx + 1);
      this._renderDecadeChart();
    });
    document.getElementById('year-prev')?.addEventListener('click', () => {
      this._currentYear--;
      this._renderYearChart();
    });
    document.getElementById('year-next')?.addEventListener('click', () => {
      this._currentYear++;
      this._renderYearChart();
    });
  }

  _getDaeunList() {
    const daeun = this._chartData?.daeun;
    return Array.isArray(daeun) ? daeun : (daeun?.list || []);
  }

  analyze(data) {
    let { year, month, day, hour, minute, gender, calendar, longitude } = data;
    const hasTime = hour !== null && hour !== undefined;

    // Lunar to solar conversion if needed
    if (calendar === 'lunar' && typeof KoreanLunarCalendar !== 'undefined') {
      const cal = new KoreanLunarCalendar();
      if (cal.setLunarDate(year, month, day, false)) {
        const solar = cal.getSolarCalendar();
        year = solar.year;
        month = solar.month;
        day = solar.day;
      }
    }

    // Apply longitude correction if time is known
    let adjYear = year, adjMonth = month, adjDay = day;
    let adjHour = hour, adjMinute = minute ?? 0;
    let correctionInfo = null;

    if (hasTime && longitude !== 127.0) {
      const corrected = applyLongitudeCorrection(year, month, day, hour, minute ?? 0, longitude);
      adjYear = corrected.year;
      adjMonth = corrected.month;
      adjDay = corrected.day;
      adjHour = corrected.hour;
      adjMinute = corrected.minute;
      correctionInfo = corrected;
    }

    const bm = new BirthMoment(adjYear, adjMonth, adjDay, adjHour, adjMinute, gender, longitude);
    this._birthMoment = bm;

    const chartData = bm.getChartData();
    this._chartData = chartData;

    appState.set('personA', data);
    appState.set('birthMomentA', bm);
    appState.set('chartDataA', chartData);
    appState.set('correctionInfo', correctionInfo);

    // 연속 각도 추출
    const cont = chartData.continuous;
    const natalAngles = cont ? {
      year: cont.year?.angle,
      month: cont.month?.angle,
      day: cont.day?.angle,
      hour: cont.hour?.angle,
    } : null;
    this._natalAngles = natalAngles;

    // 1. Pillar display (with self-pillar twelve-stage)
    this.pillarDisplay.render(chartData.discrete, hasTime);

    // 2. Circular charts (연속 + 대운/세운 오버레이)
    this.circularChart.render(chartData);

    // Fortune overlay chart (natal chart with 대운/세운 markers)
    try {
      const daeun = chartData.daeun;
      const currentYear = new Date().getFullYear();
      const saeun = bm.computeSaeun(Math.max(bm.year, currentYear - 5), currentYear + 20);
      const fortuneData = {
        daeun: Array.isArray(daeun) ? daeun : (daeun?.list || []),
        saeun: Array.isArray(saeun) ? saeun : (saeun?.list || []),
        birthYear: bm.year,
      };
      this.fortuneOverlayChart.render(chartData, fortuneData);
    } catch (e) {
      console.warn('Fortune overlay rendering failed:', e);
      this.fortuneOverlayChart.render(chartData);
    }

    // 3. 천간 오행 파형 (stem markers follow branch relative position)
    const cheonganWaveData = generateCheonganWaves(360);
    const stemData = {};
    for (const key of ['year', 'month', 'day', 'hour']) {
      const idx60 = chartData.discrete?.idxs?.[key];
      if (idx60 != null) {
        stemData[key] = { idx60, branchAngle: cont?.[key]?.angle };
      }
    }
    this.cheonganWaveformChart.render(cheonganWaveData, stemData);

    // 4. 지지 오행 파형 — all 4 pillar birth angles on one graph + 토 sub-graph
    const waveData = generateOhengWaves(360);
    const birthAngles = {
      year: cont?.year?.angle,
      month: cont?.month?.angle,
      day: cont?.day?.angle,
      hour: cont?.hour?.angle,
    };
    const toStrengths = generateToWave(360);
    this.waveformChart.render(waveData, birthAngles, toStrengths);

    // 5. Fortune timeline
    this._renderFortune(bm, chartData);

    // 6. 오행/십성 프로필
    try {
      const natalProfile = computeProfile(chartData.discrete, hasTime, {}, natalAngles);
      this.ohengSipsungPanel.render(natalProfile, chartData.yongsin);
    } catch (e) {
      console.warn('Oheng/Sipsung panel rendering failed:', e);
    }

    // 7. 운세 시계열 그래프
    try {
      const tsData = generateFortuneTimeSeries(
        chartData.discrete, hasTime, chartData.daeun,
        bm.year, bm.year, bm.year + 80, natalAngles
      );
      this.fortuneTimeSeriesChart.render(tsData, 'oheng');
      this._fortuneTimeSeriesData = tsData;

      // 현재 대운 인덱스 찾기
      const daeunList = this._getDaeunList();
      const currentAge = new Date().getFullYear() - bm.year + 1;
      this._currentDecadeIdx = 0;
      for (let i = daeunList.length - 1; i >= 0; i--) {
        const dAge = daeunList[i].age ?? daeunList[i].startAge;
        if (dAge != null && currentAge >= dAge) {
          this._currentDecadeIdx = i;
          break;
        }
      }
      this._currentYear = new Date().getFullYear();

      // 대운 10년 + 연간 12개월 차트
      this._renderDecadeChart();
      this._renderYearChart();
    } catch (e) {
      console.warn('Fortune timeseries rendering failed:', e);
    }

    // 8. Correction info
    this._showCorrectionInfo(correctionInfo);

    document.getElementById('results').style.display = '';
    return chartData;
  }

  _renderDecadeChart() {
    if (!this._fortuneTimeSeriesData || !this._birthMoment) return;
    const bm = this._birthMoment;
    const chartData = this._chartData;
    const hasTime = bm.hasTime;
    const daeunList = this._getDaeunList();
    const idx = this._currentDecadeIdx;
    if (idx < 0 || idx >= daeunList.length) return;

    const d = daeunList[idx];
    const dAge = d.age ?? d.startAge ?? 1;
    const startYear = bm.year + dAge - 1;
    const endYear = startYear + 9;
    const pillar = d.pillar || '';

    // 라벨 업데이트
    const label = document.getElementById('decade-label');
    if (label) label.textContent = `${pillar} 대운 (${dAge}~${dAge + 9}세, ${startYear}~${endYear})`;

    try {
      const decadeData = generateFortuneTimeSeries(
        chartData.discrete, hasTime, chartData.daeun,
        bm.year, startYear, endYear, this._natalAngles
      );
      this.decadeChart.render(decadeData, this._tsMode);
    } catch (e) {
      console.warn('Decade chart rendering failed:', e);
    }
  }

  _renderYearChart() {
    if (!this._birthMoment || !this._chartData) return;
    const bm = this._birthMoment;
    const chartData = this._chartData;
    const hasTime = bm.hasTime;
    const year = this._currentYear;

    // 해당 연도의 활성 대운 찾기
    const daeunList = this._getDaeunList();
    const koreanAge = year - bm.year + 1;
    let activeDaeun = null;
    for (let i = daeunList.length - 1; i >= 0; i--) {
      const dAge = daeunList[i].age ?? daeunList[i].startAge;
      if (dAge != null && koreanAge >= dAge) {
        activeDaeun = daeunList[i];
        break;
      }
    }

    // 세운 idx60
    const saeunIdx = ((REF_YEAR_IDX + (year - REF_YEAR)) % 60 + 60) % 60;
    const saeunPillar = YUKSHIP_GAPJA[saeunIdx];

    // 라벨 업데이트
    const label = document.getElementById('year-label');
    if (label) label.textContent = `${year}년 ${saeunPillar} (${koreanAge}세)`;

    try {
      const natal = this._fortuneTimeSeriesData?.natal;
      const monthlyData = generateMonthlyDetail(
        chartData.discrete, hasTime,
        activeDaeun?.idx ?? null, saeunIdx, year, this._natalAngles
      );
      const monthlyChartData = monthlyToChartData(monthlyData, natal || { oheng: { percent: {} }, sipsung: { grouped: {} } });
      this.yearChart.render(monthlyChartData, this._tsMode);
    } catch (e) {
      console.warn('Year chart rendering failed:', e);
    }
  }

  _renderFortune(bm, chartData) {
    const fortuneEl = document.getElementById('fortune-timeline');
    if (!fortuneEl) return;

    try {
      const daeun = chartData.daeun;
      const currentYear = new Date().getFullYear();
      const saeun = bm.computeSaeun(Math.max(bm.year, currentYear - 5), currentYear + 20);

      this.fortuneModule.renderTimeline(fortuneEl, {
        daeun: Array.isArray(daeun) ? daeun : (daeun?.list || []),
        saeun: Array.isArray(saeun) ? saeun : (saeun?.list || []),
        startAge: daeun?.startAge || 0,
      }, bm);
    } catch (e) {
      console.warn('Fortune rendering failed:', e);
      fortuneEl.innerHTML = '<p style="color:var(--text-dim)">대운/세운 계산 중 오류가 발생했습니다.</p>';
    }
  }

  _showCorrectionInfo(correctionInfo) {
    const el = document.getElementById('correction-info');
    if (!el) return;

    if (correctionInfo) {
      el.textContent = `경도 보정: ${correctionInfo.originalTime} → ${correctionInfo.correctedTime} (${correctionInfo.correctionMinutes > 0 ? '+' : ''}${correctionInfo.correctionMinutes}분)`;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  getBirthMoment() {
    return this._birthMoment;
  }

  getChartData() {
    return this._chartData;
  }
}
