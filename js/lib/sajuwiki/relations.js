/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 연세사주 - 관계 분석 모듈 (합충형파해)
 * ═══════════════════════════════════════════════════════════════════════════
 * 모든 관계 테이블은 constants.js에서 단일 소스로 관리
 */

import {
  CHEONGAN, JIJI,
  STEM_COMBINE, STEM_CLASH,
  BRANCH_COMBINE, BRANCH_CLASH,
  BRANCH_PUNISHMENT, BRANCH_BREAK, BRANCH_HARM,
  TRIPLE_COMBINE, DIRECTIONAL_COMBINE
} from './constants.js';

/**
 * 관계 분석기 클래스
 */
export class RelationAnalyzer {
  /**
   * 천간 쌍 관계 검사
   */
  static checkStemPair(stemIdx1, stemIdx2) {
    const results = [];

    // 천간합 검사
    for (const [a, b, result] of STEM_COMBINE) {
      if ((stemIdx1 === a && stemIdx2 === b) ||
          (stemIdx1 === b && stemIdx2 === a)) {
        results.push({
          type: '합',
          desc: `${CHEONGAN[stemIdx1]}${CHEONGAN[stemIdx2]}합(${result})`,
          result
        });
      }
    }

    // 천간충 검사
    for (const [a, b] of STEM_CLASH) {
      if ((stemIdx1 === a && stemIdx2 === b) ||
          (stemIdx1 === b && stemIdx2 === a)) {
        results.push({
          type: '충',
          desc: `${CHEONGAN[stemIdx1]}${CHEONGAN[stemIdx2]}충`
        });
      }
    }

    return results;
  }

  /**
   * 지지 쌍 관계 검사
   */
  static checkBranchPair(branchIdx1, branchIdx2) {
    const results = [];

    // 육합 검사
    for (const [a, b, result] of BRANCH_COMBINE) {
      if ((branchIdx1 === a && branchIdx2 === b) ||
          (branchIdx1 === b && branchIdx2 === a)) {
        results.push({
          type: '합',
          desc: `${JIJI[branchIdx1]}${JIJI[branchIdx2]}합(${result})`,
          result
        });
      }
    }

    // 육충 검사
    for (const [a, b] of BRANCH_CLASH) {
      if ((branchIdx1 === a && branchIdx2 === b) ||
          (branchIdx1 === b && branchIdx2 === a)) {
        results.push({
          type: '충',
          desc: `${JIJI[branchIdx1]}${JIJI[branchIdx2]}충`
        });
      }
    }

    // 형 검사
    for (const [a, b, kind] of BRANCH_PUNISHMENT) {
      if ((branchIdx1 === a && branchIdx2 === b) ||
          (branchIdx1 === b && branchIdx2 === a)) {
        results.push({
          type: '형',
          desc: `${JIJI[branchIdx1]}${JIJI[branchIdx2]}형`,
          punishmentType: kind
        });
      }
    }

    // 파 검사
    for (const [a, b] of BRANCH_BREAK) {
      if ((branchIdx1 === a && branchIdx2 === b) ||
          (branchIdx1 === b && branchIdx2 === a)) {
        results.push({
          type: '파',
          desc: `${JIJI[branchIdx1]}${JIJI[branchIdx2]}파`
        });
      }
    }

    // 해 검사
    for (const [a, b] of BRANCH_HARM) {
      if ((branchIdx1 === a && branchIdx2 === b) ||
          (branchIdx1 === b && branchIdx2 === a)) {
        results.push({
          type: '해',
          desc: `${JIJI[branchIdx1]}${JIJI[branchIdx2]}해`
        });
      }
    }

    return results;
  }

  /**
   * 원국 내 모든 관계 감지
   */
  static detectAllRelations(result, hasTime) {
    const positions = hasTime ? ['hour', 'day', 'month', 'year'] : ['day', 'month', 'year'];
    const positionLabels = { hour: '시', day: '일', month: '월', year: '년' };
    const relations = [];

    // 인접 기둥 간 관계 분석
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];

      const stem1 = result.idxs[p1] % 10;
      const stem2 = result.idxs[p2] % 10;
      const branch1 = result.idxs[p1] % 12;
      const branch2 = result.idxs[p2] % 12;

      // 천간 관계
      for (const rel of this.checkStemPair(stem1, stem2)) {
        relations.push({
          ...rel,
          row: 'stem',
          p1, p2,
          cat: rel.type,
          position: `${positionLabels[p1]}-${positionLabels[p2]}간`
        });
      }

      // 지지 관계
      for (const rel of this.checkBranchPair(branch1, branch2)) {
        relations.push({
          ...rel,
          row: 'branch',
          p1, p2,
          cat: rel.type,
          position: `${positionLabels[p1]}-${positionLabels[p2]}지`
        });
      }
    }

    // 비인접 관계 (년-일, 시-월 등)
    if (positions.length >= 3) {
      for (let i = 0; i < positions.length - 2; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 2];

        const branch1 = result.idxs[p1] % 12;
        const branch2 = result.idxs[p2] % 12;

        // 지지 관계만 검사 (충/형이 주요)
        for (const rel of this.checkBranchPair(branch1, branch2)) {
          if (['충', '형'].includes(rel.type)) {
            relations.push({
              ...rel,
              row: 'branch',
              p1, p2,
              cat: rel.type,
              position: `${positionLabels[p1]}-${positionLabels[p2]}지`
            });
          }
        }
      }
    }

    return relations;
  }

  /**
   * 삼합 검사
   */
  static checkTripleCombine(branchIndices) {
    const results = [];

    for (const [a, b, c, result] of TRIPLE_COMBINE) {
      const branches = [a, b, c];
      const count = branches.filter(bi => branchIndices.includes(bi)).length;
      if (count === 3) {
        results.push({
          type: '삼합',
          desc: `${branches.map(bi => JIJI[bi]).join('')} 삼합(${result})`,
          result,
          complete: true
        });
      } else if (count === 2) {
        const present = branches.filter(bi => branchIndices.includes(bi));
        results.push({
          type: '반합',
          desc: `${present.map(bi => JIJI[bi]).join('')} 반합`,
          result,
          complete: false
        });
      }
    }

    return results;
  }

  /**
   * 방합 검사
   */
  static checkDirectionalCombine(branchIndices) {
    const results = [];
    const directions = ['동', '남', '서', '북'];

    for (let i = 0; i < DIRECTIONAL_COMBINE.length; i++) {
      const [a, b, c, result] = DIRECTIONAL_COMBINE[i];
      const branches = [a, b, c];
      const count = branches.filter(bi => branchIndices.includes(bi)).length;
      if (count === 3) {
        results.push({
          type: '방합',
          desc: `${branches.map(bi => JIJI[bi]).join('')} ${directions[i]}방합(${result})`,
          direction: directions[i],
          result,
          complete: true
        });
      }
    }

    return results;
  }

  /**
   * 대운/세운과 원국 간 관계 분석
   */
  static analyzeWithFortune(fortuneIdx, originalIdxs, hasTime) {
    const fortStem = fortuneIdx % 10;
    const fortBranch = fortuneIdx % 12;
    const positions = hasTime ? ['hour', 'day', 'month', 'year'] : ['day', 'month', 'year'];
    const positionLabels = { hour: '시', day: '일', month: '월', year: '년' };
    const hits = [];

    for (const pos of positions) {
      const origStem = originalIdxs[pos] % 10;
      const origBranch = originalIdxs[pos] % 12;

      // 천간 관계
      for (const rel of this.checkStemPair(fortStem, origStem)) {
        hits.push(`${CHEONGAN[fortStem]}${CHEONGAN[origStem]}${rel.type}${rel.result ? `(${rel.result})` : ''}-${positionLabels[pos]}간`);
      }

      // 지지 관계
      for (const rel of this.checkBranchPair(fortBranch, origBranch)) {
        hits.push(`${JIJI[fortBranch]}${JIJI[origBranch]}${rel.type}${rel.result ? `(${rel.result})` : ''}-${positionLabels[pos]}지`);
      }
    }

    return hits.length ? hits.join(', ') : '없음';
  }
}

export default RelationAnalyzer;
