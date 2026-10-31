<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ApiException;
use App\Request;
use App\Response;
use App\Validator;
use PDO;

final class SellerController
{
    private const SELECT = 'SELECT s.*, COALESCE(q.n, 0) AS quotes, COALESCE(q.total, 0) AS amount
        FROM sellers s
        LEFT JOIN (
            SELECT seller_id, COUNT(*) AS n, SUM(amount) AS total
            FROM quotes WHERE created_at >= :month_start GROUP BY seller_id
        ) q ON q.seller_id = s.id';

    public function __construct(private readonly PDO $db)
    {
    }

    public function index(): Response
    {
        $rows = $this->query(' ORDER BY s.name');

        return Response::json(array_map([$this, 'present'], $rows));
    }

    /** @param array<string,string> $p */
    public function show(Request $r, array $p): Response
    {
        return Response::json($this->find($p['id']));
    }

    public function store(Request $r): Response
    {
        $data = $this->validate($r->json());
        $this->db->prepare('INSERT INTO sellers (name, email, phone, region, status) VALUES (?, ?, ?, ?, ?)')
            ->execute([$data['name'], $data['email'], $data['phone'], $data['region'], $data['status']]);

        return Response::json($this->find((string) $this->db->lastInsertId()), 201);
    }

    /** @param array<string,string> $p */
    public function update(Request $r, array $p): Response
    {
        $this->find($p['id']);
        $data = $this->validate($r->json());
        $this->db->prepare('UPDATE sellers SET name = ?, email = ?, phone = ?, region = ?, status = ? WHERE id = ?')
            ->execute([$data['name'], $data['email'], $data['phone'], $data['region'], $data['status'], $p['id']]);

        return Response::json($this->find($p['id']));
    }

    /** @param array<string,string> $p */
    public function destroy(Request $r, array $p): Response
    {
        $this->find($p['id']);
        $used = $this->db->prepare('SELECT COUNT(*) FROM quotes WHERE seller_id = ?');
        $used->execute([$p['id']]);
        if ((int) $used->fetchColumn() > 0) {
            throw ApiException::conflict('seller_in_use', 'Este vendedor tem orçamentos. Inative-o em vez de excluir.');
        }
        $this->db->prepare('DELETE FROM sellers WHERE id = ?')->execute([$p['id']]);

        return Response::noContent();
    }

    /** @param array<string,mixed> $body @return array<string,string> */
    private function validate(array $body): array
    {
        $v = new Validator($body);
        $data = [
            'name' => $v->string('name', 'O nome', 3, 120),
            'email' => $v->string('email', 'O e-mail', 1, 160),
            'phone' => $v->string('phone', 'O telefone', 0, 30),
            'region' => $v->string('region', 'A região', 0, 80),
            'status' => $v->enum('status', 'O status', ['Ativo', 'Inativo'], 'Ativo'),
        ];
        if ($data['email'] !== '' && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $v->error('email', 'E-mail inválido.');
        }
        $v->failIfAny();

        return $data;
    }

    /** @return list<array<string,mixed>> */
    private function query(string $suffix, array $extra = []): array
    {
        $stmt = $this->db->prepare(self::SELECT . $suffix);
        $stmt->execute([':month_start' => date('Y-m-01 00:00:00')] + $extra);

        return $stmt->fetchAll();
    }

    /** @return array<string,mixed> */
    private function find(string $id): array
    {
        $rows = ctype_digit($id) ? $this->query(' WHERE s.id = :id', [':id' => $id]) : [];
        if ($rows === []) {
            throw ApiException::notFound('Vendedor não encontrado.');
        }

        return $this->present($rows[0]);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function present(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'region' => $row['region'],
            'status' => $row['status'],
            'quotes' => (int) $row['quotes'],
            'amount' => (float) $row['amount'],
        ];
    }
}
