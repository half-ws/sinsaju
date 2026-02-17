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
 * 3. 합충으로 인한 변환
 *
 * 충(衝) 모델:
 *   충은 특정 오행을 약화시키는 게 아니라 에너지를 교란시킨다.
 *   충하는 오행은 독립적으로 행동하여 통관(흐름) 보너스를 잃는다.
 *   통관/억부가 있으면 교란이 흡수되어 거의 영향 없고,
 *   없으면 모든 능력치가 아주 약간 내려간다.
 */

import {
  STEM_W, BR_W, BR_EL,
  CHEONGAN_OHENG, CHEONGAN_EUMYANG, BONGI_EUMYANG,
  JIJI_OHENG,
  STEM_COMBINE, STEM_CLASH,
  BRANCH_COMBINE, BRANCH_CLASH,
  TRIPLE_COMBINE, BANHAP_TABLE, WANGJI,
  OHENG, TEN_GODS_GROUPED
} from '../lib/sajuwiki/constants.js';

import { OhengAnalyzer, SajuCalculator } from '../lib/sajuwiki/calculator.js';
import { ohengStrengthAtAngle } from './trig-engine.js';

// ═══════════════════════════════════════════════════
// 운세 기둥 가중치
// ═══════════════════════════════════════════════════

const FORTUNE_STEM_W = { daeun: 12, saeun: 8, wolun: 4 };
const FORTUNE_BR_W = { daeun: 18, saeun: 12, wolun: 6 };

/**
 * 운세 ↔ 원국 상호작용 가중치
 * 월주 > 일주(30% 약함) > 년주/시주(절반)
 */
const FORTUNE_INTERACTION_W = {
  month: 1.0,
  day: 0.77,
  year: 0.5,
  hour: 0.5
};

/** 운세 합(合) 감쇄 계수 (합의 원소 변환에만 적용) */
const FORTUNE_DAMPEN = 0.35;

// ═══════════════════════════════════════════════════
// 충(衝) 교란 모델 상수
// ═══════════════════════════════════════════════════

/**
 * 통관 맵: 충하는 두 오행 사이를 중재하는 오행.
 * 상생 순환(목→화→토→금→수→목)에서 A→C→B 경로의 C.
 */
const TONGGWAN_MAP = {
  '수화': '목', '화수': '목',   // 자오충, 사해충
  '목금': '수', '금목': '수',   // 인신충, 묘유충
  '화금': '토', '금화': '토',   // 천간 병경충 등
  '목토': '화', '토목': '화',   // 천간 갑무 등
  '토수': '금', '수토': '금',   // 천간 무임 등
};

/**
 * 충 1건당 기본 교란값.
 * 충의 영향은 아주 미미함 — 통관/억부 없어도 전체 2~3% 수준.
 */
const CLASH_BASE_DISRUPTION = 0.012;

/** 교란 최대 캡 (아무리 충이 많아도 이 이상은 안 감소) */
const DISRUPTION_CAP = 0.04;

/** 통관 오행이 존재할 때 교란 흡수율 */
const TONGGWAN_ABSORB = 0.75;

/** 신강일 때 추가 교란 흡수율 */
const EOKBU_ABSORB = 0.25;

// ═══════════════════════════════════════════════════
// 연속 각도 → 오행 분포 변환
// ═══════════════════════════════════════════════════

/**
 * 연속 각도 → BR_EL 호환 분포 배열로 변환.
 * ohengStrengthAtAngle() 결과를 [{e, r}, ...] 형태로 정규화.
 */
function _angleToDist(angle) {
  const raw = ohengStrengthAtAngle(angle);
  const total = OHENG.reduce((s, e) => s + raw[e], 0) || 1;
  return OHENG.filter(e => raw[e] > 0).map(e => ({ e, r: raw[e] / total }));
}

// ═══════════════════════════════════════════════════
// 핵심 API
// ═══════════════════════════════════════════════════

/**
 * 원국 + 운세 기둥을 합산하여 오행/십성 프로필을 계산.
 *
 * @param {Object} natalDiscrete - SajuCalculator.calculate() 결과
 * @param {boolean} hasTime - 시간 정보 유무
 * @param {Object} [fortunePillars={}] - { daeun?: idx60, saeun?: idx60, wolun?: idx60 }
 * @param {Object|null} [natalAngles=null] - { year, month, day, hour } 각 기둥의 연속 각도. null이면 이산 방식 유지.
 * @returns {Object} {
 *   oheng: { raw, percent },
 *   sipsung: { raw, percent, grouped },
 *   interactions: [{ type, source, target, desc }],
 *   total: number
 * }
 */
export function computeProfile(natalDiscrete, hasTime, fortunePillars = {}, natalAngles = null) {
  const natalPositions = hasTime
    ? ['hour', 'day', 'month', 'year']
    : ['day', 'month', 'year'];

  const dayStemIdx = natalDiscrete.idxs.day % 10;

  // ── Step 1: 기둥 데이터 구조화 ──

  const sd = {}, bd = {};
  for (const p of natalPositions) {
    const idx60 = natalDiscrete.idxs[p];
    const si = idx60 % 10;
    const bi = idx60 % 12;
    sd[p] = { si, el: CHEONGAN_OHENG[si], w: STEM_W[p], of: 1, tr: [] };
    const dist = (natalAngles && natalAngles[p] != null)
      ? _angleToDist(natalAngles[p])
      : BR_EL[bi];
    bd[p] = { bi, dist, w: BR_W[p], of: 1, tr: [], yy: BONGI_EUMYANG[bi] };
  }

  const fortunePositions = [];
  for (const fp of ['daeun', 'saeun', 'wolun']) {
    if (fortunePillars[fp] == null) continue;
    const idx60 = fortunePillars[fp];
    const si = idx60 % 10;
    const bi = idx60 % 12;
    sd[fp] = { si, el: CHEONGAN_OHENG[si], w: FORTUNE_STEM_W[fp], of: 1, tr: [] };
    const fortuneAngle = bi * 30;  // 지지 중심각
    bd[fp] = { bi, dist: _angleToDist(fortuneAngle), w: FORTUNE_BR_W[fp], of: 1, tr: [], yy: BONGI_EUMYANG[bi] };
    fortunePositions.push(fp);
  }

  const allPositions = [...natalPositions, ...fortunePositions];
  const interactions = [];
  const clashEvents = []; // 충 교란 이벤트 수집

  // 이미 합(合)된 위치 추적 — 합된 간지는 운세에서 추가 합 불가
  const combinedStems = new Set();
  const combinedBranches = new Set();

  // ── Step 2: 합충 검출 ──

  // 2-1. 원국 내부 (인접 쌍)
  const natalAdj = [];
  for (let i = 0; i < natalPositions.length - 1; i++) {
    natalAdj.push([natalPositions[i], natalPositions[i + 1]]);
  }

  for (const [p1, p2] of natalAdj) {
    // 천간
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
          combinedStems.add(p1);
          combinedStems.add(p2);
          interactions.push({ type: '천간합', source: p1, target: p2, desc: rel.desc });
        }
      } else if (rel.type === '충') {
        const elA = sd[p1].el, elB = sd[p2].el;
        clashEvents.push({ elA, elB, weight: 1.0 });
        interactions.push({ type: '천간충', source: p1, target: p2, desc: '충' });
      }
    }

    // 지지
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
          combinedBranches.add(p1);
          combinedBranches.add(p2);
          interactions.push({ type: '지지합', source: p1, target: p2, desc: rel.desc });
        }
      } else if (rel.type === '충') {
        const elA = JIJI_OHENG[bd[p1].bi], elB = JIJI_OHENG[bd[p2].bi];
        clashEvents.push({ elA, elB, weight: 1.0 });
        interactions.push({ type: '지지충', source: p1, target: p2, desc: '충' });
      }
    }

    // 반합
    _applyBanhap(bd, p1, p2, interactions);
  }

  // 2-2. 운세 vs 원국 (이미 합된 원국 위치는 추가 합 스킵)
  for (const fp of fortunePositions) {
    for (const np of natalPositions) {
      const iw = FORTUNE_INTERACTION_W[np] || 0.5;
      const damp = FORTUNE_DAMPEN;

      // 천간 — 이미 합된 원국 천간은 스킵
      if (!combinedStems.has(np)) {
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
            const elA = sd[fp].el, elB = sd[np].el;
            clashEvents.push({ elA, elB, weight: iw * FORTUNE_DAMPEN });
            interactions.push({ type: '천간충', source: fp, target: np, desc: '충' });
          }
        }
      }

      // 지지 — 이미 합된 원국 지지는 스킵
      if (!combinedBranches.has(np)) {
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
            const elA = JIJI_OHENG[bd[fp].bi], elB = JIJI_OHENG[bd[np].bi];
            clashEvents.push({ elA, elB, weight: iw * FORTUNE_DAMPEN });
            interactions.push({ type: '지지충', source: fp, target: np, desc: '충' });
          }
        }
      }

      // 반합 — 이미 합된 원국 지지는 스킵
      if (!combinedBranches.has(np)) {
        _applyBanhapWithWeight(bd, fp, np, iw, interactions);
      }
    }
  }

  // 2-3. 삼합 검출
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

  // ── Step 3.5: 충 교란 적용 (통관/억부 체크 후 전체 미세 감소) ──
  if (clashEvents.length > 0) {
    const disruptionPenalty = _computeDisruption(clashEvents, oh, dayStemIdx);
    if (disruptionPenalty > 0) {
      for (const e of OHENG) oh[e] *= (1 - disruptionPenalty);
    }
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

  for (const p of allPositions) {
    const s = sd[p];
    addSipsung(s.si, s.w * s.of);
    for (const t of s.tr) {
      addSipsung(OhengAnalyzer.el2si(t.e, CHEONGAN_EUMYANG[s.si]), s.w * t.f);
    }
  }

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
// 충 교란 계산
// ═══════════════════════════════════════════════════

/**
 * 충 이벤트들로부터 최종 교란 패널티를 계산.
 * 통관 오행 존재 → 교란 75% 흡수, 신강 → 추가 25% 흡수.
 * 결과는 최대 4%로 캡.
 */
function _computeDisruption(clashEvents, oh, dayStemIdx) {
  const ohTotal = Object.values(oh).reduce((a, b) => a + b, 0) || 1;

  let rawDisruption = 0;

  for (const clash of clashEvents) {
    let d = CLASH_BASE_DISRUPTION * clash.weight;

    // 통관 체크: 충하는 두 오행 사이의 중재 오행이 원국에 있는지
    const bridgeEl = TONGGWAN_MAP[clash.elA + clash.elB];
    if (bridgeEl && oh[bridgeEl] / ohTotal > 0.10) {
      // 통관 오행이 전체의 10% 이상 → 교란 대부분 흡수
      d *= (1 - TONGGWAN_ABSORB);
    }

    // 토-토 충 (축미, 진술)은 더 약함
    if (clash.elA === '토' && clash.elB === '토') {
      d *= 0.5;
    }

    rawDisruption += d;
  }

  // 억부 체크: 일간 오행이 강하면 추가 흡수
  const dayMasterEl = CHEONGAN_OHENG[dayStemIdx];
  if (oh[dayMasterEl] / ohTotal > 0.25) {
    rawDisruption *= (1 - EOKBU_ABSORB);
  }

  return Math.min(rawDisruption, DISRUPTION_CAP);
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

/** 반합 처리 (운세 vs 원국, 감쇄 적용) */
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

/** 삼합 검출 (원국 + 운세 혼합) */
function _applyTripleCombine(bd, allPositions, interactions, fortunePositions = []) {
  const branches = allPositions.map(p => ({ pos: p, bi: bd[p].bi }));
  const fortuneSet = new Set(fortunePositions);

  for (const [a, b, c, el] of TRIPLE_COMBINE) {
    const posA = branches.filter(x => x.bi === a).map(x => x.pos);
    const posB = branches.filter(x => x.bi === b).map(x => x.pos);
    const posC = branches.filter(x => x.bi === c).map(x => x.pos);

    if (posA.length > 0 && posB.length > 0 && posC.length > 0) {
      const allTriple = [...posA, ...posB, ...posC];
      const hasFortune = allTriple.some(p => fortuneSet.has(p));
      const damp = hasFortune ? FORTUNE_DAMPEN : 1;

      for (const pos of allTriple) {
        const f = 2/3 * 0.5 * damp;
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
