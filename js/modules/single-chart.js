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
import { generateFortuneTimeSeries } from '../core/fortune-timeseries.js';
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

    this._birthMoment = null;
    this._chartData = null;

    // Wire up mode toggle buttons for fortune timeseries chart
    this._setupTimeSeriesToggle();
  }

  _setupTimeSeriesToggle() {
    const buttons = document.querySelectorAll('.ts-mode-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        this.fortuneTimeSeriesChart.setMode(mode);
      });
    });
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

    // Continuous pillar data (shared by 천간 + 지지 waveforms)
    const cont = chartData.continuous;

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
      const natalProfile = computeProfile(chartData.discrete, hasTime, {});
      this.ohengSipsungPanel.render(natalProfile, chartData.yongsin);
    } catch (e) {
      console.warn('Oheng/Sipsung panel rendering failed:', e);
    }

    // 7. 운세 시계열 그래프
    try {
      const tsData = generateFortuneTimeSeries(
        chartData.discrete, hasTime, chartData.daeun,
        bm.year, bm.year, bm.year + 80
      );
      this.fortuneTimeSeriesChart.render(tsData, 'oheng');
      this._fortuneTimeSeriesData = tsData;
    } catch (e) {
      console.warn('Fortune timeseries rendering failed:', e);
    }

    // 8. Correction info
    this._showCorrectionInfo(correctionInfo);

    document.getElementById('results').style.display = '';
    return chartData;
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
