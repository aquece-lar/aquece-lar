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

/** Linha da lista pelo e-mail (o nome "Administrador" também é o nome do perfil). */
function row(list: HTMLElement, email: string): HTMLElement {
  return within(list).getByText(email).closest('li')!;
}

describe('UsersSection', () => {
  it('lista quem pode entrar, com o perfil, e marca a própria conta', async () => {
    const { list } = await renderSection();
    const me = row(list, 'admin@aquecelar.com.br');
    expect(within(me).getByText('você')).toBeInTheDocument();
    expect(within(me).getAllByText('Administrador')).toHaveLength(2);
    expect(within(me).getByText('Nunca entrou')).toBeInTheDocument();

    const seller = row(list, 'carlos.menezes@aquecelar.com.br');
    expect(within(seller).getByText('Vendedor')).toBeInTheDocument();
    // O nome do usuário e o vendedor ligado (o mesmo cadastro).
    expect(within(seller).getAllByText('Carlos Menezes')).toHaveLength(2);
    expect(within(row(list, 'gerente@aquecelar.com.br')).getByText('Gerente')).toBeInTheDocument();
  });

  it('cadastra um vendedor, conferindo a senha e o vendedor ligado', async () => {
    const { user, list } = await renderSection();
    await user.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });

    await user.type(within(dialog).getByLabelText(/^Nome */), 'Luis Poletto');
    await user.type(within(dialog).getByLabelText(/E-mail/), 'luis@exemplo.com');
    await user.type(within(dialog).getByLabelText(/^Senha */), 'curta');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('A senha precisa ter ao menos 8 caracteres.')).toBeInTheDocument();
    // Novo usuário começa como vendedor, que precisa do cadastro de vendedor.
    expect(within(dialog).getByText('Escolha o vendedor ligado a este usuário.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Senha */), '-e-longa');
    await user.type(within(dialog).getByLabelText(/^Repita a senha */), 'outra-senha');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(within(dialog).getByText('As senhas não conferem.')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/^Repita a senha */));
    await user.type(within(dialog).getByLabelText(/^Repita a senha */), 'curta-e-longa');
    await user.click(within(dialog).getByRole('combobox', { name: /vendedor ligado/i }));
    await user.click(await screen.findByRole('option', { name: 'Patrícia Lima' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /ver orçamentos, clientes e dashboard de todos/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const luis = await waitFor(() => row(list, 'luis@exemplo.com'));
    expect(within(luis).getByText('Luis Poletto')).toBeInTheDocument();
    expect(within(luis).getByText('Vendedor')).toBeInTheDocument();
    expect(within(luis).getByText('Patrícia Lima · vê todos')).toBeInTheDocument();
  });

  it('gerente e administrador não têm vendedor ligado nem permissões de vendedor', async () => {
    const { user } = await renderSection();
    await user.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });
    expect(within(dialog).getByRole('combobox', { name: /vendedor ligado/i })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('combobox', { name: /perfil/i }));
    await user.click(await screen.findByRole('option', { name: 'Gerente' }));
    expect(within(dialog).queryByRole('combobox', { name: /vendedor ligado/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Tudo, menos usuários e configurações/)).toBeInTheDocument();
  });

  it('não deixa mudar o próprio perfil', async () => {
    const { user, list } = await renderSection();
    await user.click(within(row(list, 'admin@aquecelar.com.br')).getByRole('button', { name: 'Ações de Administrador' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(dialog).getByRole('combobox', { name: /perfil/i })).toBeDisabled();
    expect(within(dialog).getByText('Você não pode mudar o seu próprio perfil.')).toBeInTheDocument();
  });

  it('recusa e-mail já usado', async () => {
    const { user } = await renderSection();
    await user.click(screen.getByRole('button', { name: 'Novo usuário' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });
    await user.click(within(dialog).getByRole('combobox', { name: /perfil/i }));
    await user.click(await screen.findByRole('option', { name: 'Administrador' }));
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
    // O perfil e as permissões voltam como estavam.
    expect(within(dialog).getByRole('checkbox', { name: /de todos/i })).toBeChecked();

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
