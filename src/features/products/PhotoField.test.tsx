import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PhotoField } from './PhotoField';

function Harness({ initial = [] as string[] }) {
  const [photos, setPhotos] = useState(initial);
  return <PhotoField photos={photos} onChange={setPhotos} />;
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('PhotoField', () => {
  it('adiciona várias fotos de uma vez, e a primeira vira a capa', async () => {
    render(<Harness />);
    await userEvent.upload(screen.getByLabelText('Selecionar fotos'), [png('a.png'), png('b.png')]);
    expect(await screen.findByAltText('Foto 2')).toBeInTheDocument();
    expect(screen.getByText('Capa')).toBeInTheDocument();
    expect(screen.getByText('2/8 · JPG, PNG ou WebP')).toBeInTheDocument();
  });

  it('remove uma foto e troca a capa', async () => {
    render(<Harness initial={['data:image/png;base64,AAA', 'data:image/png;base64,BBB']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tornar capa' }));
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', 'data:image/png;base64,BBB');
    await userEvent.click(screen.getByRole('button', { name: 'Remover foto 1' }));
    expect(screen.queryByAltText('Foto 2')).not.toBeInTheDocument();
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', 'data:image/png;base64,AAA');
  });

  it('recusa arquivos que não são imagem', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Selecionar fotos');
    await userEvent.upload(input, new File(['x'], 'a.pdf', { type: 'application/pdf' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('Só imagens são aceitas.');
  });
});
