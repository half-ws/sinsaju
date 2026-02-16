/**
 * 연세사주 - 궁합 헬퍼 함수/상수
 * gunghap.js에서 분리된 공통 상수 및 유틸리티 함수
 */

import {
  THRESHOLDS, CHEONGAN, JIJI, CHEONGAN_OHENG, JIJI_OHENG,
  CHEONGAN_HANJA, JIJI_HANJA, CHEONGAN_EUMYANG, JIJI_EUMYANG,
  TEN_GODS, YUKSHIP_GAPJA,
  BR_EL, GAPJA_INDEX_MAP, REF_DATE, REF_DAY_IDX, REF_YEAR, REF_YEAR_IDX
} from './constants.js';
import { SajuCalculator, OhengAnalyzer, YongsinAnalyzer } from './calculator.js';

// 오행 인덱스 맵
const OHENG_IDX = { 목: 0, 화: 1, 토: 2, 금: 3, 수: 4 };
const STEM_OHENG_IDX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // 천간→오행idx

// ═══════════════════════════════════════════════════
// 헬퍼 함수들
// ═══════════════════════════════════════════════════

/**
 * 삼합 반합 체크 (2지지)
 */
function checkSamhapHalf(b1, b2) {
  const tbl = [
    [2, 6, '화'], [6, 10, '화'],   // 인오술 화국
    [5, 9, '금'], [9, 1, '금'],    // 사유축 금국
    [8, 0, '수'], [0, 4, '수'],    // 신자진 수국
    [11, 3, '목'], [3, 7, '목']    // 해묘미 목국
  ];
  for (const [a, b, el] of tbl) {
    if ((b1 === a && b2 === b) || (b1 === b && b2 === a)) {
      return { ok: true, el, desc: `${JIJI[b1]}${JIJI_HANJA[b1]}${JIJI[b2]}${JIJI_HANJA[b2]}반합(${el})` };
    }
  }
  return { ok: false };
}

/**
 * 완전 삼합 체크 (3지지 이상)
 */
function checkSamhapFull(branches) {
  const s = new Set(branches);
  const tbl = [
    [2, 6, 10, '화'],  // 인오술
    [5, 9, 1, '금'],   // 사유축
    [8, 0, 4, '수'],   // 신자진
    [11, 3, 7, '목']   // 해묘미
  ];
  for (const [a, b, c, el] of tbl) {
    if (s.has(a) && s.has(b) && s.has(c)) {
      return { ok: true, el };
    }
  }
  return { ok: false };
}

/**
 * 완전 방합 체크 (3지지)
 */
function checkBanghapFull(branches) {
  const s = new Set(branches);
  const tbl = [
    [2, 3, 4, '목'],   // 인묘진 - 동방합
    [5, 6, 7, '화'],   // 사오미 - 남방합
    [8, 9, 10, '금'],  // 신유술 - 서방합
    [11, 0, 1, '수']   // 해자축 - 북방합
  ];
  for (const [a, b, c, el] of tbl) {
    if (s.has(a) && s.has(b) && s.has(c)) {
      return { ok: true, el };
    }
  }
  return { ok: false };
}

/**
 * 삼형 체크 (3자)
 */
function checkSamhyung(branches) {
  const s = new Set(branches);
  if (s.has(2) && s.has(5) && s.has(8)) return { ok: true, name: '무은지형(인사신)' };
  if (s.has(1) && s.has(10) && s.has(7)) return { ok: true, name: '은혜지형(축술미)' };
  if (s.has(0) && s.has(3)) return { ok: true, name: '무례지형(자묘)' };
  return { ok: false };
}

/**
 * 십신 계산 (원본 tenGod 함수)
 */
function tenGod(dsi, tsi) {
  return SajuCalculator.getTenGod(dsi, tsi);
}

/**
 * 12운성 계산
 */
function twelveStage(stemIdx, branchIdx) {
  return SajuCalculator.getTwelveStage(stemIdx, branchIdx);
}

/**
 * 사주 개인 정보 파생
 */
function derivePersonInfo(r, hasTime, ys) {
  const poss = hasTime ? ['hour', 'day', 'month', 'year'] : ['day', 'month', 'year'];
  const stems = poss.map(p => r.idxs[p] % 10);
  const branches = poss.map(p => r.idxs[p] % 12);
  const dsi = r.idxs.day % 10;
  const dayElement = Math.floor(dsi / 2); // 일간 오행 인덱스

  // 오행 퍼센트 - 전문 만세력과 동일한 가중치 계산 사용
  const weighted = OhengAnalyzer.calculateWeightedOheng(r, hasTime);
  const oh = weighted.percent || { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };
  const en = ['목', '화', '토', '금', '수'];
  const sorted = en.slice().sort((a, b) => oh[b] - oh[a]);
  const balda = en.filter(e => oh[e] >= 30);
  if (!balda.length) balda.push(sorted[0]);
  const bujokList = en.filter(e => oh[e] <= 13);
  const bujok = bujokList.length ? bujokList[bujokList.length - 1] : sorted[sorted.length - 1];

  // 십성 그룹별 퍼센트 계산 (오행 기반)
  // 비겁: 일간 오행, 식상: 생하는 오행, 재성: 극하는 오행, 관성: 극받는 오행, 인성: 생받는 오행
  const 생 = [1, 2, 3, 4, 0]; // 목→화, 화→토, 토→금, 금→수, 수→목
  const 극 = [2, 3, 4, 0, 1]; // 목→토, 화→금, 토→수, 금→목, 수→화
  const 역생 = [4, 0, 1, 2, 3]; // 수→목, 목→화...
  const 역극 = [3, 4, 0, 1, 2]; // 금→목, 수→화...

  const tsGroup = {
    비겁: oh[en[dayElement]] || 0,
    식상: oh[en[생[dayElement]]] || 0,
    재성: oh[en[극[dayElement]]] || 0,
    관성: oh[en[역극[dayElement]]] || 0,
    인성: oh[en[역생[dayElement]]] || 0
  };

  // 발달 십성 그룹 (가장 높은 그룹)
  const tsSorted = Object.entries(tsGroup).sort((a, b) => b[1] - a[1]);
  const baldaSS = tsSorted[0][0];

  // 애착 유형 계산
  const attachmentResult = calculateAttachmentType(tsGroup, bujokList, en, dayElement, 생, 극, 역생, 역극);

  // 원국 내 육합
  const wonkukYukap = [];
  const 육합tbl = [[0, 1, '토'], [2, 11, '목'], [3, 10, '화'], [4, 9, '금'], [5, 8, '수']];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      for (const [a, b] of 육합tbl) {
        if ((branches[i] === a && branches[j] === b) || (branches[i] === b && branches[j] === a)) {
          wonkukYukap.push([branches[i], branches[j]]);
        }
      }
    }
  }

  // 원국 내 삼합
  const wonkukSamhap = [];
  const 삼합tbl = [[2, 6, 10, '화'], [5, 9, 1, '금'], [8, 0, 4, '수'], [11, 3, 7, '목']];
  if (branches.length >= 3) {
    for (let i = 0; i < branches.length - 2; i++) {
      for (let j = i + 1; j < branches.length - 1; j++) {
        for (let k = j + 1; k < branches.length; k++) {
          const tb = [branches[i], branches[j], branches[k]];
          const ts = new Set(tb);
          for (const [a, b, c] of 삼합tbl) {
            if (ts.has(a) && ts.has(b) && ts.has(c)) wonkukSamhap.push(tb);
          }
        }
      }
    }
  }

  // 12운성
  const woljiUS = twelveStage(dsi, r.idxs.month % 12);
  const iljiUS = twelveStage(dsi, r.idxs.day % 12);

  return {
    poss, stems, branches, balda, bujok, bujokList, baldaSS, tsGroup,
    attachmentType: attachmentResult.type,
    attachmentSubType: attachmentResult.subType,
    wonkukYukap, wonkukSamhap, woljiUS, iljiUS,
    용신: ys.용신,
    yongsin: [ys.용신]
  };
}

/**
 * 애착 유형 계산
 * - 회피형: 재성/관성 중 하나가 20% 넘고, 인성/식상 둘 다 부족
 * - 불안형: 인성/식상 중 하나가 20% 넘고, 재성/관성 둘 다 부족
 * - 안정형: 부족 오행 없음 (오행 구족)
 * - 해당 사항 없음: 위 3개 외
 */
function calculateAttachmentType(tsGroup, bujokList, en, dayElement, 생, 극, 역생, 역극) {
  const 재성 = tsGroup.재성;
  const 관성 = tsGroup.관성;
  const 인성 = tsGroup.인성;
  const 식상 = tsGroup.식상;

  // 인성/식상에 해당하는 오행이 부족 오행인지 확인
  const 인성오행 = en[역생[dayElement]];
  const 식상오행 = en[생[dayElement]];
  const 재성오행 = en[극[dayElement]];
  const 관성오행 = en[역극[dayElement]];

  const 인성부족 = bujokList.includes(인성오행);
  const 식상부족 = bujokList.includes(식상오행);
  const 재성부족 = bujokList.includes(재성오행);
  const 관성부족 = bujokList.includes(관성오행);

  // 안정형: 부족 오행 없음
  if (bujokList.length === 0) {
    return { type: '안정형', subType: '균형' };
  }

  // 회피형: 재성/관성 중 하나가 20% 넘고, 인성/식상 둘 다 부족
  if ((재성 >= 20 || 관성 >= 20) && 인성부족 && 식상부족) {
    let subType = '보통';
    if (재성 >= 관성 * 2) subType = '기버';
    else if (관성 >= 재성 * 2) subType = '테이커';
    return { type: '회피형', subType };
  }

  // 불안형: 인성/식상 중 하나가 20% 넘고, 재성/관성 둘 다 부족
  if ((인성 >= 20 || 식상 >= 20) && 재성부족 && 관성부족) {
    let subType = '보통';
    if (인성 >= 식상 * 2) subType = '테이커';
    else if (식상 >= 인성 * 2) subType = '기버';
    return { type: '불안형', subType };
  }

  return { type: '해당 사항 없음', subType: '' };
}

/**
 * 궁합 점수 가중치
 */
const GUNGHAP_WEIGHTS = {
  ILGAN: 30,        // 일간 궁합 (가장 중요)
  ILJI: 25,         // 일지 궁합
  WOLJU: 20,        // 월주 궁합
  OHENG_BALANCE: 15, // 오행 보완
  RELATION: 10      // 기타 관계
};

/**
 * 천간 궁합 점수표
 */
const STEM_COMPATIBILITY = {
  // 합 (相合) - 매우 좋음
  COMBINE: 12,
  // 충 (相衝) - 나쁨
  CLASH: -8,
  // 같은 오행 - 보통
  SAME_OHENG: 5,
  // 상생 - 좋음
  GENERATE: 8,
  // 상극 - 안 좋음
  OVERCOME: -5
};

/**
 * 지지 궁합 점수표
 */
const BRANCH_COMPATIBILITY = {
  // 육합 - 매우 좋음
  SIX_COMBINE: 12,
  // 삼합 - 좋음
  TRIPLE_COMBINE: 10,
  // 방합 - 좋음
  DIRECTIONAL: 8,
  // 충 - 나쁨
  CLASH: -10,
  // 형 - 나쁨
  PUNISHMENT: -8,
  // 파 - 약간 나쁨
  BREAK: -5,
  // 해 - 약간 나쁨
  HARM: -5,
  // 같은 지지 - 보통
  SAME: 3
};

/**
 * 오행 상생상극
 */
const OHENG_RELATION = {
  // 상생 (木→火→土→金→水→木)
  GENERATE: { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' },
  // 상극 (木→土→水→火→金→木)
  OVERCOME: { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' }
};

export {
  OHENG_IDX, STEM_OHENG_IDX,
  checkSamhapHalf, checkSamhapFull, checkBanghapFull, checkSamhyung,
  tenGod, twelveStage, derivePersonInfo, calculateAttachmentType,
  GUNGHAP_WEIGHTS,
  STEM_COMPATIBILITY, BRANCH_COMPATIBILITY, OHENG_RELATION
};

// Re-export constants needed by other gunghap modules
export {
  THRESHOLDS, CHEONGAN, JIJI, CHEONGAN_OHENG, JIJI_OHENG,
  CHEONGAN_HANJA, JIJI_HANJA, CHEONGAN_EUMYANG, JIJI_EUMYANG,
  TEN_GODS, YUKSHIP_GAPJA,
  BR_EL, GAPJA_INDEX_MAP, REF_DATE, REF_DAY_IDX, REF_YEAR, REF_YEAR_IDX
} from './constants.js';
export { OhengAnalyzer, YongsinAnalyzer } from './calculator.js';
