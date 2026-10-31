# Aquece Lar — API (PHP)

API REST em PHP puro (8.1+) com MySQL 8, sem framework nem Composer. Segue o contrato em [../docs/api-contrato.md](../docs/api-contrato.md): JSON em camelCase, ids em string, erros `{ "error", "message" }`.

## Rodar

```bash
cp .env.example .env        # ajuste DB_* e CORS_ORIGIN
php bin/migrate.php         # cria o banco e as tabelas
php bin/seed.php            # (opcional) vendedores, clientes e produtos de exemplo
php -S localhost:8000 -t public public/index.php
```

Em Apache, aponte o `DocumentRoot` para `public/` (o `.htaccess` já direciona tudo para `index.php`). Se a API ficar em um subcaminho, defina `BASE_PATH` (ex.: `/api`).

## Endpoints

| Recurso | Rotas |
|---|---|
| Vendedores | `GET/POST /sellers`, `GET/PUT/DELETE /sellers/:id` |
| Clientes | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id` |
| Orçamentos | `GET /quotes?from=&to=`, `POST /quotes`, `GET/PUT/DELETE /quotes/:id`, `POST /quotes/:id/status` |
| Saúde | `GET /health` |

Regras principais (todas do contrato): o total do orçamento é sempre recalculado no servidor; só orçamentos `Pendente` são editáveis; as transições de status são validadas; código de produto é único sem diferenciar maiúsculas; vendedor ou cliente com orçamentos não pode ser excluído.

Além do contrato: `DELETE /quotes/:id` (só `Pendente` ou `Cancelado`, senão 409 `quote_not_deletable`) e `channel: "whatsapp"` opcional em `POST /quotes/:id/status`, que só muda o texto do histórico — a API não envia mensagens.

## Ainda fora

Dashboard (`GET /dashboard`) e autenticação. Hoje qualquer cliente que alcance a API pode ler e alterar tudo; não publique sem definir o login.

## Teste

Com a API rodando em um banco de desenvolvimento:

```bash
php tests/smoke.php http://localhost:8000
```
