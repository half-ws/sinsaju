/**
 * 연세사주 - 궁합 분석기
 * GunghapAnalyzer: 궁합 점수 계산 및 해석
 * GunghapFormatter: 점수/등급 포맷팅
 */

import {
  OHENG_IDX, STEM_OHENG_IDX,
  checkSamhapHalf, checkSamhapFull, checkBanghapFull, checkSamhyung,
  tenGod, twelveStage, derivePersonInfo, calculateAttachmentType,
  GUNGHAP_WEIGHTS,
  STEM_COMPATIBILITY, BRANCH_COMPATIBILITY, OHENG_RELATION,
  THRESHOLDS, CHEONGAN, JIJI, CHEONGAN_OHENG, JIJI_OHENG,
  CHEONGAN_HANJA, JIJI_HANJA, CHEONGAN_EUMYANG, JIJI_EUMYANG,
  TEN_GODS, YUKSHIP_GAPJA
} from './gunghap-helpers.js';
import { RelationAnalyzer } from './relations.js';
import { SajuCalculator, OhengAnalyzer, YongsinAnalyzer } from './calculator.js';

/**
 * 궁합 분석기
 */
export class GunghapAnalyzer {
  constructor() {
    this.state = null;
  }

  async init() {
    // 초기화 (필요한 경우)
  }

  /**
   * 완전한 궁합 분석 (Python 알고리즘 기반 v2)
   * @param {Object} rA - 본인 사주 계산 결과
   * @param {Object} rB - 상대 사주 계산 결과
   * @param {boolean} htA - 본인 시간 유무
   * @param {boolean} htB - 상대 시간 유무
   * @returns {Object} 궁합 분석 결과
   */
  analyzeCompatibilityFull(rA, rB, htA, htB) {
    // 용신 분석
    const ysA = YongsinAnalyzer.calculate(rA, htA);
    const ysB = YongsinAnalyzer.calculate(rB, htB);
    const infoA = derivePersonInfo(rA, htA, ysA);
    const infoB = derivePersonInfo(rB, htB, ysB);

    const notes = [];
    const flags = { sameYongsin: false, wonkukBroken: [], samhyung: null, yongsinSame: false };
    const details = { jiji: 0, chungan: 0, ohang: 0, sipsung: 0, unseong: 0, special: 0 };
    let hasHapAny = false, hasChungAny = false;

    // 합 결과오행 → 용신 가점
    const ohangChange = (resultOh) => {
      let s = 0;
      for (const [tag, info] of [['본인', infoA], ['상대', infoB]]) {
        if (info.yongsin.includes(resultOh)) {
          s += 5;
          notes.push(`  → ${tag} 용신(${resultOh}): +5`);
        }
      }
      return s;
    };

    // ═══ STEP 1: 지지 합충 ═══
    (() => {
      let s = 0;
      const brsA = infoA.branches, brsB = infoB.branches;

      // Phase 1: 완전 삼합/방합 (A월일지+B월일지 = 4개)
      const four = [rA.idxs.month % 12, rA.idxs.day % 12, rB.idxs.month % 12, rB.idxs.day % 12];
      let completeSH = checkSamhapFull(four), completeBH = checkBanghapFull(four), completeFound = false;
      if (completeSH.ok) {
        s += 15;
        notes.push(`[지지] 완전삼합 → ${completeSH.el} → +15`);
        s += ohangChange(completeSH.el);
        completeFound = true;
      } else if (completeBH.ok) {
        s += 15;
        notes.push(`[지지] 완전방합 → ${completeBH.el} → +15`);
        s += ohangChange(completeBH.el);
        completeFound = true;
      }

      // Phase 2: 같은 궁성끼리 비교
      const pairs = [
        ['월지', rA.idxs.month % 12, rB.idxs.month % 12],
        ['일지', rA.idxs.day % 12, rB.idxs.day % 12],
        ['년지', rA.idxs.year % 12, rB.idxs.year % 12]
      ];
      if (htA && htB) pairs.push(['시지', rA.idxs.hour % 12, rB.idxs.hour % 12]);
      const posScores = {};

      for (const [pos, b1, b2] of pairs) {
        const isCore = pos === '월지' || pos === '일지';
        const yukPts = pos === '일지' ? 8 : pos === '월지' ? 5 : 3;
        const halfPts = isCore ? 5 : 2;
        const chungPts = pos === '월지' ? -8 : pos === '일지' ? -5 : -3;
        let ps = 0, found = false;

        // (1) 육합
        for (const rel of RelationAnalyzer.checkBranchPair(b1, b2)) {
          if (rel.type === '합') {
            ps += yukPts;
            notes.push(`[지지] ${pos} 육합: ${rel.desc} → +${yukPts}`);
            if (rel.result) ps += ohangChange(rel.result);
            found = true;
            hasHapAny = true;
            break;
          }
        }

        // (2) 삼합반합 (완전삼합 미발견 시)
        if (!found && !completeFound) {
          const sh = checkSamhapHalf(b1, b2);
          if (sh.ok) {
            ps += halfPts;
            notes.push(`[지지] ${pos} 삼합반합: ${sh.desc} → +${halfPts}`);
            ps += ohangChange(sh.el);
            found = true;
            hasHapAny = true;
          }
        }

        // (3) 충
        if (!found) {
          for (const rel of RelationAnalyzer.checkBranchPair(b1, b2)) {
            if (rel.type === '충') {
              ps += chungPts;
              notes.push(`[지지] ${pos} 충: ${rel.desc} → ${chungPts}`);
              hasChungAny = true;
              break;
            }
          }
        }
        posScores[pos] = ps;
      }
      s += Object.values(posScores).reduce((a, b) => a + b, 0);
      details.jiji = s;
    })();

    // ═══ STEP 2: 천간 합충 (위치별 가중치) ═══
    (() => {
      let s = 0;
      const pairs = [
        ['일간', rA.idxs.day % 10, rB.idxs.day % 10, 1],
        ['월간', rA.idxs.month % 10, rB.idxs.month % 10, 0.6],
        ['년간', rA.idxs.year % 10, rB.idxs.year % 10, 0.3]
      ];
      if (htA && htB) pairs.push(['시간', rA.idxs.hour % 10, rB.idxs.hour % 10, 0.3]);

      for (const [label, s1, s2, wt] of pairs) {
        for (const rel of RelationAnalyzer.checkStemPair(s1, s2)) {
          if (rel.type === '합') {
            const pts = Math.round(4 * wt);
            s += pts;
            notes.push(`[천간] ${label}합: ${rel.desc} → +${pts}`);
          } else if (rel.type === '충') {
            const pts = Math.round(3 * wt);
            s -= pts;
            notes.push(`[천간] ${label}충: ${rel.desc} → -${pts}`);
          }
        }
      }
      details.chungan = s;
    })();

    // ═══ STEP 3: 오행 보완 ═══
    (() => {
      let s = 0;
      let aFillsB = false, bFillsA = false;

      // A발달 → B용신 채움
      const bYS = ysB.용신;
      if (bYS && infoA.balda.includes(bYS)) {
        s += 4;
        aFillsB = true;
        notes.push(`[오행] 본인발달(${infoA.balda}) → 상대용신(${bYS}) 채움: +4`);
      }

      // B발달 → A용신 채움 (핵심)
      const aYS = ysA.용신;
      if (aYS && infoB.balda.includes(aYS)) {
        s += 12;
        bFillsA = true;
        notes.push(`[오행] 상대발달(${infoB.balda}) → 본인용신(${aYS}) 채움: +12`);
      }

      // 상호보완 보너스
      if (aFillsB && bFillsA) {
        s += 3;
        notes.push(`[오행] 상호보완 시너지: +3`);
      }

      // 공통 부족 페널티
      const commonBujok = infoA.bujokList.filter(e => infoB.bujokList.includes(e));
      if (commonBujok.length) {
        const penalty = commonBujok.length * -3;
        s += penalty;
        notes.push(`[오행] 공통부족(${commonBujok}): ${penalty}`);
      }

      // 용신 동일 (플래그만)
      if (ysA.용신 === ysB.용신) {
        flags.yongsinSame = true;
        notes.push(`[오행] 용신 동일(${ysA.용신}) → 세운 확인 권장`);
      }
      details.ohang = s;
    })();

    // ═══ STEP 4: 애착 유형 ═══
    (() => {
      let s = 0;
      const aT = infoA.attachmentType, bT = infoB.attachmentType;
      const aSub = infoA.attachmentSubType, bSub = infoB.attachmentSubType;
      const aSS = infoA.baldaSS, bSS = infoB.baldaSS;

      // (1) 회피형↔불안형: 상호보완적
      if ((aT === '회피형' && bT === '불안형') || (aT === '불안형' && bT === '회피형')) {
        s += 5;
        notes.push(`[애착] ${aT}↔${bT}: 상호보완 → +5`);
        // 기버-테이커 조합 보너스
        if ((aSub === '기버' && bSub === '테이커') || (aSub === '테이커' && bSub === '기버')) {
          s += 3;
          notes.push(`[애착] 기버↔테이커 조합: +3`);
        }
      }

      // (2) 안정형 포함 시 가점
      if (aT === '안정형' || bT === '안정형') {
        s += 4;
        notes.push(`[애착] 안정형 포함: +4`);
        // 둘 다 안정형
        if (aT === '안정형' && bT === '안정형') {
          s += 4;
          notes.push(`[애착] 둘 다 안정형: +4`);
        }
      }

      // (3) 동일 불안정 유형: 감점
      if (aT === bT && (aT === '회피형' || aT === '불안형')) {
        s -= 5;
        notes.push(`[애착] 동일유형(${aT}+${bT}): -5`);
        // 동일 서브타입 추가 감점
        if (aSub === bSub && (aSub === '기버' || aSub === '테이커')) {
          s -= 3;
          notes.push(`[애착] 동일 서브타입(${aSub}): -3`);
        }
      }

      // (4) 십성 특별매칭 (발달 십성 기반)
      const sp = [
        [['식신', '상관'], ['편인', '정인']],
        [['편재', '정재'], ['편관', '정관']]
      ];
      for (const [ga, gb] of sp) {
        if ((ga.includes(aSS) && gb.includes(bSS)) || (gb.includes(aSS) && ga.includes(bSS))) {
          s += 4;
          notes.push(`[십성] 특별매칭: ${aSS}↔${bSS} → +4`);
          break;
        }
      }

      details.sipsung = s;
    })();

    // ═══ STEP 5: 12운성 + 삼형 ═══
    (() => {
      let s = 0;
      const cat = u => {
        if (['장생', '목욕', '관대'].includes(u)) return '생지';
        if (['건록', '제왕'].includes(u)) return '왕지';
        return '묘지';
      };
      const aWC = cat(infoA.woljiUS), aIC = cat(infoA.iljiUS);
      const bWC = cat(infoB.woljiUS), bIC = cat(infoB.iljiUS);

      // A,B 각각 월지·일지 운성이 같은 카테고리일 때만 적용
      if (aWC === aIC && bWC === bIC) {
        const aC = aIC, bC = bIC;
        if (aC === bC) {
          // 같은 카테고리
          if (infoA.iljiUS === infoB.iljiUS) {
            notes.push(`[운성] 동일 운성(${infoA.iljiUS}+${infoB.iljiUS}): 0`);
          } else {
            // 일지끼리 충 관계인지 확인
            const db1 = rA.idxs.day % 12, db2 = rB.idxs.day % 12;
            let isChung = false;
            const 충t = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
            for (const [a, b] of 충t) {
              if ((db1 === a && db2 === b) || (db1 === b && db2 === a)) {
                isChung = true;
                break;
              }
            }
            if (isChung) {
              notes.push(`[운성] 동일카테고리(${aC}) 충 관계 → 기존 충 점수 유지`);
            } else {
              s -= 2;
              notes.push(`[운성] 동일카테고리(${aC}: ${infoA.iljiUS}↔${infoB.iljiUS}): -2`);
            }
          }
        } else if ((aC === '생지' && bC === '묘지') || (aC === '묘지' && bC === '생지')) {
          s += 2;
          notes.push(`[운성] 생지↔묘지 보완: +2`);
        }
      } else {
        notes.push(`[운성] 적용조건 미충족`);
      }

      // 삼형 (A+B 전체 지지)
      const allBrs = [...infoA.branches, ...infoB.branches];
      const sh = checkSamhyung(allBrs);
      if (sh.ok) {
        s -= 2;
        flags.samhyung = sh.name;
        notes.push(`[운성] 삼형(${sh.name}): -2`);
      }
      details.unseong = s;
    })();

    // ═══ STEP 6: 특수 상황 ═══
    (() => {
      let s = 0;
      details.special = s;
    })();

    // ═══ 총점 → 정규화 (0~100) ═══
    const rawTotal = details.jiji + details.chungan + details.ohang + details.sipsung + details.unseong + details.special;
    const normalized = Math.round(Math.max(0, Math.min(100, 50 + rawTotal)));

    // ═══ 합충 집계 (표시용, 같은 궁성끼리만) ═══
    const possA = htA ? ['hour', 'day', 'month', 'year'] : ['day', 'month', 'year'];
    const possB = htB ? ['hour', 'day', 'month', 'year'] : ['day', 'month', 'year'];
    let sH = 0, sC = 0, bH = 0, bC = 0, bX = 0;
    for (const p of possA) {
      if (!possB.includes(p)) continue;
      for (const r of RelationAnalyzer.checkStemPair(rA.idxs[p] % 10, rB.idxs[p] % 10)) {
        if (r.type === '합') sH++;
        else sC++;
      }
      for (const r of RelationAnalyzer.checkBranchPair(rA.idxs[p] % 12, rB.idxs[p] % 12)) {
        if (r.type === '합') bH++;
        else if (r.type === '충') bC++;
        else if (r.type === '형') bX++;
      }
      const sh = checkSamhapHalf(rA.idxs[p] % 12, rB.idxs[p] % 12);
      if (sh.ok) {
        const hasYuk = RelationAnalyzer.checkBranchPair(rA.idxs[p] % 12, rB.idxs[p] % 12).some(r => r.type === '합');
        if (!hasYuk) bH++;
      }
    }

    // 일간 십성 (표시용)
    const dsiA = rA.idxs.day % 10, dsiB = rB.idxs.day % 10;

    // oheng 데이터 - 전문 만세력과 동일한 가중치 계산 사용
    const weightedA = OhengAnalyzer.calculateWeightedOheng(rA, htA);
    const weightedB = OhengAnalyzer.calculateWeightedOheng(rB, htB);
    const ohA = weightedA.percent || { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };
    const ohB = weightedB.percent || { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };

    return {
      ysA, ysB, ohA, ohB, infoA, infoB,
      dayRelAB: tenGod(dsiA, dsiB), dayRelBA: tenGod(dsiB, dsiA),
      dayStemRels: RelationAnalyzer.checkStemPair(dsiA, dsiB),
      yearStemRels: RelationAnalyzer.checkStemPair(rA.idxs.year % 10, rB.idxs.year % 10),
      monthStemRels: RelationAnalyzer.checkStemPair(rA.idxs.month % 10, rB.idxs.month % 10),
      hourStemRels: (htA && htB) ? RelationAnalyzer.checkStemPair(rA.idxs.hour % 10, rB.idxs.hour % 10) : [],
      hourBrRels: (htA && htB) ? RelationAnalyzer.checkBranchPair(rA.idxs.hour % 12, rB.idxs.hour % 12) : [],
      dayBrRels: RelationAnalyzer.checkBranchPair(rA.idxs.day % 12, rB.idxs.day % 12),
      yearBrRels: RelationAnalyzer.checkBranchPair(rA.idxs.year % 12, rB.idxs.year % 12),
      monthBrRels: RelationAnalyzer.checkBranchPair(rA.idxs.month % 12, rB.idxs.month % 12),
      yongsinAinB: ohB[ysA.용신] || 0, yongsinBinA: ohA[ysB.용신] || 0,
      cross: { sH, sC, bH, bC, bX },
      details, notes, flags, rawTotal,
      scores: { total: normalized }
    };
  }

  /**
   * 두 사주의 궁합 분석 (간단 버전)
   * @param {Object} person1 - 첫 번째 사람의 사주 계산 결과
   * @param {Object} person2 - 두 번째 사람의 사주 계산 결과
   * @returns {Object} 궁합 분석 결과
   */
  analyze(person1, person2) {
    if (!person1 || !person2) {
      throw new Error('두 사람의 사주 정보가 필요합니다');
    }

    const result = {
      // 기본 정보
      person1: this.extractBasicInfo(person1),
      person2: this.extractBasicInfo(person2),

      // 상세 분석
      ilganAnalysis: this.analyzeIlgan(person1, person2),
      iljiAnalysis: this.analyzeIlji(person1, person2),
      woljuAnalysis: this.analyzeWolju(person1, person2),
      ohengAnalysis: this.analyzeOhengBalance(person1, person2),
      relationAnalysis: this.analyzeRelations(person1, person2),

      // 점수
      scores: {},
      totalScore: 0,

      // 종합 해석
      interpretation: '',
      advice: []
    };

    // 점수 계산
    result.scores = this.calculateScores(result);
    result.totalScore = this.calculateTotalScore(result.scores);

    // 해석 생성
    result.interpretation = this.generateInterpretation(result);
    result.advice = this.generateAdvice(result);

    return result;
  }
  
  /**
   * 기본 정보 추출
   */
  extractBasicInfo(person) {
    return {
      name: person.name || '본인',
      gender: person.gender,
      ilgan: person.saju?.dayPillar?.stem || person.dayPillar?.stem,
      ilji: person.saju?.dayPillar?.branch || person.dayPillar?.branch,
      wolgan: person.saju?.monthPillar?.stem || person.monthPillar?.stem,
      wolji: person.saju?.monthPillar?.branch || person.monthPillar?.branch,
      oheng: person.oheng || {}
    };
  }
  
  /**
   * 일간 궁합 분석
   */
  analyzeIlgan(person1, person2) {
    const stem1Idx = CHEONGAN.indexOf(person1.saju?.dayPillar?.stem || person1.dayPillar?.stem);
    const stem2Idx = CHEONGAN.indexOf(person2.saju?.dayPillar?.stem || person2.dayPillar?.stem);
    
    const stem1 = CHEONGAN[stem1Idx];
    const stem2 = CHEONGAN[stem2Idx];
    
    const oheng1 = CHEONGAN_OHENG[stem1Idx];
    const oheng2 = CHEONGAN_OHENG[stem2Idx];
    
    const result = {
      stems: [stem1, stem2],
      ohengs: [oheng1, oheng2],
      relation: null,
      score: 0,
      description: ''
    };
    
    // 합 체크 (갑기합, 을경합, 병신합, 정임합, 무계합)
    const combines = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]];
    const isCombine = combines.some(([a, b]) => 
      (stem1Idx === a && stem2Idx === b) || (stem1Idx === b && stem2Idx === a)
    );
    
    if (isCombine) {
      result.relation = 'combine';
      result.score = STEM_COMPATIBILITY.COMBINE;
      result.description = `${stem1}와 ${stem2}가 천간합(天干合)을 이루고 있습니다. 이는 두 사람의 본질적 성향이 자연스럽게 어우러진다는 의미로, 만났을 때 편안함을 느끼고 서로에게 끌리는 힘이 강합니다. 일상에서 의견이 잘 맞고, 큰 갈등 없이 조화로운 관계를 유지할 가능성이 높습니다.`;
      return result;
    }
    
    // 충 체크 (갑경충, 을신충, 병임충, 정계충, 무무충, 기기충)
    const clashes = [[0, 6], [1, 7], [2, 8], [3, 9]];
    const isClash = clashes.some(([a, b]) => 
      (stem1Idx === a && stem2Idx === b) || (stem1Idx === b && stem2Idx === a)
    );
    
    if (isClash) {
      result.relation = 'clash';
      result.score = STEM_COMPATIBILITY.CLASH;
      result.description = `${stem1}와 ${stem2}가 천간충(天干衝)을 이루고 있습니다. 이는 두 사람의 근본적인 가치관이나 행동 방식에 차이가 있을 수 있다는 뜻입니다. 처음에는 서로 다른 매력에 끌릴 수 있지만, 장기적으로는 의견 충돌이나 생활 방식의 차이로 갈등이 생길 수 있으므로, 서로의 다름을 존중하고 대화로 풀어가는 노력이 중요합니다.`;
      return result;
    }
    
    // 같은 오행
    if (oheng1 === oheng2) {
      result.relation = 'same';
      result.score = STEM_COMPATIBILITY.SAME_OHENG;
      result.description = `두 사람 모두 ${oheng1}(${oheng1 === '목' ? '木' : oheng1 === '화' ? '火' : oheng1 === '토' ? '土' : oheng1 === '금' ? '金' : '水'})의 기운을 가지고 있습니다. 같은 오행끼리는 서로의 생각과 감정을 쉽게 이해하며 공감대가 넓습니다. 다만 비슷한 성향이 강해 서로에게 자극이나 새로운 관점을 주기 어려울 수 있으니, 함께 새로운 경험을 추구하면 좋습니다.`;
      return result;
    }
    
    // 상생 체크
    if (OHENG_RELATION.GENERATE[oheng1] === oheng2) {
      result.relation = 'generate';
      result.score = STEM_COMPATIBILITY.GENERATE;
      result.description = `${oheng1}이 ${oheng2}를 생(生)하는 상생 관계입니다. 본인이 상대에게 자연스러운 도움과 에너지를 줄 수 있어, 상대는 함께 있을 때 안정감과 힘을 느낍니다. 관계에서 주도적인 역할을 하되, 일방적인 헌신이 되지 않도록 균형을 맞추는 것이 좋습니다.`;
      return result;
    }

    if (OHENG_RELATION.GENERATE[oheng2] === oheng1) {
      result.relation = 'generated';
      result.score = STEM_COMPATIBILITY.GENERATE - 5;
      result.description = `${oheng2}가 ${oheng1}을 생(生)하는 상생 관계입니다. 상대로부터 자연스러운 지지와 도움을 받을 수 있어, 본인이 편안함과 안정감을 느낍니다. 상대의 배려에 감사하는 마음을 표현하고, 다른 방식으로 보답하면 더욱 건강한 관계가 됩니다.`;
      return result;
    }
    
    // 상극 체크
    if (OHENG_RELATION.OVERCOME[oheng1] === oheng2) {
      result.relation = 'overcome';
      result.score = STEM_COMPATIBILITY.OVERCOME;
      result.description = `${oheng1}이 ${oheng2}를 극(克)하는 상극 관계입니다. 본인의 성향이 상대를 제어하거나 압박하는 방향으로 작용할 수 있습니다. 이는 적절한 긴장감을 만들 수도 있지만, 지나치면 상대가 위축되거나 스트레스를 받을 수 있으므로, 부드러운 소통과 상대의 의견을 경청하는 자세가 중요합니다.`;
      return result;
    }

    if (OHENG_RELATION.OVERCOME[oheng2] === oheng1) {
      result.relation = 'overcame';
      result.score = STEM_COMPATIBILITY.OVERCOME - 5;
      result.description = `${oheng2}가 ${oheng1}을 극(克)하는 상극 관계입니다. 상대의 성향에 의해 본인이 제약을 느끼거나 무의식적으로 맞추게 되는 경향이 있을 수 있습니다. 자신의 의견을 분명히 표현하고, 서로 동등한 위치에서 대화하는 습관을 기르면 관계의 균형을 유지할 수 있습니다.`;
      return result;
    }

    // 특별한 관계 없음
    result.relation = 'neutral';
    result.score = 0;
    result.description = '일간 사이에 합이나 충 등 특별한 관계가 없어, 서로에 대한 강한 끌림이나 반발은 적습니다. 이는 서로 부담 없이 편안한 관계를 유지하기 좋지만, 관계에 활력을 불어넣기 위한 노력이 필요할 수 있습니다.';
    
    return result;
  }
  
  /**
   * 일지 궁합 분석
   */
  analyzeIlji(person1, person2) {
    const branch1 = person1.saju?.dayPillar?.branch || person1.dayPillar?.branch;
    const branch2 = person2.saju?.dayPillar?.branch || person2.dayPillar?.branch;
    
    const branch1Idx = JIJI.indexOf(branch1);
    const branch2Idx = JIJI.indexOf(branch2);
    
    const result = {
      branches: [branch1, branch2],
      relations: [],
      score: 0,
      descriptions: []
    };
    
    // 같은 지지
    if (branch1 === branch2) {
      result.relations.push('same');
      result.score += BRANCH_COMPATIBILITY.SAME;
      result.descriptions.push(`두 사람 모두 일지가 ${branch1}로 같습니다. 일지는 배우자궁(配偶者宮)이라 불리며 결혼 후 가정생활의 성격을 나타냅니다. 같은 일지를 가진 두 사람은 가정에서 추구하는 방향이 비슷하여 생활 습관이나 가치관이 잘 맞을 수 있습니다.`);
    }
    
    // 육합 체크
    const sixCombines = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
    const isSixCombine = sixCombines.some(([a, b]) => 
      (branch1Idx === a && branch2Idx === b) || (branch1Idx === b && branch2Idx === a)
    );
    
    if (isSixCombine) {
      result.relations.push('sixCombine');
      result.score += BRANCH_COMPATIBILITY.SIX_COMBINE;
      result.descriptions.push(`${branch1}와 ${branch2}가 육합(六合)을 이루고 있습니다. 육합은 두 지지가 하나로 합쳐지는 가장 이상적인 결합으로, 전통적으로 최고의 배우자 궁합으로 봅니다. 결혼 후 가정이 안정되고 서로에 대한 신뢰와 애정이 깊어지는 관계입니다.`);
    }
    
    // 충 체크
    const clashes = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
    const isClash = clashes.some(([a, b]) => 
      (branch1Idx === a && branch2Idx === b) || (branch1Idx === b && branch2Idx === a)
    );
    
    if (isClash) {
      result.relations.push('clash');
      result.score += BRANCH_COMPATIBILITY.CLASH;
      result.descriptions.push(`${branch1}와 ${branch2}가 일지충(日支衝)을 이루고 있습니다. 일지는 배우자궁이므로 충이 있으면 가정 내 생활 방식이나 가치관의 차이로 마찰이 생길 수 있습니다. 다만 충은 변화와 역동성을 의미하기도 하므로, 서로의 차이를 인정하고 각자의 영역을 존중하면 오히려 상호 보완적인 관계가 될 수 있습니다.`);
    }
    
    // 형 체크
    const punishments = this.checkPunishment(branch1Idx, branch2Idx);
    if (punishments.length > 0) {
      result.relations.push('punishment');
      result.score += BRANCH_COMPATIBILITY.PUNISHMENT;
      result.descriptions.push(`${branch1}와 ${branch2} 사이에 형(刑)이 있습니다. 형은 두 기운이 서로 부딪히며 마찰을 일으키는 관계로, 사소한 일에서 감정적 충돌이 반복될 수 있습니다. 서로의 말투나 행동에 예민해질 수 있으니, 감정이 격해질 때 잠시 거리를 두고 냉정히 생각하는 습관이 도움이 됩니다.`);
    }
    
    // 삼합 가능성 (두 사람이 삼합의 일부를 이룸)
    const triples = [
      [0, 4, 8],   // 신자진 수국
      [1, 5, 9],   // 사유축 금국
      [2, 6, 10],  // 인오술 화국
      [3, 7, 11]   // 해묘미 목국
    ];
    
    for (const triple of triples) {
      const has1 = triple.includes(branch1Idx);
      const has2 = triple.includes(branch2Idx);
      if (has1 && has2 && branch1Idx !== branch2Idx) {
        result.relations.push('triplePartial');
        result.score += BRANCH_COMPATIBILITY.TRIPLE_COMBINE / 2;
        result.descriptions.push(`두 사람의 일지가 삼합(三合)의 일부를 이루고 있습니다. 삼합은 세 지지가 하나의 오행으로 결합하는 강력한 조합으로, 두 사람이 같은 방향을 바라보며 함께 협력할 때 큰 시너지를 발휘할 수 있습니다. 공동 목표를 세우고 함께 노력하면 좋은 결과를 얻을 수 있는 관계입니다.`);
        break;
      }
    }
    
    // 관계가 없으면 기본 점수
    if (result.relations.length === 0) {
      result.descriptions.push('일지 사이에 합·충·형 등 특별한 작용이 없습니다. 이는 가정 내에서 큰 갈등이나 마찰 없이 평온한 관계를 유지하기 좋다는 의미입니다. 각자의 생활 리듬을 존중하며 자연스러운 관계를 만들어갈 수 있습니다.');
    }
    
    return result;
  }
  
  /**
   * 형살 체크
   */
  checkPunishment(idx1, idx2) {
    const punishments = [];
    
    // 삼형
    // 인사신형 (寅巳申)
    if ([2, 5, 8].includes(idx1) && [2, 5, 8].includes(idx2) && idx1 !== idx2) {
      punishments.push('인사신형');
    }
    // 축술미형 (丑戌未)
    if ([1, 7, 10].includes(idx1) && [1, 7, 10].includes(idx2) && idx1 !== idx2) {
      punishments.push('축술미형');
    }
    
    // 자묘형 (子卯刑)
    if ((idx1 === 0 && idx2 === 3) || (idx1 === 3 && idx2 === 0)) {
      punishments.push('자묘형');
    }
    
    // 자형 (自刑: 辰辰, 午午, 酉酉, 亥亥)
    if (idx1 === idx2 && [4, 6, 9, 11].includes(idx1)) {
      punishments.push('자형');
    }
    
    return punishments;
  }
  
  /**
   * 월주 궁합 분석
   */
  analyzeWolju(person1, person2) {
    const wolgan1 = person1.saju?.monthPillar?.stem || person1.monthPillar?.stem;
    const wolji1 = person1.saju?.monthPillar?.branch || person1.monthPillar?.branch;
    const wolgan2 = person2.saju?.monthPillar?.stem || person2.monthPillar?.stem;
    const wolji2 = person2.saju?.monthPillar?.branch || person2.monthPillar?.branch;
    
    const result = {
      pillars: [[wolgan1, wolji1], [wolgan2, wolji2]],
      score: 0,
      description: ''
    };
    
    // 월지 계절 비교
    const seasons = {
      '인': '봄', '묘': '봄', '진': '봄',
      '사': '여름', '오': '여름', '미': '여름',
      '신': '가을', '유': '가을', '술': '가을',
      '해': '겨울', '자': '겨울', '축': '겨울'
    };
    
    const season1 = seasons[wolji1];
    const season2 = seasons[wolji2];
    
    if (season1 === season2) {
      result.score += 5;
      result.description = `두 사람 모두 ${season1}에 태어났습니다. 월주는 부모궁이자 사회적 성격을 나타내는데, 같은 계절에 태어난 두 사람은 성장 배경이나 사회적 가치관이 비슷할 가능성이 높습니다. 가족 간의 관계나 사회생활에서의 태도가 유사하여 서로의 입장을 쉽게 이해할 수 있습니다.`;
    } else {
      // 계절 궁합
      const seasonCompat = {
        '봄_가을': -3,
        '여름_겨울': -3,
        '봄_여름': 3,
        '여름_가을': 3,
        '가을_겨울': 3,
        '겨울_봄': 3
      };

      const key1 = `${season1}_${season2}`;
      const key2 = `${season2}_${season1}`;
      const compat = seasonCompat[key1] || seasonCompat[key2] || 0;

      result.score += compat;
      if (compat > 0) {
        result.description = `${season1}과 ${season2}에 태어난 두 사람은 인접 계절로 기운이 자연스럽게 이어집니다. 서로 다른 면을 갖고 있으면서도 극단적인 차이는 아니어서, 적절한 다양성과 조화를 이룰 수 있는 관계입니다.`;
      } else if (compat < 0) {
        result.description = `${season1}과 ${season2}에 태어난 두 사람은 대칭되는 계절의 기운을 갖고 있습니다. 성장 환경이나 사회적 성향에 차이가 있을 수 있어, 서로의 관점을 이해하는 데 시간이 걸릴 수 있습니다. 하지만 이런 차이가 서로에게 새로운 시각과 자극을 줄 수 있는 장점도 있습니다.`;
      } else {
        result.description = `${season1}과 ${season2}에 태어난 두 사람입니다. 서로 다른 계절의 기운을 갖고 있어 가정이나 사회생활에서의 관점이 다를 수 있지만, 큰 충돌 없이 각자의 방식으로 조화를 이루어갈 수 있습니다.`;
      }
    }
    
    return result;
  }
  
  /**
   * 오행 밸런스 분석
   */
  analyzeOhengBalance(person1, person2) {
    const oheng1 = person1.oheng || {};
    const oheng2 = person2.oheng || {};
    
    const result = {
      person1Oheng: oheng1,
      person2Oheng: oheng2,
      complementary: [],
      score: 0,
      description: ''
    };
    
    // 각자 부족한 오행을 상대방이 채워주는지 체크
    const ohengList = ['목', '화', '토', '금', '수'];
    
    for (const oh of ohengList) {
      const val1 = oheng1[oh] || 0;
      const val2 = oheng2[oh] || 0;
      
      // 한쪽이 부족하고 다른 쪽이 발달한 경우
      if (val1 < THRESHOLDS.OHENG_WEAK && val2 > THRESHOLDS.OHENG_STRONG) {
        result.complementary.push({ element: oh, from: 'person2', to: 'person1' });
        result.score += 3;
      }
      if (val2 < THRESHOLDS.OHENG_WEAK && val1 > THRESHOLDS.OHENG_STRONG) {
        result.complementary.push({ element: oh, from: 'person1', to: 'person2' });
        result.score += 3;
      }
    }
    
    if (result.complementary.length > 0) {
      const elements = result.complementary.map(c => c.element).join(', ');
      result.description = `두 사람의 오행이 서로 보완하는 관계입니다 (${elements}). 한쪽이 부족한 기운을 상대방이 채워줄 수 있어, 함께할 때 각자 혼자 있을 때보다 더 안정적이고 균형 잡힌 에너지를 느낄 수 있습니다. 이는 장기적으로 건강, 성격, 운세 등 다양한 면에서 긍정적인 영향을 주고받을 수 있음을 의미합니다.`;
    } else {
      result.description = '두 사람의 오행 분포가 비슷하여 뚜렷한 보완 관계가 나타나지 않습니다. 이 경우 두 사람이 비슷한 강점과 약점을 공유할 수 있으며, 부족한 오행은 생활 습관이나 환경을 통해 함께 보완해나가는 것이 좋습니다.';
    }
    
    return result;
  }
  
  /**
   * 기타 관계 분석 (전체 4주 비교)
   */
  analyzeRelations(person1, person2) {
    const pillars1 = this.extractPillars(person1);
    const pillars2 = this.extractPillars(person2);
    
    const result = {
      stemRelations: [],
      branchRelations: [],
      score: 0
    };
    
    // 각 기둥 간의 관계 체크
    for (const p1 of pillars1) {
      for (const p2 of pillars2) {
        const stem1Idx = CHEONGAN.indexOf(p1.stem);
        const stem2Idx = CHEONGAN.indexOf(p2.stem);
        const branch1Idx = JIJI.indexOf(p1.branch);
        const branch2Idx = JIJI.indexOf(p2.branch);

        // 천간 관계
        const stemRels = RelationAnalyzer.checkStemPair(stem1Idx, stem2Idx);
        for (const stemRel of stemRels) {
          result.stemRelations.push({
            stems: [p1.stem, p2.stem],
            pillars: [p1.type, p2.type],
            relation: stemRel
          });
        }

        // 지지 관계
        const branchRels = RelationAnalyzer.checkBranchPair(branch1Idx, branch2Idx);
        for (const branchRel of branchRels) {
          result.branchRelations.push({
            branches: [p1.branch, p2.branch],
            pillars: [p1.type, p2.type],
            relation: branchRel
          });
        }
      }
    }
    
    // 점수 계산 (합은 +, 충/형은 -)
    for (const rel of result.stemRelations) {
      if (rel.relation.type === '합') result.score += 2;
      if (rel.relation.type === '충') result.score -= 1;
    }

    for (const rel of result.branchRelations) {
      if (rel.relation.type === '합') result.score += 2;
      if (rel.relation.type === '충') result.score -= 2;
      if (rel.relation.type === '형') result.score -= 1;
      if (rel.relation.type === '파') result.score -= 1;
      if (rel.relation.type === '해') result.score -= 1;
    }
    
    return result;
  }
  
  /**
   * 사주에서 4주 추출
   */
  extractPillars(person) {
    const saju = person.saju || person;
    const pillars = [];
    
    const pillarTypes = [
      { key: 'yearPillar', type: '년주' },
      { key: 'monthPillar', type: '월주' },
      { key: 'dayPillar', type: '일주' },
      { key: 'hourPillar', type: '시주' }
    ];
    
    for (const { key, type } of pillarTypes) {
      if (saju[key]) {
        pillars.push({
          type,
          stem: saju[key].stem,
          branch: saju[key].branch
        });
      }
    }
    
    return pillars;
  }
  
  /**
   * 점수 계산
   */
  calculateScores(result) {
    return {
      ilgan: Math.max(0, 50 + result.ilganAnalysis.score),
      ilji: Math.max(0, 50 + result.iljiAnalysis.score),
      wolju: Math.max(0, 50 + result.woljuAnalysis.score),
      oheng: Math.max(0, 50 + result.ohengAnalysis.score),
      relations: Math.max(0, 50 + result.relationAnalysis.score)
    };
  }
  
  /**
   * 총점 계산
   */
  calculateTotalScore(scores) {
    const weighted = 
      (scores.ilgan * GUNGHAP_WEIGHTS.ILGAN +
       scores.ilji * GUNGHAP_WEIGHTS.ILJI +
       scores.wolju * GUNGHAP_WEIGHTS.WOLJU +
       scores.oheng * GUNGHAP_WEIGHTS.OHENG_BALANCE +
       scores.relations * GUNGHAP_WEIGHTS.RELATION) / 100;
    
    return Math.round(weighted);
  }
  
  /**
   * 종합 해석 생성
   */
  generateInterpretation(result) {
    const score = result.totalScore;

    if (score >= 80) {
      return '천생연분에 해당하는 최상의 궁합입니다. 일간, 일지, 오행 등 주요 요소들이 조화롭게 어우러져 있어, 서로를 만났을 때 자연스럽게 끌리고 깊은 유대감을 느낄 수 있습니다. 결혼 생활에서도 서로를 이해하고 지지하며 함께 성장해나갈 수 있는 관계로, 평생의 동반자로서 최적의 조합입니다.';
    } else if (score >= 70) {
      return '좋은 궁합입니다. 전반적으로 서로에게 긍정적인 영향을 주며, 큰 갈등 없이 관계를 이어갈 수 있습니다. 서로의 장점을 인정하고 단점을 부드럽게 보완해주는 관계로, 함께하는 시간이 쌓일수록 더욱 단단한 신뢰를 쌓아갈 수 있습니다. 약간의 차이점은 관계에 활력을 더해줍니다.';
    } else if (score >= 60) {
      return '무난한 궁합입니다. 큰 문제 없이 관계를 유지할 수 있지만, 일부 영역에서는 의견 차이나 성향의 차이가 나타날 수 있습니다. 이 차이를 갈등의 원인이 아닌 서로를 이해하는 기회로 삼으면, 충분히 행복하고 안정적인 관계를 만들어갈 수 있습니다. 소통과 배려가 핵심입니다.';
    } else if (score >= 50) {
      return '보통 궁합입니다. 성향이나 가치관에서 차이가 있을 수 있어, 관계 초반에는 서로를 이해하는 데 시간이 필요합니다. 하지만 이러한 차이는 서로에게 새로운 관점을 제공하기도 합니다. 정기적인 대화와 서로의 다름을 존중하는 태도가 있다면 충분히 좋은 관계를 만들 수 있습니다.';
    } else {
      return '도전적인 궁합입니다. 두 사람 사이에 근본적인 성향 차이나 에너지의 충돌이 있을 수 있어, 관계를 유지하는 데 일반적인 경우보다 더 많은 노력이 필요합니다. 그러나 명리학에서 궁합은 운명이 아닌 참고 사항이며, 진심 어린 소통과 상호 존중이 뒷받침된다면 어떤 궁합도 극복할 수 있습니다.';
    }
  }
  
  /**
   * 조언 생성
   */
  generateAdvice(result) {
    const advice = [];

    // 일간 관계에 따른 조언
    if (result.ilganAnalysis.relation === 'combine') {
      advice.push('일간이 합하여 첫 만남부터 자연스러운 호감을 느낄 수 있습니다. 이 좋은 기운을 바탕으로 서로에 대한 신뢰를 꾸준히 쌓아가세요. 편안함에 안주하지 말고 함께 새로운 도전을 하면 관계가 더욱 깊어집니다.');
    } else if (result.ilganAnalysis.relation === 'clash') {
      advice.push('일간이 충하여 가치관이나 행동 방식에 차이가 있을 수 있습니다. 상대의 의견에 즉각 반박하기보다 먼저 경청하고 이해하려는 자세가 중요합니다. 서로 다른 점이 오히려 보완이 될 수 있음을 기억하세요.');
    } else if (result.ilganAnalysis.relation === 'generate' || result.ilganAnalysis.relation === 'generated') {
      advice.push('일간이 상생 관계로 서로 도움을 주고받을 수 있습니다. 도움을 주는 쪽은 과도한 헌신을 조심하고, 받는 쪽은 감사를 표현하는 습관을 들이면 더 건강한 관계가 됩니다.');
    }

    // 일지 관계에 따른 조언
    if (result.iljiAnalysis.relations.includes('sixCombine')) {
      advice.push('일지 육합은 결혼 궁합에서 가장 이상적인 조합입니다. 가정 내에서 자연스러운 조화를 이루며, 서로에 대한 헌신과 배려가 깊어질수록 더욱 행복한 가정을 꾸릴 수 있습니다.');
    } else if (result.iljiAnalysis.relations.includes('clash')) {
      advice.push('일지 충이 있어 가정생활에서 생활 방식의 차이로 마찰이 생길 수 있습니다. 각자의 개인 공간과 취미 활동을 존중하고, 가사 분담이나 생활 규칙을 미리 정해두면 갈등을 줄일 수 있습니다.');
    } else if (result.iljiAnalysis.relations.includes('triplePartial')) {
      advice.push('일지가 삼합의 일부를 이루어 공동의 목표를 향해 함께 나아가기 좋은 관계입니다. 함께 할 수 있는 취미나 프로젝트를 찾으면 관계가 더 깊어집니다.');
    }

    // 오행 보완 조언
    if (result.ohengAnalysis.complementary.length > 0) {
      const elements = result.ohengAnalysis.complementary.map(c => c.element).join(', ');
      advice.push(`두 분의 오행이 서로 보완되어(${elements}) 함께할 때 에너지의 균형이 맞춰집니다. 상대에게서 자신에게 부족한 기운을 자연스럽게 받을 수 있으니, 서로의 존재 자체가 큰 힘이 됩니다.`);
    }

    // 월주 조언
    if (result.woljuAnalysis && result.woljuAnalysis.score < 0) {
      advice.push('월주의 계절이 대칭되어 성장 배경이나 가정관의 차이가 있을 수 있습니다. 서로의 가족 문화를 이해하고 존중하는 태도가 중요합니다.');
    }

    // 기본 조언
    if (advice.length === 0) {
      advice.push('명리학적으로 특별히 강한 길흉 작용이 없는 관계입니다. 이는 두 사람이 자유롭게 관계를 설계해나갈 수 있다는 의미이기도 합니다. 서로에 대한 관심과 배려, 진솔한 대화가 좋은 관계의 가장 확실한 토대입니다.');
    }

    return advice;
  }
}

/**
 * 궁합 결과 포맷터
 */
export class GunghapFormatter {
  /**
   * 점수를 등급으로 변환
   */
  static scoreToGrade(score) {
    if (score >= 80) return { grade: 'S', label: '천생연분', color: '#FF6B6B' };
    if (score >= 70) return { grade: 'A', label: '좋은 궁합', color: '#4ECDC4' };
    if (score >= 60) return { grade: 'B', label: '무난한 궁합', color: '#45B7D1' };
    if (score >= 50) return { grade: 'C', label: '보통', color: '#96CEB4' };
    return { grade: 'D', label: '노력 필요', color: '#DDA0DD' };
  }
  
  /**
   * 퍼센트 바 HTML 생성
   */
  static renderScoreBar(score, maxScore = 100) {
    const percentage = Math.min(100, Math.round((score / maxScore) * 100));
    const grade = this.scoreToGrade(score);
    
    return `
      <div class="score-bar-container">
        <div class="score-bar" style="width: ${percentage}%; background-color: ${grade.color};"></div>
        <span class="score-label">${score}점</span>
      </div>
    `;
  }
  
  /**
   * 궁합 관계 아이콘
   */
  static relationIcon(relation) {
    const icons = {
      combine: '💕',
      sixCombine: '💑',
      tripleCombine: '🤝',
      clash: '⚡',
      punishment: '🔥',
      generate: '🌱',
      overcome: '⚔️',
      same: '👯',
      neutral: '➖'
    };
    
    return icons[relation] || '❓';
  }
}

export default GunghapAnalyzer;
