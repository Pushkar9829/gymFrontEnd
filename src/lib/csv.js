/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Returns array of string arrays. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const HEADER_ALIASES = {
  name: ['name', 'full name', 'member name'],
  phone: ['phone', 'mobile', 'phone number', 'mobile number', 'contact'],
  email: ['email', 'email id', 'e-mail'],
  gender: ['gender', 'sex'],
  dob: ['dob', 'date of birth', 'birthday'],
  address: ['address'],
};

/** Maps CSV rows (first row = header) to member objects and validation errors. */
export function csvToMembers(text) {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { members: [], errors: ['The file is empty'] };
  const idx = {};
  header.forEach((h, i) => {
    const key = Object.keys(HEADER_ALIASES).find((k) => HEADER_ALIASES[k].includes(h.trim().toLowerCase()));
    if (key && idx[key] === undefined) idx[key] = i;
  });
  if (idx.name === undefined || idx.phone === undefined) return { members: [], errors: ['The file needs "name" and "phone" columns'] };

  const members = [];
  const errors = [];
  lines.forEach((cells, n) => {
    const get = (k) => (idx[k] === undefined ? '' : (cells[idx[k]] || '').trim());
    const phone = get('phone').replace(/[\s-]/g, '');
    const m = { name: get('name'), phone };
    if (!m.name || !/^\+?\d{10,13}$/.test(phone)) {
      errors.push(`Row ${n + 2}: missing name or invalid phone`);
      return;
    }
    const email = get('email');
    if (email) m.email = email;
    const gender = get('gender').toLowerCase();
    if (['male', 'female', 'other'].includes(gender)) m.gender = gender;
    else if (gender === 'm') m.gender = 'male';
    else if (gender === 'f') m.gender = 'female';
    const dob = get('dob');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) m.dob = dob;
    else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dob)) {
      const [d, mo, y] = dob.split(/[-/]/);
      m.dob = `${y}-${mo}-${d}`;
    }
    const address = get('address');
    if (address) m.address = address;
    members.push(m);
  });
  return { members, errors };
}
