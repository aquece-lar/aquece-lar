<?php

declare(strict_types=1);

// Teste de ponta a ponta contra uma API em execução. Cria registros próprios (códigos únicos
// por rodada); use um banco de desenvolvimento, não o de produção.
// Uso: php tests/smoke.php [http://localhost:8000]

$base = rtrim($argv[1] ?? 'http://localhost:8000', '/');
$failures = 0;
$checks = 0;

/** @return array{int,mixed} */
function call(string $method, string $path, ?array $body = null): array
{
    global $base;
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body),
    ]);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

    return [$status, $raw === '' ? null : json_decode($raw, true)];
}

function check(string $name, mixed $actual, mixed $expected): void
{
    global $failures, $checks;
    $checks++;
    if (json_encode($actual) !== json_encode($expected)) {
        $failures++;
        echo "FALHOU: $name\n  esperado: " . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n  recebido: " . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

$run = substr(uniqid(), -6);
$tomorrow = date('Y-m-d', strtotime('+1 day'));

// --- Vendedores
[$s, $seller] = call('POST', '/sellers', ['name' => "Teste $run", 'email' => "t$run@x.com", 'phone' => '(54) 99999-0000', 'region' => 'Serra', 'status' => 'Ativo']);
check('cria vendedor', $s, 201);
check('vendedor começa sem orçamentos', [$seller['quotes'], $seller['amount']], [0, 0.0]);
[$s, $r] = call('POST', '/sellers', ['name' => 'Al', 'email' => 'ruim']);
check('vendedor inválido', [$s, $r['error']], [400, 'validation']);
check('vendedor inválido lista campos', array_keys($r['fields']), ['name', 'email']);
[$s] = call('GET', '/sellers/999999');
check('vendedor inexistente', $s, 404);
[$s, $r] = call('PUT', "/sellers/{$seller['id']}", ['name' => "Teste $run", 'email' => "t$run@x.com", 'status' => 'Inativo']);
check('edita vendedor', [$s, $r['status']], [200, 'Inativo']);
call('PUT', "/sellers/{$seller['id']}", ['name' => "Teste $run", 'email' => "t$run@x.com", 'status' => 'Ativo']);

// --- Clientes
[$s, $customer] = call('POST', '/customers', ['name' => "Cliente $run", 'kind' => 'PF', 'document' => '123.456.789-09', 'phone' => '(54) 3333-0000', 'city' => 'Caxias do Sul', 'seller' => "Teste $run"]);
check('cria cliente', [$s, $customer['seller'], $customer['quotes'], $customer['lastQuoteAt']], [201, "Teste $run", 0, null]);
[$s, $r] = call('POST', '/customers', ['name' => "Cliente PJ $run", 'kind' => 'PJ', 'document' => '123.456.789-09']);
check('CPF num cliente PJ é recusado', [$s, $r['fields']['document'] ?? null], [400, 'CNPJ deve ter 14 dígitos.']);
[$s, $r] = call('POST', '/customers', ['name' => "Cliente $run", 'kind' => 'PF', 'seller' => 'Ninguém']);
check('vendedor inexistente no cliente', [$s, isset($r['fields']['seller'])], [400, true]);
[$s, $r] = call('POST', '/customers', ['name' => "Sem doc $run", 'kind' => 'PJ']);
check('documento é opcional', [$s, $r['seller']], [201, '']);
call('DELETE', "/customers/{$r['id']}");

// --- Produtos
$code = "tst-$run";
[$s, $product] = call('POST', '/products', ['code' => $code, 'description' => 'Produto de teste', 'category' => 'Boilers', 'unitPrice' => 100.5]);
check('cria produto (código em maiúsculas)', [$s, $product['code'], $product['unitPrice']], [201, strtoupper($code), 100.5]);
[$s, $r] = call('POST', '/products', ['code' => $code, 'description' => 'Outro', 'category' => 'Boilers', 'unitPrice' => 1]);
check('código duplicado', [$s, $r['error']], [409, 'duplicate_product_code']);
[$s, $r] = call('POST', '/products', ['code' => "x$run", 'description' => 'Outro', 'category' => 'Boilers', 'unitPrice' => 0]);
check('preço zero', $s, 400);
[$s, $r] = call('POST', '/products', ['code' => "x$run", 'description' => 'Outro', 'category' => 'Inexistente', 'unitPrice' => 5]);
check('categoria inválida', $s, 400);
[, $list] = call('GET', '/products');
check('produto novo entra no topo', $list[0]['id'], $product['id']);
$statuses = array_column($list, 'status');
check('ativos antes dos inativos', $statuses, [...array_filter($statuses, fn ($x) => $x === 'Ativo'), ...array_filter($statuses, fn ($x) => $x === 'Inativo')]);
[$s, $r] = call('PUT', "/products/{$product['id']}", ['code' => $code, 'description' => 'Produto de teste', 'category' => 'Boilers', 'unitPrice' => 100.5, 'status' => 'Inativo']);
check('inativa produto sem conflito com o próprio código', [$s, $r['status']], [200, 'Inativo']);
[, $list] = call('GET', '/products');
check('produto inativado vai para o fim', end($list)['id'], $product['id']);

// --- Orçamentos
$draft = [
    'customerInfo' => ['name' => "Cliente $run", 'detail' => '123.456.789-09', 'phone' => '(54) 3333-0000', 'city' => 'Caxias do Sul'],
    'sellerInfo' => ['name' => "Teste $run", 'detail' => "t$run@x.com", 'phone' => '(54) 99999-0000'],
    'items' => [
        ['code' => 'BLR-200', 'description' => 'Boiler 200 L', 'quantity' => 2, 'unitPrice' => 3790],
        ['code' => 'SRV-INS', 'description' => 'Instalação', 'quantity' => 1, 'unitPrice' => 650],
    ],
    'validUntil' => $tomorrow,
    'paymentTerms' => '30 dias',
    'discount' => ['type' => 'percent', 'value' => 5],
    'notes' => '',
    'amount' => 1, // ignorado: a API recalcula
];
[$s, $quote] = call('POST', '/quotes', $draft);
check('cria orçamento', [$s, $quote['status']], [201, 'Pendente']);
check('total recalculado (8.230 − 5% = 7.818,50)', $quote['amount'], 7818.5);
check('número sequencial', preg_match('/^#\d+$/', $quote['number']), 1);
[, $detail] = call('GET', "/quotes/{$quote['id']}");
check('histórico inicial', array_column($detail['history'], 'note'), ['Orçamento criado']);
check('itens preservados', count($detail['items']), 2);
check('cópia do cliente', $detail['customerInfo']['phone'], '(54) 3333-0000');

[, $r] = call('POST', '/quotes', ['items' => []] + $draft);
check('sem itens', $r['error'] ?? null, 'validation');
[$s, $r] = call('POST', '/quotes', ['validUntil' => '2020-01-01'] + $draft);
check('validade no passado', [$s, isset($r['fields']['validUntil'])], [400, true]);
[$s, $r] = call('POST', '/quotes', ['discount' => ['type' => 'amount', 'value' => 99999]] + $draft);
check('desconto maior que o subtotal', $s, 400);
[$s, $r] = call('POST', '/quotes', ['items' => [['code' => 'A', 'description' => 'B', 'quantity' => 1.5, 'unitPrice' => 10]]] + $draft);
check('quantidade fracionada', $s, 400);

[, $r] = call('GET', '/sellers');
$me = current(array_filter($r, fn ($x) => $x['id'] === $seller['id']));
check('contagem do vendedor reflete o orçamento', [$me['quotes'], $me['amount']], [1, 7818.5]);
[, $r] = call('GET', "/customers/{$customer['id']}");
check('contagem do cliente', [$r['quotes'], $r['lastQuoteAt'] !== null], [1, true]);

[$s, $r] = call('DELETE', "/sellers/{$seller['id']}");
check('vendedor com orçamento não é excluído', [$s, $r['error']], [409, 'seller_in_use']);
[$s, $r] = call('DELETE', "/customers/{$customer['id']}");
check('cliente com orçamento não é excluído', [$s, $r['error']], [409, 'customer_in_use']);

[$s, $r] = call('PUT', "/quotes/{$quote['id']}", ['discount' => null, 'notes' => 'editado'] + $draft);
check('edita pendente', [$s, $r['amount']], [200, 8230.0]);
[, $detail] = call('GET', "/quotes/{$quote['id']}");
check('histórico após edição', array_column($detail['history'], 'note'), ['Orçamento criado', 'Orçamento editado']);

$id = $quote['id'];
[$s, $r] = call('POST', "/quotes/$id/status", ['status' => 'Aprovado']);
check('Pendente → Aprovado é recusado', [$s, $r['error']], [409, 'invalid_status_transition']);
[$s, $r] = call('POST', "/quotes/$id/status", ['status' => 'Enviado', 'channel' => 'whatsapp']);
check('Pendente → Enviado', [$s, $r['status']], [200, 'Enviado']);
[$s, $r] = call('PUT', "/quotes/$id", $draft);
check('enviado não edita', [$s, $r['error']], [409, 'quote_not_editable']);
[$s] = call('DELETE', "/quotes/$id");
check('enviado não exclui', $s, 409);
[, $detail] = call('GET', "/quotes/$id");
check('nota do WhatsApp', end($detail['history'])['note'], 'Enviado ao cliente por WhatsApp');
call('POST', "/quotes/$id/status", ['status' => 'Aprovado']);
[$s] = call('POST', "/quotes/$id/status", ['status' => 'Cancelado']);
check('Aprovado é final', $s, 409);
[$s, $r] = call('POST', "/quotes/$id/status", ['status' => 'Qualquer']);
check('status desconhecido', $s, 400);

[$s, $copy] = call('POST', '/quotes', ['copiedFromId' => $id] + $draft);
[, $copyDetail] = call('GET', "/quotes/{$copy['id']}");
check('cópia registra a origem', $copyDetail['history'][0]['note'], "Criado a partir do orçamento {$quote['number']}");

$today = date('Y-m-d');
[$s, $r] = call('GET', "/quotes?from=$today&to=$today");
check('lista do período inclui os de hoje', [$s, in_array($copy['id'], array_column($r, 'id'), true)], [200, true]);
check('lista do mais novo para o mais antigo', $r[0]['id'], $copy['id']);
[$s, $r] = call('GET', '/quotes?from=2020-01-01&to=2020-01-02');
check('período sem orçamentos', [$s, $r], [200, []]);
[$s, $r] = call('GET', '/quotes?from=2026-02-31&to=2026-03-01');
check('data impossível', [$s, $r['error']], [400, 'invalid_period']);
[$s, $r] = call('GET', '/quotes?from=2025-01-01&to=2026-12-31');
check('período acima de 366 dias', [$s, $r['error']], [400, 'invalid_period']);
[$s, $r] = call('GET', '/quotes?from=2026-01-01');
check('período incompleto', $s, 400);

[$s] = call('DELETE', "/quotes/{$copy['id']}");
check('exclui pendente', $s, 204);
[$s] = call('GET', "/quotes/{$copy['id']}");
check('excluído não existe mais', $s, 404);

// Cancelar e excluir libera o cliente.
[, $c2] = call('POST', '/quotes', $draft);
call('POST', "/quotes/{$c2['id']}/status", ['status' => 'Cancelado']);
call('POST', "/quotes/{$c2['id']}/status", ['status' => 'Pendente']);
[, $d2] = call('GET', "/quotes/{$c2['id']}");
check('reabrir registra o evento', end($d2['history'])['note'], 'Voltou para pendente');

// --- Produto excluído não afeta orçamento antigo
[$s] = call('DELETE', "/products/{$product['id']}");
check('exclui produto', $s, 204);

[$s] = call('GET', '/nada');
check('rota desconhecida', $s, 404);
[$s] = call('PATCH', '/sellers');
check('método não permitido', $s, 405);

echo $failures === 0 ? "OK: $checks verificações passaram.\n" : "$failures de $checks verificações falharam.\n";
exit($failures === 0 ? 0 : 1);
