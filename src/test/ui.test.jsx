import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, Button, Toggle, Pagination } from '../components/ui';

describe('ui components', () => {
  it('Badge shows the human label for a membership status', () => {
    render(<Badge status="expired" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
  it('Button is disabled while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
  it('Toggle calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Block on dues" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('Pagination moves to the next page', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pages={3} total={50} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
