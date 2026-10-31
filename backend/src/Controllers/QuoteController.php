<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ApiException;
use App\Money;
use App\Request;
use App\Response;
use App\Validator;
use DateTimeImmutable;
use PDO;
use PDOException;

final class QuoteController
{
    private const MAX_PERIOD_DAYS = 366;

    /** De → para → texto do histórico. */
    private const TRANSITIONS = [
        'Pendente' => ['Enviado' => 'Enviado ao cliente', 'Cancelado' => 'Orçamento cancelado'],
        'Enviado' => ['Aprovado' => 'Aprovado pelo cliente', 'Cancelado' => 'Orçamento cancelado'],
        'Cancelado' => ['Pendente' => 'Voltou para pendente'],
        'Aprovado' => [],
    ];

    public function __construct(private readonly PDO $db)
    {
    }

    public function index(Request $r): Response
    {
        $from = $r->query['from'] ?? null;
        $to = $r->query['to'] ?? null;
        $where = '';
        $params = [];
        // Sem período devolve tudo; com período, vale a regra de datas do contrato.
        if ($from !== null || $to !== null) {
            [$start, $end] = $this->period($from, $to);
            $where = 'WHERE created_at >= ? AND created_at < ?';
            $params = [$start->format('Y-m-d 00:00:00'), $end->modify('+1 day')->format('Y-m-d 00:00:00')];
        }
        $stmt = $this->db->prepare(
            "SELECT id, number, customer_name, seller_name, amount, status, created_at
             FROM quotes $where ORDER BY created_at DESC, id DESC",
        );
        $stmt->execute($params);

        return Response::json(array_map([$this, 'summary'], $stmt->fetchAll()));
    }

    /** @param array<string,string> $p */
    public function show(Request $r, array $p): Response
    {
        return Response::json($this->detail($this->find($p['id'])));
    }

    public function store(Request $r): Response
    {
        $body = $r->json();
        $draft = $this->parseDraft($body);

        $copiedNumber = null;
        if (isset($body['copiedFromId']) && $body['copiedFromId'] !== '') {
            $copiedNumber = $this->find((string) $body['copiedFromId'])['number'];
        }
        $note = $copiedNumber !== null ? "Criado a partir do orçamento #$copiedNumber" : 'Orçamento criado';

        for ($attempt = 1;; $attempt++) {
            try {
                $this->db->beginTransaction();
                $number = (int) $this->db->query('SELECT COALESCE(MAX(number), 1000) + 1 FROM quotes FOR UPDATE')->fetchColumn();
                $now = date('Y-m-d H:i:s');
                $this->db->prepare(
                    'INSERT INTO quotes (number, customer_id, seller_id, customer_name, seller_name, customer_info, seller_info,
                        valid_until, payment_terms, discount_type, discount_value, notes, amount, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([
                    $number, $draft['customer_id'], $draft['seller_id'],
                    $draft['customerInfo']['name'], $draft['sellerInfo']['name'],
                    $this->encode($draft['customerInfo']), $this->encode($draft['sellerInfo']),
                    $draft['validUntil'], $draft['paymentTerms'],
                    $draft['discount']['type'] ?? null, $draft['discount']['value'] ?? null,
                    $draft['notes'], $draft['amount'], 'Pendente', $now,
                ]);
                $id = (string) $this->db->lastInsertId();
                $this->saveItems($id, $draft['items']);
                $this->addEvent($id, 'Pendente', $note, $now);
                $this->db->commit();
                break;
            } catch (PDOException $e) {
                $this->db->rollBack();
                // Dois orçamentos simultâneos pegaram o mesmo número: tenta de novo.
                if ($attempt >= 3 || $e->getCode() !== '23000') {
                    throw $e;
                }
            }
        }

        return Response::json($this->summary($this->find($id)), 201);
    }

    /** @param array<string,string> $p */
    public function update(Request $r, array $p): Response
    {
        $quote = $this->find($p['id']);
        if ($quote['status'] !== 'Pendente') {
            throw ApiException::conflict('quote_not_editable', 'Só orçamentos pendentes podem ser editados. Duplique este orçamento.');
        }
        $draft = $this->parseDraft($r->json());

        $this->db->beginTransaction();
        $this->db->prepare(
            'UPDATE quotes SET customer_id = ?, seller_id = ?, customer_name = ?, seller_name = ?, customer_info = ?, seller_info = ?,
                valid_until = ?, payment_terms = ?, discount_type = ?, discount_value = ?, notes = ?, amount = ?
             WHERE id = ?',
        )->execute([
            $draft['customer_id'], $draft['seller_id'],
            $draft['customerInfo']['name'], $draft['sellerInfo']['name'],
            $this->encode($draft['customerInfo']), $this->encode($draft['sellerInfo']),
            $draft['validUntil'], $draft['paymentTerms'],
            $draft['discount']['type'] ?? null, $draft['discount']['value'] ?? null,
            $draft['notes'], $draft['amount'], $p['id'],
        ]);
        $this->db->prepare('DELETE FROM quote_items WHERE quote_id = ?')->execute([$p['id']]);
        $this->saveItems($p['id'], $draft['items']);
        $this->addEvent($p['id'], 'Pendente', 'Orçamento editado', date('Y-m-d H:i:s'));
        $this->db->commit();

        return Response::json($this->summary($this->find($p['id'])));
    }

    /**
     * Corpo: `{ "status": "...", "channel"?: "whatsapp" }`. O canal só muda o texto do histórico;
     * o envio em si (WhatsApp, e-mail) não é feito por esta API.
     *
     * @param array<string,string> $p
     */
    public function changeStatus(Request $r, array $p): Response
    {
        $body = $r->json();
        $v = new Validator($body);
        $target = $v->enum('status', 'O status', ['Pendente', 'Enviado', 'Aprovado', 'Cancelado']);
        $v->failIfAny();

        $this->db->beginTransaction();
        $stmt = $this->db->prepare('SELECT status FROM quotes WHERE id = ? FOR UPDATE');
        $stmt->execute([ctype_digit($p['id']) ? $p['id'] : 0]);
        $current = $stmt->fetchColumn();
        if ($current === false) {
            $this->db->rollBack();
            throw ApiException::notFound('Orçamento não encontrado.');
        }
        $note = self::TRANSITIONS[$current][$target] ?? null;
        if ($note === null) {
            $this->db->rollBack();
            throw ApiException::conflict('invalid_status_transition', "Não é possível passar de $current para $target.");
        }
        if ($target === 'Enviado' && ($body['channel'] ?? null) === 'whatsapp') {
            $note = 'Enviado ao cliente por WhatsApp';
        }
        $this->db->prepare('UPDATE quotes SET status = ? WHERE id = ?')->execute([$target, $p['id']]);
        $this->addEvent($p['id'], $target, $note, date('Y-m-d H:i:s'));
        $this->db->commit();

        return Response::json($this->summary($this->find($p['id'])));
    }

    /**
     * Exclusão definitiva só para pendentes e cancelados; os demais já fazem parte do histórico comercial.
     *
     * @param array<string,string> $p
     */
    public function destroy(Request $r, array $p): Response
    {
        $quote = $this->find($p['id']);
        if (!in_array($quote['status'], ['Pendente', 'Cancelado'], true)) {
            throw ApiException::conflict('quote_not_deletable', 'Só orçamentos pendentes ou cancelados podem ser excluídos.');
        }
        $this->db->prepare('DELETE FROM quotes WHERE id = ?')->execute([$p['id']]);

        return Response::noContent();
    }

    /**
     * @return array{DateTimeImmutable,DateTimeImmutable}
     */
    private function period(mixed $from, mixed $to): array
    {
        $parse = static function (mixed $value): ?DateTimeImmutable {
            if (!is_string($value)) {
                return null;
            }
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

            return $date !== false && $date->format('Y-m-d') === $value ? $date : null;
        };
        $start = $parse($from);
        $end = $parse($to);
        if ($start === null || $end === null || $start > $end || $start->diff($end)->days + 1 > self::MAX_PERIOD_DAYS) {
            throw new ApiException(400, 'invalid_period', 'Período inválido. Use datas AAAA-MM-DD, com até 366 dias.');
        }

        return [$start, $end];
    }

    /**
     * Valida o corpo e calcula o valor; o `amount` enviado pelo cliente é ignorado.
     *
     * @param array<string,mixed> $b @return array<string,mixed>
     */
    private function parseDraft(array $b): array
    {
        $v = new Validator($b);
        $contacts = [];
        foreach (['customerInfo' => 'cliente', 'sellerInfo' => 'vendedor'] as $key => $label) {
            $info = $b[$key] ?? null;
            if (!is_array($info)) {
                $v->error($key, "Informe o $label.");
                $contacts[$key] = ['name' => '', 'detail' => '', 'phone' => ''];
                continue;
            }
            $cv = new Validator($info, "$key.");
            $contacts[$key] = [
                'name' => $cv->string('name', "O nome do $label", 1, 160),
                'detail' => $cv->string('detail', 'O detalhe', 0, 160),
                'phone' => $cv->string('phone', 'O telefone', 0, 30),
            ];
            $city = $cv->string('city', 'A cidade', 0, 80);
            if (isset($info['city'])) {
                $contacts[$key]['city'] = $city;
            }
            foreach ($cv->errors() as $field => $message) {
                $v->error($field, $message);
            }
        }

        $items = [];
        $rawItems = $b['items'] ?? null;
        if (!is_array($rawItems) || $rawItems === [] || !array_is_list($rawItems)) {
            $v->error('items', 'Inclua ao menos um item.');
        } else {
            foreach ($rawItems as $i => $raw) {
                if (!is_array($raw)) {
                    $v->error("items.$i", 'Item inválido.');
                    continue;
                }
                $iv = new Validator($raw, "items.$i.");
                $quantity = $raw['quantity'] ?? null;
                $item = [
                    'code' => $iv->string('code', 'O código', 1, 40),
                    'description' => $iv->string('description', 'A descrição', 1, 200),
                    'quantity' => is_int($quantity) ? $quantity : 0,
                    'unitPrice' => $iv->number('unitPrice', 'O preço'),
                ];
                if ($item['quantity'] < 1) {
                    $iv->error('quantity', 'A quantidade deve ser um número inteiro de 1 em diante.');
                }
                if (!$iv->errors() && $item['unitPrice'] <= 0) {
                    $iv->error('unitPrice', 'O preço deve ser maior que zero.');
                }
                foreach ($iv->errors() as $field => $message) {
                    $v->error($field, $message);
                }
                $items[] = $item;
            }
        }

        $validUntil = (string) ($b['validUntil'] ?? '');
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $validUntil);
        if ($date === false || $date->format('Y-m-d') !== $validUntil) {
            $v->error('validUntil', 'Validade inválida.');
        } elseif ($validUntil < date('Y-m-d')) {
            $v->error('validUntil', 'A validade não pode ser anterior a hoje.');
        }

        $paymentTerms = $v->string('paymentTerms', 'A condição de pagamento', 0, 200);
        $notes = $v->string('notes', 'As observações', 0, 2000);

        $v->failIfAny();

        $subtotal = (int) round(array_sum(array_map(static fn (array $i) => $i['quantity'] * $i['unitPrice'], $items)) * 100);
        $discount = $this->parseDiscount($b['discount'] ?? null, $subtotal, $v);
        $off = match ($discount['type'] ?? null) {
            'percent' => (int) round($subtotal * $discount['value'] / 100),
            'amount' => Money::cents($discount['value']),
            default => 0,
        };

        return [
            'customerInfo' => $contacts['customerInfo'],
            'sellerInfo' => $contacts['sellerInfo'],
            'customer_id' => $this->resolveId('customers', $b['customerId'] ?? null, $contacts['customerInfo']['name'], 'customerId', 'Cliente', $v),
            'seller_id' => $this->resolveId('sellers', $b['sellerId'] ?? null, $contacts['sellerInfo']['name'], 'sellerId', 'Vendedor', $v),
            'items' => $items,
            'validUntil' => $validUntil,
            'paymentTerms' => $paymentTerms,
            'discount' => $discount,
            'notes' => $notes,
            'amount' => Money::fromCents($subtotal - min(max($off, 0), $subtotal)),
        ];
    }

    /** @return array{type:string,value:float}|null */
    private function parseDiscount(mixed $raw, int $subtotalCents, Validator $v): ?array
    {
        if ($raw === null) {
            return null;
        }
        if (!is_array($raw)) {
            $v->error('discount', 'Desconto inválido.');
            $v->failIfAny();
        }
        $dv = new Validator($raw, 'discount.');
        $type = $dv->enum('type', 'O tipo de desconto', ['percent', 'amount']);
        $value = $dv->number('value', 'O valor do desconto');
        if (!$dv->has()) {
            if ($value < 0 || ($type === 'percent' && $value > 100)) {
                $dv->error('value', 'O desconto deve ficar entre 0 e 100%.');
            } elseif ($type === 'amount' && Money::cents($value) > $subtotalCents) {
                $dv->error('value', 'O desconto não pode passar do subtotal.');
            }
        }
        foreach ($dv->errors() as $field => $message) {
            $v->error($field, $message);
        }
        $v->failIfAny();

        return ['type' => $type, 'value' => $value];
    }

    /** Usa o id enviado, se houver; senão tenta o nome. Sem correspondência, fica sem vínculo (a cópia do orçamento basta). */
    private function resolveId(string $table, mixed $explicit, string $name, string $field, string $label, Validator $v): ?string
    {
        if ($explicit !== null && $explicit !== '') {
            $stmt = $this->db->prepare("SELECT id FROM $table WHERE id = ?");
            $stmt->execute([ctype_digit((string) $explicit) ? (string) $explicit : 0]);
            $id = $stmt->fetchColumn();
            if ($id === false) {
                $v->error($field, "$label não encontrado.");
                $v->failIfAny();
            }

            return (string) $id;
        }
        $stmt = $this->db->prepare("SELECT id FROM $table WHERE name = ? LIMIT 1");
        $stmt->execute([$name]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (string) $id;
    }

    /** @param list<array<string,mixed>> $items */
    private function saveItems(string $quoteId, array $items): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO quote_items (quote_id, position, code, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)',
        );
        foreach ($items as $position => $item) {
            $stmt->execute([$quoteId, $position, $item['code'], $item['description'], $item['quantity'], $item['unitPrice']]);
        }
    }

    private function addEvent(string $quoteId, string $status, string $note, string $at): void
    {
        $this->db->prepare('INSERT INTO quote_events (quote_id, status, at, note) VALUES (?, ?, ?, ?)')
            ->execute([$quoteId, $status, $at, $note]);
    }

    /** @param array<string,mixed> $data */
    private function encode(array $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /** @return array<string,mixed> */
    private function find(string $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM quotes WHERE id = ?');
        $stmt->execute([ctype_digit($id) ? $id : 0]);

        return $stmt->fetch() ?: throw ApiException::notFound('Orçamento não encontrado.');
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function summary(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'number' => '#' . $row['number'],
            'customer' => $row['customer_name'],
            'seller' => $row['seller_name'],
            'amount' => (float) $row['amount'],
            'status' => $row['status'],
            'createdAt' => (new DateTimeImmutable($row['created_at']))->format('c'),
        ];
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function detail(array $row): array
    {
        $items = $this->db->prepare('SELECT code, description, quantity, unit_price FROM quote_items WHERE quote_id = ? ORDER BY position');
        $items->execute([$row['id']]);
        $events = $this->db->prepare('SELECT status, at, note FROM quote_events WHERE quote_id = ? ORDER BY at, id');
        $events->execute([$row['id']]);

        return $this->summary($row) + [
            'customerInfo' => json_decode($row['customer_info'], true),
            'sellerInfo' => json_decode($row['seller_info'], true),
            'items' => array_map(static fn (array $i) => [
                'code' => $i['code'],
                'description' => $i['description'],
                'quantity' => (int) $i['quantity'],
                'unitPrice' => (float) $i['unit_price'],
            ], $items->fetchAll()),
            'validUntil' => $row['valid_until'],
            'paymentTerms' => $row['payment_terms'],
            'discount' => $row['discount_type'] === null
                ? null
                : ['type' => $row['discount_type'], 'value' => (float) $row['discount_value']],
            'notes' => $row['notes'],
            'history' => array_map(static fn (array $e) => [
                'status' => $e['status'],
                'at' => (new DateTimeImmutable($e['at']))->format('c'),
                'note' => $e['note'],
            ], $events->fetchAll()),
        ];
    }
}
