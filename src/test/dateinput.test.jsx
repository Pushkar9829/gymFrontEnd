import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Input, parseDmy } from '../components/ui';

afterEach(cleanup);

describe('date box (dd/mm/yyyy)', () => {
  it('parses Indian date order and rejects impossible dates', () => {
    expect(parseDmy('05/10/2026')).toBe('2026-10-05');
    expect(parseDmy('5-1-2026')).toBe('2026-01-05');
    expect(parseDmy('29.02.2024')).toBe('2024-02-29');
    expect(parseDmy('31/02/2026')).toBeNull();
    expect(parseDmy('2026-10-05')).toBeNull();
    expect(parseDmy('')).toBeNull();
  });

  it('shows the value as dd/mm/yyyy and reports yyyy-mm-dd back', () => {
    const onChange = vi.fn();
    render(<Input type="date" value="2026-10-05" onChange={onChange} />);
    const box = screen.getByPlaceholderText('dd/mm/yyyy');
    expect(box).toHaveValue('05/10/2026');
    fireEvent.change(box, { target: { value: '12/11/2026' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: '2026-11-12' }) }));
  });

  it('does not accept a date after max, and flags it', () => {
    const onChange = vi.fn();
    render(<Input type="date" value="" max="2026-10-12" onChange={onChange} />);
    const box = screen.getByPlaceholderText('dd/mm/yyyy');
    fireEvent.change(box, { target: { value: '13/10/2026' } });
    fireEvent.blur(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('clearing the box clears the value', () => {
    const onChange = vi.fn();
    render(<Input type="date" value="2026-10-05" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('dd/mm/yyyy'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: '' }) }));
  });
});
