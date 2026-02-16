/**
 * dom.js — DOM utility helpers
 */

export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

export function setInnerHTML(el, html) {
  if (typeof el === 'string') el = document.querySelector(el);
  if (el) el.innerHTML = html;
}

export function show(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = '';
}

export function hide(el) {
  if (typeof el === 'string') el = $(el);
  if (el) el.style.display = 'none';
}
