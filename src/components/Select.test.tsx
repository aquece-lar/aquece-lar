import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Beta' },
];

describe('Select', () => {
  it('abre a lista, escolhe com o mouse e fecha', async () => {
    const onChange = vi.fn();
    render(<Select value="a" options={options} onChange={onChange} aria-label="Letra" />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Letra' }));
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('funciona pelo teclado', async () => {
    const onChange = vi.fn();
    render(<Select value="a" options={options} onChange={onChange} aria-label="Letra" />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
