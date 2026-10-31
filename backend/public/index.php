<?php

declare(strict_types=1);

use App\ApiException;
use App\Controllers\CustomerController;
use App\Controllers\ProductController;
use App\Controllers\QuoteController;
use App\Controllers\SellerController;
use App\Db;
use App\Env;
use App\Request;
use App\Response;
use App\Router;

require __DIR__ . '/../src/bootstrap.php';

// CORS: só as origens configuradas.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_map('trim', explode(',', Env::get('CORS_ORIGIN', 'http://localhost:5173')));
if ($origin !== '' && in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $request = Request::fromGlobals();
    $db = Db::pdo();
    $sellers = new SellerController($db);
    $customers = new CustomerController($db);
    $products = new ProductController($db);
    $quotes = new QuoteController($db);

    $router = new Router();
    $router->add('GET', '/health', static fn () => Response::json(['status' => 'ok']));

    foreach (['sellers' => $sellers, 'customers' => $customers, 'products' => $products] as $path => $c) {
        $router->add('GET', "/$path", [$c, 'index']);
        $router->add('POST', "/$path", [$c, 'store']);
        $router->add('GET', "/$path/{id}", [$c, 'show']);
        $router->add('PUT', "/$path/{id}", [$c, 'update']);
        $router->add('DELETE', "/$path/{id}", [$c, 'destroy']);
    }

    $router->add('GET', '/quotes', [$quotes, 'index']);
    $router->add('POST', '/quotes', [$quotes, 'store']);
    $router->add('GET', '/quotes/{id}', [$quotes, 'show']);
    $router->add('PUT', '/quotes/{id}', [$quotes, 'update']);
    $router->add('DELETE', '/quotes/{id}', [$quotes, 'destroy']);
    $router->add('POST', '/quotes/{id}/status', [$quotes, 'changeStatus']);

    $router->dispatch($request)->send();
} catch (ApiException $e) {
    $body = ['error' => $e->errorCode, 'message' => $e->getMessage()];
    if ($e->fields !== []) {
        $body['fields'] = $e->fields;
    }
    Response::json($body, $e->status)->send();
} catch (Throwable $e) {
    error_log((string) $e);
    Response::json(['error' => 'server_error', 'message' => 'Erro interno. Tente novamente.'], 500)->send();
}
