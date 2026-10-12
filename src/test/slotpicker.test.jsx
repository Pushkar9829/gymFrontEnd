import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SlotPicker, { BookingBadge } from '../components/SlotPicker';

afterEach(cleanup);

const at = (h) => new Date(2026, 9, 13, h, 0, 0).toISOString();
const days = [
  { day: '2026-10-12', slots: [] },
  { day: '2026-10-13', slots: [{ startsAt: at(7), endsAt: at(8), free: false }, { startsAt: at(8), endsAt: at(9), free: true }] },
  { day: '2026-10-14', slots: [{ startsAt: new Date(2026, 9, 14, 6).toISOString(), endsAt: new Date(2026, 9, 14, 7).toISOString() }] },
];

describe('PT slot picker', () => {
  it('skips days without free slots, greys out taken ones and returns the chosen start time', () => {
    const onChange = vi.fn();
    render(<SlotPicker days={days} value="" onChange={onChange} />);
    // 12 Oct has nothing free: the first day shown and selected is 13 Oct
    expect(screen.queryByText('12 Oct')).toBeNull();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('13 Oct');
    const [taken, free] = screen.getAllByRole('button', { name: /AM/ });
    expect(taken).toBeDisabled();
    fireEvent.click(free);
    expect(onChange).toHaveBeenCalledWith(at(8));
    fireEvent.click(screen.getByRole('tab', { name: /14 Oct/ }));
    expect(screen.getByRole('button', { name: '06:00 AM' })).toBeEnabled();
  });

  it('shows a message when nothing is free', () => {
    render(<SlotPicker days={[{ day: '2026-10-12', slots: [] }]} onChange={() => {}} empty="No free slots this week" />);
    expect(screen.getByText('No free slots this week')).toBeInTheDocument();
  });

  it('labels booking states in plain words', () => {
    render(<BookingBadge status="no-show" />);
    expect(screen.getByText('No-show')).toBeInTheDocument();
  });
});
