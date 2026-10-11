import { describe, expect, it } from 'vitest';
import { parseCsv, csvToMembers } from '../lib/csv';

describe('parseCsv', () => {
  it('handles quotes, commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
  });
  it('skips blank lines and BOM', () => {
    expect(parseCsv('﻿name\n\nRam\n')).toEqual([['name'], ['Ram']]);
  });
});

describe('csvToMembers', () => {
  it('maps header aliases and normalises values', () => {
    const { members, errors } = csvToMembers('Full Name,Mobile,Email,Sex,DOB\nRam,98765 43210,r@x.com,M,12-04-1995\nBad,123,,,\n');
    expect(members).toEqual([{ name: 'Ram', phone: '9876543210', email: 'r@x.com', gender: 'male', dob: '1995-04-12' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 3/);
  });
  it('requires name and phone columns', () => {
    expect(csvToMembers('email\na@b.com').errors[0]).toMatch(/name/);
  });
});
