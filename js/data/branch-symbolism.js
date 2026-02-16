/**
 * ===================================================================
 * sinsaju-calculator - Branch Symbolism (지지 상징)
 * ===================================================================
 * Descriptive symbolism for each of the 12 earthly branches.
 *
 * This is a pure data file separate from branch-profile.js, which
 * holds computational data (oheng ratios, hidden stems, etc.).
 * This file provides human-readable descriptions, keywords, and
 * cultural associations for UI display and interpretation.
 *
 * Each branch entry includes:
 *   - emoji: zodiac animal emoji
 *   - element: primary oheng element
 *   - animal: Korean name of zodiac animal
 *   - direction: compass direction
 *   - time: 시진 (traditional 2-hour time block)
 *   - month: corresponding lunar month
 *   - movement: qualitative description of the branch's energy
 *   - keyword: array of key concept words
 *   - doHwaNote / hwaGaeNote / yeokMaNote: role-specific annotation
 */

export const BRANCH_SYMBOLISM = {
  자: {
    emoji: '🐭',
    element: '수',
    animal: '쥐',
    direction: '북',
    time: '23:00~01:00',
    month: '음력 11월',
    movement: '고요한 시작의 에너지. 모든 것의 씨앗이 잠들어 있는 자정의 기운.',
    keyword: ['시작', '잠재력', '은밀', '직관'],
    doHwaNote: '가장 깊은 매력. 보이지 않는 곳에서 끌어당기는 힘.',
  },
  축: {
    emoji: '🐮',
    element: '토',
    animal: '소',
    direction: '북동',
    time: '01:00~03:00',
    month: '음력 12월',
    movement: '겨울의 저장고. 에너지를 모아 봄을 준비하는 인내의 기운.',
    keyword: ['인내', '저장', '축적', '기다림'],
    hwaGaeNote: '깊은 내면의 성찰. 경험을 쌓아 지혜로 전환하는 힘.',
  },
  인: {
    emoji: '🐯',
    element: '목',
    animal: '호랑이',
    direction: '동북',
    time: '03:00~05:00',
    month: '음력 1월',
    movement: '봄의 시작, 역동적 출발. 새로운 세상으로 달려가는 기운.',
    keyword: ['추진', '도전', '용기', '이동'],
    yeokMaNote: '가장 강한 이동 에너지. 현실을 바꾸려는 행동력.',
  },
  묘: {
    emoji: '🐰',
    element: '목',
    animal: '토끼',
    direction: '동',
    time: '05:00~07:00',
    month: '음력 2월',
    movement: '봄의 정점. 만물이 가장 활발하게 피어나는 순수한 목의 기운.',
    keyword: ['성장', '꽃', '감성', '매력'],
    doHwaNote: '드러나는 매력. 사람을 끄는 자연스러운 아름다움.',
  },
  진: {
    emoji: '🐲',
    element: '토',
    animal: '용',
    direction: '동남',
    time: '07:00~09:00',
    month: '음력 3월',
    movement: '봄의 마무리 저장고. 목의 에너지를 흙으로 전환하는 변환의 기운.',
    keyword: ['변화', '저장', '전환', '잠재'],
    hwaGaeNote: '거대한 가능성의 저장소. 뭘 꺼내느냐에 따라 결과가 달라짐.',
  },
  사: {
    emoji: '🐍',
    element: '화',
    animal: '뱀',
    direction: '남동',
    time: '09:00~11:00',
    month: '음력 4월',
    movement: '여름의 시작. 지혜롭게 움직이며 새로운 영역을 개척하는 기운.',
    keyword: ['지혜', '전략', '변신', '이동'],
    yeokMaNote: '은밀한 이동. 계산된 움직임으로 목표를 향해 나아감.',
  },
  오: {
    emoji: '🐴',
    element: '화',
    animal: '말',
    direction: '남',
    time: '11:00~13:00',
    month: '음력 5월',
    movement: '여름의 정점. 가장 뜨겁고 활발한 에너지의 절정.',
    keyword: ['열정', '표현', '활동', '빛'],
    doHwaNote: '가장 눈에 띄는 매력. 무대 위의 주인공 같은 존재감.',
  },
  미: {
    emoji: '🐏',
    element: '토',
    animal: '양',
    direction: '남서',
    time: '13:00~15:00',
    month: '음력 6월',
    movement: '여름의 마무리. 열기를 부드럽게 수렴하며 결실을 준비하는 기운.',
    keyword: ['수렴', '온화', '포용', '결실'],
    hwaGaeNote: '따뜻한 마무리. 열정을 현실적 성과로 전환하는 지혜.',
  },
  신: {
    emoji: '🐵',
    element: '금',
    animal: '원숭이',
    direction: '서남',
    time: '15:00~17:00',
    month: '음력 7월',
    movement: '가을의 시작. 날카롭게 판단하며 새로운 질서를 만드는 기운.',
    keyword: ['판단', '결단', '영리', '이동'],
    yeokMaNote: '빠른 판단과 이동. 기회를 포착하면 즉시 행동.',
  },
  유: {
    emoji: '🐔',
    element: '금',
    animal: '닭',
    direction: '서',
    time: '17:00~19:00',
    month: '음력 8월',
    movement: '가을의 정점. 가장 순수한 금의 기운으로 정리하고 완성하는 에너지.',
    keyword: ['완성', '정리', '세련', '예리'],
    doHwaNote: '세련된 매력. 날카로운 감각과 미적 완성도.',
  },
  술: {
    emoji: '🐶',
    element: '토',
    animal: '개',
    direction: '서북',
    time: '19:00~21:00',
    month: '음력 9월',
    movement: '가을의 마무리 저장고. 금의 열매를 거둬들이는 충성의 기운.',
    keyword: ['충성', '수호', '마무리', '의리'],
    hwaGaeNote: '가장 강한 수호 에너지. 소중한 것을 끝까지 지키는 힘.',
  },
  해: {
    emoji: '🐷',
    element: '수',
    animal: '돼지',
    direction: '북서',
    time: '21:00~23:00',
    month: '음력 10월',
    movement: '겨울의 시작. 풍요로운 에너지로 새로운 순환을 준비하는 기운.',
    keyword: ['풍요', '관대', '순환', '이동'],
    yeokMaNote: '느긋하지만 꾸준한 이동. 넓은 세계를 향한 탐험.',
  }
};
