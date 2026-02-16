/**
 * form-handler.js — Form input handling and validation
 */

export class FormHandler {
  constructor(formEl, onSubmit) {
    this.form = typeof formEl === 'string'
      ? document.getElementById(formEl)
      : formEl;
    this.onSubmit = onSubmit;
    this._bind();
  }

  _bind() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = this.getData();
      if (data) this.onSubmit(data);
    });
  }

  getData() {
    const year = parseInt(document.getElementById('in-year').value);
    const month = parseInt(document.getElementById('in-month').value);
    const day = parseInt(document.getElementById('in-day').value);
    const hourVal = document.getElementById('in-hour').value;
    const minVal = document.getElementById('in-min').value;
    const hour = hourVal !== '' ? parseInt(hourVal) : null;
    const minute = minVal !== '' ? parseInt(minVal) : 0;
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'm';
    const calendar = document.querySelector('input[name="calendar"]:checked')?.value || 'solar';
    const longitude = parseFloat(document.getElementById('in-longitude').value) || 127.0;

    // Validate required fields
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      alert('생년월일을 입력해주세요.');
      return null;
    }
    if (year < 1900 || year > 2100) {
      alert('년도 범위: 1900-2100');
      return null;
    }
    if (month < 1 || month > 12) {
      alert('월 범위: 1-12');
      return null;
    }
    if (day < 1 || day > 31) {
      alert('일 범위: 1-31');
      return null;
    }

    return { year, month, day, hour, minute, gender, calendar, longitude };
  }
}
