<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ApiException;
use App\Request;
use App\Response;
use App\Validator;
use DateTimeImmutable;
use PDO;

final class CustomerController
{
    private const SELECT = 'SELECT c.*, s.name AS seller_name, COALESCE(q.n, 0) AS quotes, q.last_at
        FROM customers c
        LEFT JOIN sellers s ON s.id = c.seller_id
        LEFT JOIN (
            SELECT customer_id, COUNT(*) AS n, MAX(created_at) AS last_at
            FROM quotes GROUP BY customer_id
        ) q ON q.customer_id = c.id';

    public function __construct(private readonly PDO $db)
    {
    }

    public function index(): Response
    {
        return Response::json(array_map([$this, 'present'], $this->query(' ORDER BY c.name')));
    }

    /** @param array<string,string> $p */
    public function show(Request $r, array $p): Response
    {
        return Response::json($this->find($p['id']));
    }

    public function store(Request $r): Response
    {
        $d = $this->validate($r->json());
        $this->db->prepare('INSERT INTO customers (name, kind, document, phone, city, seller_id) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$d['name'], $d['kind'], $d['document'], $d['phone'], $d['city'], $d['seller_id']]);

        return Response::json($this->find((string) $this->db->lastInsertId()), 201);
    }

    /** @param array<string,string> $p */
    public function update(Request $r, array $p): Response
    {
        $this->find($p['id']);
        $d = $this->validate($r->json());
        $this->db->prepare('UPDATE customers SET name = ?, kind = ?, document = ?, phone = ?, city = ?, seller_id = ? WHERE id = ?')
            ->execute([$d['name'], $d['kind'], $d['document'], $d['phone'], $d['city'], $d['seller_id'], $p['id']]);

        return Response::json($this->find($p['id']));
    }

    /** @param array<string,string> $p */
    public function destroy(Request $r, array $p): Response
    {
        $this->find($p['id']);
        $used = $this->db->prepare('SELECT COUNT(*) FROM quotes WHERE customer_id = ?');
        $used->execute([$p['id']]);
        if ((int) $used->fetchColumn() > 0) {
            throw ApiException::conflict('customer_in_use', 'Este cliente tem orçamentos e não pode ser excluído.');
        }
        $this->db->prepare('DELETE FROM customers WHERE id = ?')->execute([$p['id']]);

        return Response::noContent();
    }

    /**
     * O vendedor responsável chega pelo nome (`seller`, como no front) ou por `sellerId`.
     *
     * @param array<string,mixed> $body @return array<string,mixed>
     */
    private function validate(array $body): array
    {
        $v = new Validator($body);
        $d = [
            'name' => $v->string('name', 'O nome', 3, 160),
            'kind' => $v->enum('kind', 'O tipo', ['PF', 'PJ']),
            'document' => $v->string('document', 'O documento', 0, 30),
            'phone' => $v->string('phone', 'O telefone', 0, 30),
            'city' => $v->string('city', 'A cidade', 0, 80),
            'seller_id' => null,
        ];

        if ($d['document'] !== '') {
            $digits = strlen(preg_replace('/\D/', '', $d['document']));
            $expected = $d['kind'] === 'PJ' ? 14 : 11;
            if ($digits !== $expected) {
                $v->error('document', $d['kind'] === 'PJ' ? 'CNPJ deve ter 14 dígitos.' : 'CPF deve ter 11 dígitos.');
            }
        }

        $sellerId = $body['sellerId'] ?? null;
        $sellerName = trim((string) ($body['seller'] ?? ''));
        if ($sellerId !== null && $sellerId !== '') {
            $d['seller_id'] = $this->sellerBy('id', (string) $sellerId);
        } elseif ($sellerName !== '') {
            $d['seller_id'] = $this->sellerBy('name', $sellerName);
        }
        if (($sellerId !== null && $sellerId !== '' || $sellerName !== '') && $d['seller_id'] === null) {
            $v->error('seller', 'Vendedor não encontrado.');
        }
        $v->failIfAny();

        return $d;
    }

    private function sellerBy(string $column, string $value): ?string
    {
        $stmt = $this->db->prepare("SELECT id FROM sellers WHERE $column = ? LIMIT 1");
        $stmt->execute([$value]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (string) $id;
    }

    /** @return list<array<string,mixed>> */
    private function query(string $suffix, array $params = []): array
    {
        $stmt = $this->db->prepare(self::SELECT . $suffix);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /** @return array<string,mixed> */
    private function find(string $id): array
    {
        $rows = ctype_digit($id) ? $this->query(' WHERE c.id = ?', [$id]) : [];
        if ($rows === []) {
            throw ApiException::notFound('Cliente não encontrado.');
        }

        return $this->present($rows[0]);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function present(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => $row['name'],
            'kind' => $row['kind'],
            'document' => $row['document'],
            'phone' => $row['phone'],
            'city' => $row['city'],
            'seller' => $row['seller_name'] ?? '',
            'quotes' => (int) $row['quotes'],
            'lastQuoteAt' => $row['last_at'] === null ? null : (new DateTimeImmutable($row['last_at']))->format('c'),
        ];
    }
}
