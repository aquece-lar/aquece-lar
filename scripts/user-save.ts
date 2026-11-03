/**
 * Cria um usuário ou troca a senha de um existente (pelo e-mail). Pede a senha
 * no terminal, sem mostrar; também aceita a senha pela entrada padrão.
 *   npm run user:save -- email@exemplo.com "Nome da Pessoa"
 *   npm run user:save -- email@exemplo.com --remove
 */
import { createInterface } from 'node:readline';
import { hashPassword } from '../api/_lib/auth.js';
import { db } from '../api/_lib/db.js';

const [email, name] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npm run user:save -- email@exemplo.com "Nome da Pessoa"');
  process.exit(1);
}

if (name === '--remove') {
  const rows = await db()`delete from users where lower(email) = lower(${email}) returning id`;
  console.log(rows.length ? `Usuário ${email} removido.` : `Não há usuário ${email}.`);
  process.exit(0);
}

function askPassword(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      process.stdout.write(question);
      // Esconde o que é digitado.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
    }
    rl.question(process.stdin.isTTY ? '' : question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const password = await askPassword('Senha (mínimo 8 caracteres): ');
if (password.length < 8) {
  console.error('A senha precisa ter ao menos 8 caracteres.');
  process.exit(1);
}
if (process.stdin.isTTY && (await askPassword('Repita a senha: ')) !== password) {
  console.error('As senhas não conferem.');
  process.exit(1);
}

const hash = await hashPassword(password);
const [existing] = await db()`select id from users where lower(email) = lower(${email})`;
if (existing) {
  await db()`update users set password_hash = ${hash}, name = coalesce(${name ?? null}, name) where id = ${existing.id}`;
  // Senha nova derruba as sessões abertas.
  await db()`delete from sessions where user_id = ${existing.id}`;
  console.log(`Senha de ${email} atualizada.`);
} else {
  if (!name) {
    console.error('Para criar, informe também o nome: npm run user:save -- email@exemplo.com "Nome"');
    process.exit(1);
  }
  await db()`insert into users (email, name, password_hash) values (${email.trim()}, ${name.trim()}, ${hash})`;
  console.log(`Usuário ${email} criado.`);
}
