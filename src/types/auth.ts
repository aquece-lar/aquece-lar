/** Quem está conectado: vem da API (cookie de sessão) ou da conta fictícia nos testes. */
export interface Session {
  email: string;
  name: string;
}
