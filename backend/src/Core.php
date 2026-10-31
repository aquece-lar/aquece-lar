<?php

declare(strict_types=1);

namespace App;

use PDO;

final class ApiException extends \RuntimeException
{
    /** @param array<string,string> $fields */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $message = 'Registro não encontrado.'): self
    {
        return new self(404, 'not_found', $message);
    }

    public static function conflict(string $code, string $message): self
    {
        return new self(409, $code, $message);
    }
}

final class Env
{
    /** @var array<string,string> */
    private static array $values = [];

    public static function load(string $file): void
    {
        if (!is_file($file)) {
            return;
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            self::$values[trim($key)] = trim($value, " \t\"'");
        }
    }

    public static function get(string $key, string $default = ''): string
    {
        return self::$values[$key] ?? (getenv($key) !== false ? (string) getenv($key) : $default);
    }
}

final class Db
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        return self::$pdo ??= self::connect(Env::get('DB_NAME', 'aquece_lar'));
    }

    public static function connect(?string $database): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;%scharset=utf8mb4',
            Env::get('DB_HOST', '127.0.0.1'),
            Env::get('DB_PORT', '3306'),
            $database !== null ? "dbname=$database;" : '',
        );

        return new PDO($dsn, Env::get('DB_USER', 'root'), Env::get('DB_PASS'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            // Brasil não tem horário de verão desde 2019: o fuso fixo evita ambiguidade.
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '-03:00'",
        ]);
    }
}

final class Request
{
    /** @param array<string,mixed> $query */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        private readonly string $rawBody,
    ) {
    }

    public static function fromGlobals(): self
    {
        $path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
        $base = rtrim(Env::get('BASE_PATH'), '/');
        if ($base !== '' && str_starts_with($path, $base)) {
            $path = substr($path, strlen($base));
        }

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            '/' . trim($path, '/'),
            $_GET,
            (string) file_get_contents('php://input'),
        );
    }

    /** @return array<string,mixed> */
    public function json(): array
    {
        if (trim($this->rawBody) === '') {
            return [];
        }
        $data = json_decode($this->rawBody, true);
        if (!is_array($data) || array_is_list($data) && $data !== []) {
            throw new ApiException(400, 'validation', 'O corpo da requisição deve ser um objeto JSON.');
        }

        return $data;
    }
}

final class Response
{
    private function __construct(public readonly int $status, public readonly mixed $body)
    {
    }

    public static function json(mixed $body, int $status = 200): self
    {
        return new self($status, $body);
    }

    public static function noContent(): self
    {
        return new self(204, null);
    }

    public function send(): void
    {
        http_response_code($this->status);
        if ($this->body === null) {
            return;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($this->body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

final class Router
{
    /** @var list<array{string,string,callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler];
    }

    public function dispatch(Request $request): Response
    {
        $pathMatched = false;
        foreach ($this->routes as [$method, $regex, $handler]) {
            if (!preg_match($regex, $request->path, $m)) {
                continue;
            }
            $pathMatched = true;
            if ($method === $request->method) {
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

                return $handler($request, $params);
            }
        }

        throw $pathMatched
            ? new ApiException(405, 'method_not_allowed', 'Método não permitido.')
            : ApiException::notFound('Rota não encontrada.');
    }
}

/** Validação que acumula os erros e responde 400 `validation` com a primeira mensagem. */
final class Validator
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @param array<string,mixed> $data */
    public function __construct(private readonly array $data, private readonly string $prefix = '')
    {
    }

    public function error(string $field, string $message): void
    {
        $this->errors[$this->prefix . $field] ??= $message;
    }

    public function string(string $field, string $label, int $min = 0, int $max = 255): string
    {
        $value = $this->data[$field] ?? '';
        if (!is_string($value)) {
            $this->error($field, "$label inválido.");

            return '';
        }
        $value = trim($value);
        $length = mb_strlen($value);
        if ($length < $min) {
            $this->error($field, $min === 1 ? "Informe $label." : "$label deve ter ao menos $min caracteres.");
        } elseif ($length > $max) {
            $this->error($field, "$label deve ter no máximo $max caracteres.");
        }

        return $value;
    }

    /** @param list<string> $allowed */
    public function enum(string $field, string $label, array $allowed, ?string $default = null): string
    {
        $value = $this->data[$field] ?? $default;
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $this->error($field, "$label inválido.");

            return $default ?? $allowed[0];
        }

        return $value;
    }

    public function number(string $field, string $label): float
    {
        $value = $this->data[$field] ?? null;
        if (!is_int($value) && !is_float($value)) {
            $this->error($field, "$label inválido.");

            return 0.0;
        }

        return (float) $value;
    }

    public function failIfAny(): void
    {
        if ($this->errors !== []) {
            throw new ApiException(400, 'validation', reset($this->errors), $this->errors);
        }
    }

    public function has(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string,string> */
    public function errors(): array
    {
        return $this->errors;
    }
}

final class Money
{
    public static function cents(float|string $value): int
    {
        return (int) round(((float) $value) * 100);
    }

    public static function fromCents(int $cents): float
    {
        return $cents / 100;
    }
}
