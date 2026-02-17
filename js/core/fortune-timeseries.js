/**
 * ===================================================================
 * fortune-timeseries.js — 운세 시계열 데이터 생성기
 * ===================================================================
 * 매년(또는 매월) 오행/십성 프로필을 계산하여 시계열 데이터를 생성한다.
 * 각 시점에서 활성 대운 + 세운 (+ 월운)을 반영한 통합 프로필을 산출.
 */

import { computeProfile } from './fortune-scorer.js';
import { REF_YEAR, REF_YEAR_IDX, YUKSHIP_GAPJA, OHENG } from '../lib/sajuwiki/constants.js';
import { WolunCalculator } from '../lib/sajuwiki/calculator.js';

// ═══════════════════════════════════════════════════
// 대운 연속 각도 계산
// ═══════════════════════════════════════════════════

/**
 * 대운 연속 각도를 계산한다.
 *
 * 10년 주기 내에서 해당 지지의 30° 호를 따라 선형 진행:
 *   시작(0/10): 이전 지지 경계 → 중간(5/10): 지지 중심 → 끝(10/10): 다음 지지 경계
 *
 * 순행(forward): 각도 증가 방향으로 이동
 * 역행(backward): 각도 감소 방향으로 이동
 *
 * @param {number} koreanAge - 현재 한국 나이
 * @param {Object} activeDaeun - 활성 대운 { idx, age, ... }
 * @param {boolean} forward - 순행(true) / 역행(false)
 * @returns {number} 연속 각도 (0-360)
 */
export function computeDaeunAngle(koreanAge, activeDaeun, forward) {
  const bi = activeDaeun.idx % 12;
  const center = bi * 30;
  const dAge = activeDaeun.age ?? activeDaeun.startAge ?? 1;
  const fraction = Math.max(0, Math.min(1, (koreanAge - dAge) / 10));
  const dir = forward ? 1 : -1;
  const angle = center + (fraction - 0.5) * 30 * dir;
  return ((angle % 360) + 360) % 360;
}

/**
 * 연도별 시계열 데이터를 생성한다.
 *
 * @param {Object} natalDiscrete - SajuCalculator.calculate() 결과
 * @param {boolean} hasTime - 시간 정보 유무
 * @param {Object} daeunData - DaeunCalculator.calculate() 결과
 *   { list: [{idx, age, calYear, ...}], startAge, startYear, forward }
 * @param {number} birthYear - 출생 연도
 * @param {number} startYear - 시작 연도
 * @param {number} endYear - 종료 연도
 * @returns {Object} {
 *   natal: { oheng, sipsung },
 *   yearly: [{ year, age, daeun, saeun, oheng, sipsung, interactions, delta }],
 *   daeunBoundaries: [{ year, pillar, idx }]
 * }
 */
export function generateFortuneTimeSeries(
  natalDiscrete, hasTime, daeunData, birthYear, startYear, endYear, natalAngles = null
) {
  // 원국 기준선 (운세 없이 순수 원국만)
  const natal = computeProfile(natalDiscrete, hasTime, {}, natalAngles);

  // 대운 리스트 정리
  const daeunList = Array.isArray(daeunData) ? daeunData : (daeunData?.list || []);
  const daeunStartAge = daeunData?.startAge || (daeunList[0]?.age ?? 1);
  const forward = daeunData?.forward ?? true;

  // 대운 경계 연도 목록
  const daeunBoundaries = daeunList.map(d => ({
    year: d.calYear || (birthYear + d.age - 1),
    pillar: d.pillar || YUKSHIP_GAPJA[d.idx],
    idx: d.idx
  }));

  const yearly = [];

  for (let year = startYear; year <= endYear; year++) {
    const koreanAge = year - birthYear + 1;

    // 활성 대운 찾기
    let activeDaeun = null;
    for (let i = daeunList.length - 1; i >= 0; i--) {
      const dAge = daeunList[i].age ?? daeunList[i].startAge;
      if (dAge != null && koreanAge >= dAge) {
        activeDaeun = daeunList[i];
        break;
      }
    }

    // 세운 idx60 계산
    const saeunIdx = ((REF_YEAR_IDX + (year - REF_YEAR)) % 60 + 60) % 60;

    // 통합 프로필 계산
    const fortunePillars = {};
    const fortuneAngles = {};
    if (activeDaeun) {
      fortunePillars.daeun = activeDaeun.idx;
      fortuneAngles.daeun = computeDaeunAngle(koreanAge, activeDaeun, forward);
    }
    fortunePillars.saeun = saeunIdx;

    const profile = computeProfile(natalDiscrete, hasTime, fortunePillars, natalAngles, fortuneAngles);

    // 원국 대비 변화량
    const delta = { oheng: {}, sipsung: {} };
    for (const e of OHENG) {
      delta.oheng[e] = Math.round((profile.oheng.percent[e] - natal.oheng.percent[e]) * 10) / 10;
    }
    for (const g of Object.keys(natal.sipsung.grouped)) {
      delta.sipsung[g] = Math.round(((profile.sipsung.grouped[g] || 0) - (natal.sipsung.grouped[g] || 0)) * 10) / 10;
    }

    yearly.push({
      year,
      age: koreanAge,
      daeun: activeDaeun ? {
        idx: activeDaeun.idx,
        pillar: activeDaeun.pillar || YUKSHIP_GAPJA[activeDaeun.idx]
      } : null,
      saeun: {
        idx: saeunIdx,
        pillar: YUKSHIP_GAPJA[saeunIdx]
      },
      oheng: profile.oheng,
      sipsung: profile.sipsung,
      interactions: profile.interactions,
      delta
    });
  }

  return { natal, yearly, daeunBoundaries };
}

/**
 * 특정 연도의 월별 상세 데이터.
 * 월운까지 포함한 12개월 시계열.
 *
 * @param {Object} natalDiscrete
 * @param {boolean} hasTime
 * @param {number|null} daeunIdx - 활성 대운 idx60
 * @param {number} saeunIdx - 세운 idx60
 * @param {number} targetYear
 * @param {Object|null} [natalAngles=null]
 * @param {number|null} [daeunAngle=null] - 대운 연속 각도. null이면 지지 중심각 사용.
 * @returns {Array<{ monthNum, pillar, oheng, sipsung, interactions, delta }>}
 */
export function generateMonthlyDetail(
  natalDiscrete, hasTime, daeunIdx, saeunIdx, targetYear, natalAngles = null, daeunAngle = null
) {
  const natal = computeProfile(natalDiscrete, hasTime, {}, natalAngles);
  const wolunList = WolunCalculator.calculate(natalDiscrete, targetYear);
  const monthly = [];

  for (const wol of wolunList) {
    const fortunePillars = { saeun: saeunIdx, wolun: wol.idx };
    const fortuneAngles = {};
    if (daeunIdx != null) {
      fortunePillars.daeun = daeunIdx;
      if (daeunAngle != null) fortuneAngles.daeun = daeunAngle;
    }

    const profile = computeProfile(natalDiscrete, hasTime, fortunePillars, natalAngles, fortuneAngles);

    const delta = { oheng: {}, sipsung: {} };
    for (const e of OHENG) {
      delta.oheng[e] = Math.round((profile.oheng.percent[e] - natal.oheng.percent[e]) * 10) / 10;
    }
    for (const g of Object.keys(natal.sipsung.grouped)) {
      delta.sipsung[g] = Math.round(((profile.sipsung.grouped[g] || 0) - (natal.sipsung.grouped[g] || 0)) * 10) / 10;
    }

    monthly.push({
      monthNum: wol.monthNum,
      termName: wol.termName,
      pillar: wol.pillar,
      oheng: profile.oheng,
      sipsung: profile.sipsung,
      interactions: profile.interactions,
      delta
    });
  }

  return monthly;
}

/**
 * 월별 데이터를 시계열 차트 공통 포맷으로 변환.
 * FortuneTimeSeriesChart.render()에 그대로 전달 가능.
 */
export function monthlyToChartData(monthlyData, natal) {
  return {
    natal: { oheng: natal.oheng, sipsung: natal.sipsung },
    yearly: monthlyData.map(m => ({
      year: m.monthNum,
      age: m.monthNum,
      daeun: null,
      saeun: { pillar: m.pillar },
      oheng: m.oheng,
      sipsung: m.sipsung,
      interactions: m.interactions,
      delta: m.delta,
      _monthLabel: `${m.monthNum}월 (${m.termName})`,
    })),
    daeunBoundaries: [],
    _isMonthly: true,
  };
}
