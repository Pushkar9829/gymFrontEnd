import { describe, expect, it } from 'vitest';
import { inr, toPaise, toRupees, initials } from '../lib/format';

describe('money helpers (API uses paise)', () => {
  it('converts rupees <-> paise without float errors', () => {
    expect(toPaise('1499.99')).toBe(149999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toRupees(149999)).toBe(1499.99);
  });
  it('formats INR', () => {
    expect(inr(12345600)).toBe('₹1,23,456');
  });
  it('builds initials', () => {
    expect(initials('rahul kumar sharma')).toBe('RK');
  });
});
