<?php

declare(strict_types=1);

// Cria o banco (se não existir) e as tabelas. Pode rodar mais de uma vez.
// Uso: php bin/migrate.php

require __DIR__ . '/../src/bootstrap.php';

use App\Db;
use App\Env;

$name = Env::get('DB_NAME', 'aquece_lar');
if (!preg_match('/^\w+$/', $name)) {
    fwrite(STDERR, "DB_NAME inválido.\n");
    exit(1);
}

$server = Db::connect(null);
$server->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");

$db = Db::connect($name);
$statements = preg_split('/;\s*\n/', (string) file_get_contents(__DIR__ . '/../database/schema.sql'));
foreach ($statements as $sql) {
    if (trim($sql) !== '') {
        $db->exec($sql);
    }
}
echo "Banco '$name' pronto.\n";
