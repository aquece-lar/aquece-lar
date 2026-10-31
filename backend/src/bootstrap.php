<?php

declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

require __DIR__ . '/Core.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\Controllers\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__ . '/Controllers/' . substr($class, strlen($prefix)) . '.php';
    }
});

App\Env::load(__DIR__ . '/../.env');
