import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UsersSection } from './UsersSection';

async function renderSection() {
  const user = userEvent.setup();
  render(<UsersSection />);
  const list = await screen.findByRole('list', { name: 'Lista de usuários' });
  return { user, list };
}

describe('UsersSection', () => {
  it('lista quem pode entrar e marca a própria conta', async () => {
    const { list } = await renderSection();
    const me = within(list).getByText('Administrador').closest('li')!;
    expect(within(me).getByText('você')).toBeInTheDocument();
    expect(within(me).getByText('admin@aquecelar.com.br')).toBeInTheDocument();
    expect(within(me).getByText('Nunca entrou')).toBeInTheDocument();
  });

  it('cadastra um usuário, conferindo a senha', async () => {
    const { user, list } = await renderSection();
    await user.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });

    await user.type(within(dialog).getByLabelText(/^Nome */), 'Luis Poletto');
    await user.type(within(dialog).getByLabelText(/E-mail/), 'luis@exemplo.com');
    await user.type(within(dialog).getByLabelText(/^Senha */), 'curta');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('A senha precisa ter ao menos 8 caracteres.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Senha */), '-e-longa');
    await user.type(within(dialog).getByLabelText(/^Repita a senha */), 'outra-senha');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('As senhas não conferem.')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/^Repita a senha */));
    await user.type(within(dialog).getByLabelText(/^Repita a senha */), 'curta-e-longa');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(list).findByText('Luis Poletto')).toBeInTheDocument();
    expect(within(list).getByText('luis@exemplo.com')).toBeInTheDocument();
  });

  it('recusa e-mail já usado', async () => {
    const { user } = await renderSection();
    await user.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });
    await user.type(within(dialog).getByLabelText(/^Nome */), 'Outro Admin');
    await user.type(within(dialog).getByLabelText(/E-mail/), 'ADMIN@aquecelar.com.br');
    await user.type(within(dialog).getByLabelText(/^Senha */), 'senha-boa-1');
    await user.type(within(dialog).getByLabelText(/^Repita a senha */), 'senha-boa-1');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Já existe um usuário com o e-mail');
  });

  it('edita sem trocar a senha quando ela fica vazia', async () => {
    const { user, list } = await renderSection();
    await user.click(within(list).getByRole('button', { name: 'Ações de Luis Poletto' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(dialog).getByLabelText(/^Repita a senha/)).toBeDisabled();

    await user.clear(within(dialog).getByLabelText(/^Nome */));
    await user.type(within(dialog).getByLabelText(/^Nome */), 'Luis P.');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(list).findByText('Luis P.')).toBeInTheDocument();
  });

  it('não deixa excluir a própria conta, mas exclui as outras', async () => {
    const { user, list } = await renderSection();
    await user.click(within(list).getByRole('button', { name: 'Ações de Administrador' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    let dialog = await screen.findByRole('dialog', { name: 'Excluir usuário' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Você não pode excluir a sua própria conta.');
    // O "Fechar" do rodapé (o outro é o X do topo).
    await user.click(within(dialog).getAllByRole('button', { name: 'Fechar' }).at(-1)!);

    await user.click(within(list).getByRole('button', { name: 'Ações de Luis P.' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    dialog = await screen.findByRole('dialog', { name: 'Excluir usuário' });
    await user.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(within(list).queryByText('Luis P.')).not.toBeInTheDocument());
  });
});
