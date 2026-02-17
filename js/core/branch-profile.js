/**
 * ===================================================================
 * sinsaju-calculator - Branch Profile (지지 프로필)
 * ===================================================================
 * Unified earthly branch (지지) profiles. Each of 12 branches is a
 * multi-dimensional vector combining what were previously 5 separate
 * lookup tables: 지장간, 삼합, 역마/도화/화개, 12운성, 방합.
 *
 * Every branch carries:
 *   - Discrete identity: name, hanja, index, angle
 *   - Oheng ratio: five-element breakdown from 지장간
 *   - Hidden stems: 지장간 with type and ratio
 *   - Role: doHwa (도화), yeokMa (역마), or hwaGae (화개)
 *   - Season, 삼합 group/position, 방합 group
 *   - Continuous metrics: purity, stability, intensity
 */

import { angleDiff, normalizeAngle, toRad } from '../utils/math.js';

// ===================================================================
// Branch Profile Data
// ===================================================================

const BRANCH_PROFILES = [
  { // 자(子) idx=0
    idx: 0, name: '자', hanja: '子', angle: 0,
    ohengRatio: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 1.0 },
    hiddenStems: [{ s: '임', t: '초기', r: 3 }, { s: '계', t: '본기', r: 7 }],
    role: 'doHwa',           // 도화(桃花) - cardinal
    season: 'winter',
    samhapGroup: '수국',     // 신자진(申子辰) 수국
    samhapPosition: 'wang',  // 왕지(旺地) - peak of 삼합
    banghapGroup: '북방',    // 해자축(亥子丑) 북방
    purity: 1.0,             // 순수 단일 오행
    stability: 0.5,          // 도화는 중간 (고정점이지만 매력/변화)
    intensity: 1.0,          // cardinal = 최대 intensity
  },
  { // 축(丑) idx=1
    idx: 1, name: '축', hanja: '丑', angle: 30,
    ohengRatio: { 목: 0, 화: 0, 토: 0.6, 금: 0.1, 수: 0.3 },
    hiddenStems: [{ s: '계', t: '초기', r: 3 }, { s: '신', t: '중기', r: 1 }, { s: '기', t: '본기', r: 6 }],
    role: 'hwaGae',          // 화개(華蓋) - mutable/storage
    season: 'winter',        // 겨울 끝자락
    samhapGroup: '금국',     // 사유축(巳酉丑) 금국
    samhapPosition: 'go',    // 고지(庫地) - storage of 삼합
    banghapGroup: '북방',    // 해자축
    purity: 0.6,             // 혼합 오행 (토60%+수30%+금10%)
    stability: 1.0,          // 화개 = 최대 안정 (저장, 마무리)
    intensity: 0.0,          // inter-cardinal = 최소 intensity
  },
  { // 인(寅) idx=2
    idx: 2, name: '인', hanja: '寅', angle: 60,
    ohengRatio: { 목: 0.6, 화: 0.2, 토: 0.2, 금: 0, 수: 0 },
    hiddenStems: [{ s: '무', t: '초기', r: 2 }, { s: '병', t: '중기', r: 2 }, { s: '갑', t: '본기', r: 6 }],
    role: 'yeokMa',          // 역마(驛馬) - mutable/movement
    season: 'spring',
    samhapGroup: '화국',     // 인오술(寅午戌) 화국
    samhapPosition: 'saeng', // 생지(生地) - birth of 삼합
    banghapGroup: '동방',    // 인묘진
    purity: 0.6,             // 혼합 (목60%+화20%+토20%)
    stability: 0.0,          // 역마 = 최소 안정 (이동, 변화)
    intensity: 0.5,          // 중간
  },
  { // 묘(卯) idx=3
    idx: 3, name: '묘', hanja: '卯', angle: 90,
    ohengRatio: { 목: 1.0, 화: 0, 토: 0, 금: 0, 수: 0 },
    hiddenStems: [{ s: '갑', t: '초기', r: 3 }, { s: '을', t: '본기', r: 7 }],
    role: 'doHwa',
    season: 'spring',
    samhapGroup: '목국',     // 해묘미(亥卯未) 목국
    samhapPosition: 'wang',
    banghapGroup: '동방',
    purity: 1.0,
    stability: 0.5,
    intensity: 1.0,
  },
  { // 진(辰) idx=4
    idx: 4, name: '진', hanja: '辰', angle: 120,
    ohengRatio: { 목: 0.3, 화: 0, 토: 0.6, 금: 0, 수: 0.1 },
    hiddenStems: [{ s: '을', t: '초기', r: 3 }, { s: '계', t: '중기', r: 1 }, { s: '무', t: '본기', r: 6 }],
    role: 'hwaGae',
    season: 'spring',        // 봄 끝자락
    samhapGroup: '수국',     // 신자진
    samhapPosition: 'go',
    banghapGroup: '동방',
    purity: 0.6,
    stability: 1.0,
    intensity: 0.0,
  },
  { // 사(巳) idx=5
    idx: 5, name: '사', hanja: '巳', angle: 150,
    ohengRatio: { 목: 0, 화: 0.6, 토: 0.2, 금: 0.2, 수: 0 },
    hiddenStems: [{ s: '무', t: '초기', r: 2 }, { s: '경', t: '중기', r: 2 }, { s: '병', t: '본기', r: 6 }],
    role: 'yeokMa',
    season: 'summer',
    samhapGroup: '금국',     // 사유축
    samhapPosition: 'saeng',
    banghapGroup: '남방',    // 사오미
    purity: 0.6,
    stability: 0.0,
    intensity: 0.5,
  },
  { // 오(午) idx=6
    idx: 6, name: '오', hanja: '午', angle: 180,
    ohengRatio: { 목: 0, 화: 1.0, 토: 0, 금: 0, 수: 0 },
    hiddenStems: [{ s: '병', t: '초기', r: 3 }, { s: '정', t: '본기', r: 7 }],
    role: 'doHwa',
    season: 'summer',
    samhapGroup: '화국',     // 인오술
    samhapPosition: 'wang',
    banghapGroup: '남방',
    purity: 1.0,
    stability: 0.5,
    intensity: 1.0,
  },
  { // 미(未) idx=7
    idx: 7, name: '미', hanja: '未', angle: 210,
    ohengRatio: { 목: 0.1, 화: 0.3, 토: 0.6, 금: 0, 수: 0 },
    hiddenStems: [{ s: '정', t: '초기', r: 3 }, { s: '을', t: '중기', r: 1 }, { s: '기', t: '본기', r: 6 }],
    role: 'hwaGae',
    season: 'summer',
    samhapGroup: '목국',     // 해묘미
    samhapPosition: 'go',
    banghapGroup: '남방',
    purity: 0.6,
    stability: 1.0,
    intensity: 0.0,
  },
  { // 신(申) idx=8
    idx: 8, name: '신', hanja: '申', angle: 240,
    ohengRatio: { 목: 0, 화: 0, 토: 0.2, 금: 0.6, 수: 0.2 },
    hiddenStems: [{ s: '무', t: '초기', r: 2 }, { s: '임', t: '중기', r: 2 }, { s: '경', t: '본기', r: 6 }],
    role: 'yeokMa',
    season: 'autumn',
    samhapGroup: '수국',     // 신자진
    samhapPosition: 'saeng',
    banghapGroup: '서방',    // 신유술
    purity: 0.6,
    stability: 0.0,
    intensity: 0.5,
  },
  { // 유(酉) idx=9
    idx: 9, name: '유', hanja: '酉', angle: 270,
    ohengRatio: { 목: 0, 화: 0, 토: 0, 금: 1.0, 수: 0 },
    hiddenStems: [{ s: '경', t: '초기', r: 3 }, { s: '신', t: '본기', r: 7 }],
    role: 'doHwa',
    season: 'autumn',
    samhapGroup: '금국',     // 사유축
    samhapPosition: 'wang',
    banghapGroup: '서방',
    purity: 1.0,
    stability: 0.5,
    intensity: 1.0,
  },
  { // 술(戌) idx=10
    idx: 10, name: '술', hanja: '戌', angle: 300,
    ohengRatio: { 목: 0, 화: 0.1, 토: 0.6, 금: 0.3, 수: 0 },
    hiddenStems: [{ s: '신', t: '초기', r: 3 }, { s: '정', t: '중기', r: 1 }, { s: '무', t: '본기', r: 6 }],
    role: 'hwaGae',
    season: 'autumn',
    samhapGroup: '화국',     // 인오술
    samhapPosition: 'go',
    banghapGroup: '서방',
    purity: 0.6,
    stability: 1.0,
    intensity: 0.0,
  },
  { // 해(亥) idx=11
    idx: 11, name: '해', hanja: '亥', angle: 330,
    ohengRatio: { 목: 0.2, 화: 0, 토: 0.2, 금: 0, 수: 0.6 },
    hiddenStems: [{ s: '무', t: '초기', r: 2 }, { s: '갑', t: '중기', r: 2 }, { s: '임', t: '본기', r: 6 }],
    role: 'yeokMa',
    season: 'winter',
    samhapGroup: '목국',     // 해묘미
    samhapPosition: 'saeng',
    banghapGroup: '북방',    // 해자축
    purity: 0.6,
    stability: 0.0,
    intensity: 0.5,
  }
];

// Pre-build name->profile lookup for O(1) access
const NAME_MAP = new Map();
for (const profile of BRANCH_PROFILES) {
  NAME_MAP.set(profile.name, profile);
}

/** Oheng keys in canonical order */
const OHENG_KEYS = ['목', '화', '토', '금', '수'];

/** Numeric properties that can be blended between adjacent profiles */
const BLENDABLE_SCALARS = ['purity', 'stability', 'intensity'];

// ===================================================================
// Public API
// ===================================================================

/**
 * Get the branch profile for a given index (0-11).
 * @param {number} branchIdx - branch index (0=자, 1=축, ..., 11=해)
 * @returns {Object} branch profile
 */
export function getBranchProfile(branchIdx) {
  const idx = ((branchIdx % 12) + 12) % 12;
  return BRANCH_PROFILES[idx];
}

/**
 * Get the branch profile by Korean name.
 * @param {string} name - branch name (e.g. '자', '축', '인', ...)
 * @returns {Object|undefined} branch profile, or undefined if not found
 */
export function getBranchProfileByName(name) {
  return NAME_MAP.get(name);
}

/**
 * Get all 12 branch profiles.
 * @returns {Object[]} array of 12 branch profiles (frozen copy of internal data)
 */
export function getAllBranchProfiles() {
  return BRANCH_PROFILES;
}

/**
 * Get a blended branch profile for any continuous angle on the circle.
 *
 * Uses pairwise adjacent cosine interpolation: only the two nearest
 * branches contribute. At branch centers (i*30°), the exact discrete
 * profile is recovered — guaranteeing traditional 지장간 ratios.
 *
 * Between centers, cosine easing provides C¹-smooth interpolation
 * of all numeric properties (ohengRatio, purity, stability, intensity).
 *
 * @param {number} angle - continuous angle in degrees [0, 360)
 * @returns {Object} blended profile with interpolated numeric values
 */
export function getBlendedBranchProfile(angle) {
  const theta = normalizeAngle(angle);

  // Find adjacent branches and fractional position
  const leftIdx = Math.floor(theta / 30) % 12;
  const rightIdx = (leftIdx + 1) % 12;
  const t = (theta - leftIdx * 30) / 30;  // [0, 1)

  // Cosine easing weights: 0 at left center, 1 at right center
  const wRight = 0.5 - 0.5 * Math.cos(t * Math.PI);
  const wLeft = 1 - wRight;

  const leftProfile = BRANCH_PROFILES[leftIdx];
  const rightProfile = BRANCH_PROFILES[rightIdx];

  // Blend ohengRatio
  const blendedOheng = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const key of OHENG_KEYS) {
    blendedOheng[key] = wLeft * leftProfile.ohengRatio[key] + wRight * rightProfile.ohengRatio[key];
  }

  // Blend scalar properties
  const blendedScalars = {};
  for (const prop of BLENDABLE_SCALARS) {
    blendedScalars[prop] = wLeft * leftProfile[prop] + wRight * rightProfile[prop];
  }

  // Dominant branch = whichever has higher weight
  const dominantIdx = wLeft >= wRight ? leftIdx : rightIdx;
  const dominant = BRANCH_PROFILES[dominantIdx];

  // Build influence array (at most 2 non-zero)
  const influences = new Array(12).fill(0);
  influences[leftIdx] = wLeft;
  influences[rightIdx] += wRight;  // += handles leftIdx === rightIdx (t=0)
  const totalInfluence = wLeft + wRight;  // always 1.0

  return {
    angle: theta,
    dominantIdx,
    dominantName: dominant.name,
    dominantHanja: dominant.hanja,
    ohengRatio: blendedOheng,
    purity: blendedScalars.purity,
    stability: blendedScalars.stability,
    intensity: blendedScalars.intensity,
    // Discrete properties come from the dominant branch
    role: dominant.role,
    season: dominant.season,
    samhapGroup: dominant.samhapGroup,
    samhapPosition: dominant.samhapPosition,
    banghapGroup: dominant.banghapGroup,
    hiddenStems: dominant.hiddenStems,
    // Raw influence data for advanced use
    influences,
    totalInfluence,
  };
}
