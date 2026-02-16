/**
 * ===================================================================
 * fortune-scorer.js — 통합 오행/십성 스코어링 엔진
 * ===================================================================
 * 사주원국 + 운세 기둥(대운/세운/월운)을 합산하여
 * 정확한 오행·십성 프로필을 계산한다.
 *
 * 3가지를 모두 반영:
 * 1. 사주원국 기본 오행/십성
 * 2. 운세 기둥의 오행/십성 추가/변화
 * 3. 합충(천간합, 육합, 삼합, 충, 형, 파, 해)으로 인한 변환
 *
 * OhengAnalyzer.calculateWeightedOheng()의 합충 처리 패턴을 재사용하되,
 * 운세 기둥을 추가 기둥으로 포함하여 확장한다.
 */

import {
  STEM_W, BR_W, BR_EL,
  CHEONGAN_OHENG, CHEONGAN_EUMYANG, BONGI_EUMYANG,
  STEM_COMBINE, STEM_CLASH,
  BRANCH_COMBINE, BRANCH_CLASH,
  TRIPLE_COMBINE, BANHAP_TABLE, WANGJI,
  OHENG, TEN_GODS_GROUPED
} from '../lib/sajuwiki/constants.js';

import { OhengAnalyzer, SajuCalculator } from '../lib/sajuwiki/calculator.js';

// ═══════════════════════════════════════════════════
// 운세 기둥 가중치
// ═══════════════════════════════════════════════════

/** 운세 기둥의 천간 가중치 */
const FORTUNE_STEM_W = { daeun: 12, saeun: 8, wolun: 4 };

/** 운세 기둥의 지지 가중치 */
const FORTUNE_BR_W = { daeun: 18, saeun: 12, wolun: 6 };

/**
 * 운세 ↔ 원국 상호작용 가중치
 * 월주가 가장 강하고, 일주는 월주 대비 30% 약함.
 * 년주/시주는 절반.
 */
const FORTUNE_INTERACTION_W = {
  month: 1.0,
  day: 0.77,
  year: 0.5,
  hour: 0.5
};

/**
 * 운세 합충 감쇄 계수.
 * 운세 기둥은 일시적(transient)이므로 원국 내부 합충 대비 약하게 적용.
 * 0.35 = 원국 내부 합충의 35% 강도.
 */
const FORTUNE_DAMPEN = 0.35;

// ═══════════════════════════════════════════════════
// 핵심 API
// ═══════════════════════════════════════════════════

/**
 * 원국 + 운세 기둥을 합산하여 오행/십성 프로필을 계산.
 *
 * @param {Object} natalDiscrete - SajuCalculator.calculate() 결과
 * @param {boolean} hasTime - 시간 정보 유무
 * @param {Object} [fortunePillars={}] - { daeun?: idx60, saeun?: idx60, wolun?: idx60 }
 * @returns {Object} {
 *   oheng: { raw: {목,화,토,금,수}, percent: {목,화,토,금,수} },
 *   sipsung: { raw: {비견,...,정인}, percent: {비견,...,정인}, grouped: {비겁,...,인성} },
 *   interactions: [{ type, source, target, desc }],
 *   total: number
 * }
 */
export function computeProfile(natalDiscrete, hasTime, fortunePillars = {}) {
  const natalPositions = hasTime
    ? ['hour', 'day', 'month', 'year']
    : ['day', 'month', 'year'];

  const dayStemIdx = natalDiscrete.idxs.day % 10;

  // ── Step 1: 기둥 데이터 구조화 ──

  // 원국 천간/지지
  const sd = {}, bd = {};
  for (const p of natalPositions) {
    const idx60 = natalDiscrete.idxs[p];
    const si = idx60 % 10;
    const bi = idx60 % 12;
    sd[p] = {
      si, el: CHEONGAN_OHENG[si],
      w: STEM_W[p], of: 1, tr: []
    };
    bd[p] = {
      bi, dist: BR_EL[bi],
      w: BR_W[p], of: 1, tr: [],
      yy: BONGI_EUMYANG[bi]
    };
  }

  // 운세 천간/지지
  const fortunePositions = [];
  for (const fp of ['daeun', 'saeun', 'wolun']) {
    if (fortunePillars[fp] == null) continue;
    const idx60 = fortunePillars[fp];
    const si = idx60 % 10;
    const bi = idx60 % 12;
    sd[fp] = {
      si, el: CHEONGAN_OHENG[si],
      w: FORTUNE_STEM_W[fp], of: 1, tr: []
    };
    bd[fp] = {
      bi, dist: BR_EL[bi],
      w: FORTUNE_BR_W[fp], of: 1, tr: [],
      yy: BONGI_EUMYANG[bi]
    };
    fortunePositions.push(fp);
  }

  const allPositions = [...natalPositions, ...fortunePositions];
  const interactions = [];

  // ── Step 2: 합충 검출 및 적용 ──

  // 2-1. 원국 내부 합충 (인접 쌍만)
  const natalAdj = [];
  for (let i = 0; i < natalPositions.length - 1; i++) {
    natalAdj.push([natalPositions[i], natalPositions[i + 1]]);
  }

  for (const [p1, p2] of natalAdj) {
    // 천간 합충
    for (const rel of OhengAnalyzer.checkStemPair(sd[p1].si, sd[p2].si)) {
      if (rel.type === '합') {
        const m = rel.desc.match(/합\((.)\)/);
        if (m) {
          const rf1 = OhengAnalyzer.resFactor(p1, p2, p1);
          const rf2 = OhengAnalyzer.resFactor(p1, p2, p2);
          sd[p1].tr.push({ e: m[1], f: 1/3 * rf1 });
          sd[p1].of *= (1 - 1/3 * rf1);
          sd[p2].tr.push({ e: m[1], f: 1/3 * rf2 });
          sd[p2].of *= (1 - 1/3 * rf2);
          interactions.push({ type: '천간합', source: p1, target: p2, desc: rel.desc });
        }
      } else if (rel.type === '충') {
        const rf1 = OhengAnalyzer.resFactor(p1, p2, p1);
        const rf2 = OhengAnalyzer.resFactor(p1, p2, p2);
        sd[p1].of *= (1 - 1/3 * rf1);
        sd[p2].of *= (1 - 1/3 * rf2);
        interactions.push({ type: '천간충', source: p1, target: p2, desc: '충' });
      }
    }

    // 지지 합충
    for (const rel of OhengAnalyzer.checkBranchPair(bd[p1].bi, bd[p2].bi)) {
      if (rel.type === '합') {
        const m = rel.desc.match(/합\((.)\)/);
        if (m) {
          const rf1 = OhengAnalyzer.resFactor(p1, p2, p1);
          const rf2 = OhengAnalyzer.resFactor(p1, p2, p2);
          bd[p1].tr.push({ e: m[1], f: 2/3 * rf1 });
          bd[p1].of *= (1 - 2/3 * rf1);
          bd[p2].tr.push({ e: m[1], f: 2/3 * rf2 });
          bd[p2].of *= (1 - 2/3 * rf2);
          interactions.push({ type: '지지합', source: p1, target: p2, desc: rel.desc });
        }
      } else if (rel.type === '충') {
        const rf1 = OhengAnalyzer.resFactor(p1, p2, p1);
        const rf2 = OhengAnalyzer.resFactor(p1, p2, p2);
        bd[p1].of *= (1 - 2/3 * rf1);
        bd[p2].of *= (1 - 2/3 * rf2);
        interactions.push({ type: '지지충', source: p1, target: p2, desc: '충' });
      }
    }

    // 반합
    _applyBanhap(bd, p1, p2, interactions);
  }

  // 2-2. 운세 vs 원국 합충 (FORTUNE_DAMPEN 적용)
  for (const fp of fortunePositions) {
    for (const np of natalPositions) {
      const iw = FORTUNE_INTERACTION_W[np] || 0.5;
      const damp = FORTUNE_DAMPEN;

      // 천간 합충
      for (const rel of OhengAnalyzer.checkStemPair(sd[fp].si, sd[np].si)) {
        if (rel.type === '합') {
          const m = rel.desc.match(/합\((.)\)/);
          if (m) {
            const fFortune = 1/3 * iw * damp;
            const fNatal = 1/3 * iw * damp;
            sd[fp].tr.push({ e: m[1], f: fFortune });
            sd[fp].of *= (1 - fFortune);
            sd[np].tr.push({ e: m[1], f: fNatal });
            sd[np].of *= (1 - fNatal);
            interactions.push({ type: '천간합', source: fp, target: np, desc: rel.desc });
          }
        } else if (rel.type === '충') {
          const fFortune = 1/3 * iw * damp;
          const fNatal = 1/3 * iw * damp;
          sd[fp].of *= (1 - fFortune);
          sd[np].of *= (1 - fNatal);
          interactions.push({ type: '천간충', source: fp, target: np, desc: '충' });
        }
      }

      // 지지 합충
      for (const rel of OhengAnalyzer.checkBranchPair(bd[fp].bi, bd[np].bi)) {
        if (rel.type === '합') {
          const m = rel.desc.match(/합\((.)\)/);
          if (m) {
            const fFortune = 2/3 * iw * damp;
            const fNatal = 2/3 * iw * damp;
            bd[fp].tr.push({ e: m[1], f: fFortune });
            bd[fp].of *= (1 - fFortune);
            bd[np].tr.push({ e: m[1], f: fNatal });
            bd[np].of *= (1 - fNatal);
            interactions.push({ type: '지지합', source: fp, target: np, desc: rel.desc });
          }
        } else if (rel.type === '충') {
          const fFortune = 2/3 * iw * damp;
          const fNatal = 2/3 * iw * damp;
          bd[fp].of *= (1 - fFortune);
          bd[np].of *= (1 - fNatal);
          interactions.push({ type: '지지충', source: fp, target: np, desc: '충' });
        }
      }

      // 반합
      _applyBanhapWithWeight(bd, fp, np, iw, interactions);
    }
  }

  // 2-3. 삼합 검출 (원국 + 운세 혼합)
  _applyTripleCombine(bd, allPositions, interactions, fortunePositions);

  // ── Step 3: 가중 오행 합산 ──
  const oh = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  for (const p of allPositions) {
    const s = sd[p];
    oh[s.el] += s.w * s.of;
    for (const t of s.tr) oh[t.e] += s.w * t.f;
  }

  for (const p of allPositions) {
    const b = bd[p];
    for (const { e, r } of b.dist) oh[e] += b.w * r * b.of;
    for (const t of b.tr) oh[t.e] += b.w * t.f;
  }

  const ohTotal = Object.values(oh).reduce((a, b) => a + b, 0) || 1;
  const ohPercent = {};
  for (const e of OHENG) ohPercent[e] = Math.round(oh[e] / ohTotal * 1000) / 10;

  // ── Step 4: 가중 십성 합산 ──
  const sip = { 비견: 0, 겁재: 0, 식신: 0, 상관: 0, 편재: 0, 정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0 };

  const addSipsung = (si, w) => {
    if (w <= 0) return;
    const tg = SajuCalculator.getTenGod(dayStemIdx, si);
    if (sip.hasOwnProperty(tg)) sip[tg] += w;
  };

  // 천간 십성
  for (const p of allPositions) {
    const s = sd[p];
    addSipsung(s.si, s.w * s.of);
    for (const t of s.tr) {
      addSipsung(OhengAnalyzer.el2si(t.e, CHEONGAN_EUMYANG[s.si]), s.w * t.f);
    }
  }

  // 지지 십성
  for (const p of allPositions) {
    const b = bd[p];
    for (const { e, r } of b.dist) {
      addSipsung(OhengAnalyzer.el2si(e, b.yy), b.w * r * b.of);
    }
    for (const t of b.tr) {
      addSipsung(OhengAnalyzer.el2si(t.e, b.yy), b.w * t.f);
    }
  }

  const sipTotal = Object.values(sip).reduce((a, b) => a + b, 0) || 1;
  const sipPercent = {};
  for (const k of Object.keys(sip)) sipPercent[k] = Math.round(sip[k] / sipTotal * 1000) / 10;

  // 십성 그룹별 합산
  const sipGrouped = {};
  for (const [group, members] of Object.entries(TEN_GODS_GROUPED)) {
    sipGrouped[group] = members.reduce((sum, m) => sum + (sipPercent[m] || 0), 0);
  }

  return {
    oheng: { raw: oh, percent: ohPercent },
    sipsung: { raw: sip, percent: sipPercent, grouped: sipGrouped },
    interactions,
    total: ohTotal
  };
}

// ═══════════════════════════════════════════════════
// 내부 헬퍼
// ═══════════════════════════════════════════════════

/** 반합 처리 (원국 인접 쌍) */
function _applyBanhap(bd, p1, p2, interactions) {
  const bi1 = bd[p1].bi, bi2 = bd[p2].bi;
  let el = null;
  for (const [a, b, e] of BANHAP_TABLE) {
    if ((bi1 === a && bi2 === b) || (bi1 === b && bi2 === a)) { el = e; break; }
  }
  if (!el) return;

  const isPair = (p1 === 'month' && p2 === 'year') || (p1 === 'day' && p2 === 'hour');
  let f1, f2;

  if (isPair) {
    const w1 = WANGJI.has(bi1), w2 = WANGJI.has(bi2);
    if (w1 && !w2) { f1 = 1/6; f2 = 2/3; }
    else if (!w1 && w2) { f1 = 1/3; f2 = 1/6; }
    else { f1 = 1/3; f2 = 1/3; }
  } else {
    f1 = 2/3 * OhengAnalyzer.resFactor(p1, p2, p1);
    f2 = 2/3 * OhengAnalyzer.resFactor(p1, p2, p2);
  }

  bd[p1].tr.push({ e: el, f: f1 });
  bd[p1].of *= (1 - f1);
  bd[p2].tr.push({ e: el, f: f2 });
  bd[p2].of *= (1 - f2);
  interactions.push({ type: '반합', source: p1, target: p2, desc: `반합(${el})` });
}

/** 반합 처리 (운세 vs 원국, 가중치 + 감쇄 적용) */
function _applyBanhapWithWeight(bd, fp, np, iw, interactions) {
  const bi1 = bd[fp].bi, bi2 = bd[np].bi;
  let el = null;
  for (const [a, b, e] of BANHAP_TABLE) {
    if ((bi1 === a && bi2 === b) || (bi1 === b && bi2 === a)) { el = e; break; }
  }
  if (!el) return;

  const f = 1/3 * iw * FORTUNE_DAMPEN;
  bd[fp].tr.push({ e: el, f });
  bd[fp].of *= (1 - f);
  bd[np].tr.push({ e: el, f });
  bd[np].of *= (1 - f);
  interactions.push({ type: '반합', source: fp, target: np, desc: `반합(${el})` });
}

/** 삼합 검출 (원국 + 운세 전체 지지에서 3개 조합 탐색) */
function _applyTripleCombine(bd, allPositions, interactions, fortunePositions = []) {
  const branches = allPositions.map(p => ({ pos: p, bi: bd[p].bi }));
  const fortuneSet = new Set(fortunePositions);

  for (const [a, b, c, el] of TRIPLE_COMBINE) {
    const posA = branches.filter(x => x.bi === a).map(x => x.pos);
    const posB = branches.filter(x => x.bi === b).map(x => x.pos);
    const posC = branches.filter(x => x.bi === c).map(x => x.pos);

    if (posA.length > 0 && posB.length > 0 && posC.length > 0) {
      const allTriple = [...posA, ...posB, ...posC];
      // 운세 기둥이 포함된 삼합은 감쇄 적용
      const hasFortune = allTriple.some(p => fortuneSet.has(p));
      const damp = hasFortune ? FORTUNE_DAMPEN : 1;

      for (const pos of allTriple) {
        const f = 2/3 * 0.5 * damp; // 삼합 기본 50% 강도 × 감쇄
        bd[pos].tr.push({ e: el, f });
        bd[pos].of *= (1 - f);
      }

      interactions.push({
        type: '삼합',
        source: allTriple.join('+'),
        target: null,
        desc: `삼합(${el})`
      });
    }
  }
}
