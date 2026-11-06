import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types/products';
import { PhotoViewer } from './PhotoViewer';

const product: Product = {
  id: 'p1',
  code: 'BLR-200',
  description: 'Boiler de acumulação 200 L',
  category: 'Boilers',
  status: 'Ativo',
  unitPrice: 3790,
  photos: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB', 'data:image/png;base64,CCC'],
};

describe('PhotoViewer', () => {
  it('mostra a capa e passa pelas fotos com as setas, o teclado e as miniaturas', async () => {
    const user = userEvent.setup();
    render(<PhotoViewer product={product} onClose={vi.fn()} />);
    const photo = () => screen.getByRole('img', { name: /^Foto \d de 3$/ });
    expect(photo()).toHaveAccessibleName('Foto 1 de 3');

    await user.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(photo()).toHaveAccessibleName('Foto 2 de 3');
    await user.keyboard('{ArrowRight}');
    expect(photo()).toHaveAccessibleName('Foto 3 de 3');
    await user.click(screen.getByRole('button', { name: 'Próxima foto' }));
    expect(photo()).toHaveAccessibleName('Foto 1 de 3');
    await user.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(photo()).toHaveAccessibleName('Foto 3 de 3');

    await user.click(screen.getByRole('button', { name: 'Ver foto 2' }));
    expect(photo()).toHaveAccessibleName('Foto 2 de 3');
  });

  it('com uma foto só, não mostra setas nem miniaturas', () => {
    render(<PhotoViewer product={{ ...product, photos: [product.photos![0]!] }} onClose={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Foto 1 de 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima foto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Todas as fotos' })).not.toBeInTheDocument();
  });
});
