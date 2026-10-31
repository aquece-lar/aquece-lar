<?php

declare(strict_types=1);

namespace App\Controllers;

use App\ApiException;
use App\Request;
use App\Response;
use App\Validator;
use PDO;

final class ProductController
{
    private const CATEGORIES = ['Aquecedores a gás', 'Boilers', 'Lareiras', 'Piscina', 'Acessórios', 'Serviços'];

    public function __construct(private readonly PDO $db)
    {
    }

    /** Ativos primeiro (o mais novo no topo); inativos depois, o inativado há mais tempo antes. */
    public function index(): Response
    {
        $rows = $this->db->query(
            "SELECT * FROM products
             ORDER BY (status = 'Inativo'), IF(status = 'Ativo', id, 0) DESC, inactivated_at, id",
        )->fetchAll();

        return Response::json(array_map([$this, 'present'], $rows));
    }

    /** @param array<string,string> $p */
    public function show(Request $r, array $p): Response
    {
        return Response::json($this->present($this->find($p['id'])));
    }

    public function store(Request $r): Response
    {
        $d = $this->validate($r->json());
        $this->assertCodeFree($d['code'], null);
        $this->db->prepare(
            'INSERT INTO products (code, description, category, unit_price, status, inactivated_at)
             VALUES (?, ?, ?, ?, ?, ?)',
        )->execute([
            $d['code'], $d['description'], $d['category'], $d['unit_price'], $d['status'],
            $d['status'] === 'Inativo' ? date('Y-m-d H:i:s') : null,
        ]);

        return Response::json($this->present($this->find((string) $this->db->lastInsertId())), 201);
    }

    /** @param array<string,string> $p */
    public function update(Request $r, array $p): Response
    {
        $current = $this->find($p['id']);
        $d = $this->validate($r->json());
        $this->assertCodeFree($d['code'], $p['id']);

        // O momento da inativação só muda quando o status muda.
        $inactivatedAt = match (true) {
            $d['status'] === 'Ativo' => null,
            $current['status'] === 'Inativo' => $current['inactivated_at'],
            default => date('Y-m-d H:i:s'),
        };
        $this->db->prepare(
            'UPDATE products SET code = ?, description = ?, category = ?, unit_price = ?, status = ?, inactivated_at = ?
             WHERE id = ?',
        )->execute([$d['code'], $d['description'], $d['category'], $d['unit_price'], $d['status'], $inactivatedAt, $p['id']]);

        return Response::json($this->present($this->find($p['id'])));
    }

    /**
     * Os itens dos orçamentos guardam código, descrição e preço próprios; excluir não os afeta.
     *
     * @param array<string,string> $p
     */
    public function destroy(Request $r, array $p): Response
    {
        $this->find($p['id']);
        $this->db->prepare('DELETE FROM products WHERE id = ?')->execute([$p['id']]);

        return Response::noContent();
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    private function validate(array $body): array
    {
        $v = new Validator($body);
        $d = [
            'code' => mb_strtoupper($v->string('code', 'o código', 1, 40)),
            'description' => $v->string('description', 'A descrição', 3, 200),
            'category' => $v->enum('category', 'A categoria', self::CATEGORIES),
            'unit_price' => $v->number('unitPrice', 'O preço'),
            'status' => $v->enum('status', 'O status', ['Ativo', 'Inativo'], 'Ativo'),
        ];
        if (!$v->has() && $d['unit_price'] <= 0) {
            $v->error('unitPrice', 'O preço deve ser maior que zero.');
        }
        $v->failIfAny();

        return $d;
    }

    private function assertCodeFree(string $code, ?string $exceptId): void
    {
        $stmt = $this->db->prepare('SELECT COUNT(*) FROM products WHERE code = ? AND id <> ?');
        $stmt->execute([$code, $exceptId ?? 0]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw ApiException::conflict('duplicate_product_code', "O código $code já está em uso.");
        }
    }

    /** @return array<string,mixed> */
    private function find(string $id): array
    {
        $stmt = $this->db->prepare('SELECT * FROM products WHERE id = ?');
        $stmt->execute([ctype_digit($id) ? $id : 0]);

        return $stmt->fetch() ?: throw ApiException::notFound('Produto não encontrado.');
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function present(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'code' => $row['code'],
            'description' => $row['description'],
            'category' => $row['category'],
            'unitPrice' => (float) $row['unit_price'],
            'status' => $row['status'],
        ];
    }
}
