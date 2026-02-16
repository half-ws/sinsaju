/**
 * format.js — Korean formatting helpers for Saju pillars
 */

const CHEONGAN_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const JIJI_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const CHEONGAN_HJ = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const JIJI_HJ = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export function formatPillar(idx60) {
  const stem = idx60 % 10;
  const branch = idx60 % 12;
  return {
    kr: CHEONGAN_KR[stem] + JIJI_KR[branch],
    hanja: CHEONGAN_HJ[stem] + JIJI_HJ[branch],
    stemIdx: stem,
    branchIdx: branch,
  };
}

export function formatDate(year, month, day, hour, minute) {
  let s = `${year}년 ${month}월 ${day}일`;
  if (hour !== null && hour !== undefined) {
    s += ` ${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`;
  }
  return s;
}

export function ohengName(idx) {
  return ['목', '화', '토', '금', '수'][idx];
}
