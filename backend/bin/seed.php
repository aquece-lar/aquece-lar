<?php

declare(strict_types=1);

// Carrega vendedores, clientes e produtos de exemplo (os mesmos dos mocks do front).
// Não mexe em nada se já houver vendedores cadastrados.
// Uso: php bin/seed.php

require __DIR__ . '/../src/bootstrap.php';

use App\Db;

$db = Db::pdo();
if ((int) $db->query('SELECT COUNT(*) FROM sellers')->fetchColumn() > 0) {
    echo "Já existem dados; nada a fazer.\n";
    exit(0);
}

$sellers = [
    ['Carlos Menezes', 'carlos.menezes@aquecelar.com.br', '(54) 99812-4410', 'Serra Gaúcha', 'Ativo'],
    ['Patrícia Lima', 'patricia.lima@aquecelar.com.br', '(54) 99637-2281', 'Caxias do Sul', 'Ativo'],
    ['Rafael Bortolini', 'rafael.bortolini@aquecelar.com.br', '(54) 99104-7752', 'Bento Gonçalves', 'Ativo'],
    ['Aline Costa', 'aline.costa@aquecelar.com.br', '(51) 99358-6604', 'Porto Alegre', 'Ativo'],
    ['Diego Ferraz', 'diego.ferraz@aquecelar.com.br', '(51) 99271-3390', 'Vale do Sinos', 'Ativo'],
    ['Tatiane Rocha', 'tatiane.rocha@aquecelar.com.br', '(54) 99725-1148', 'Campos de Cima da Serra', 'Ativo'],
    ['Gustavo Pereira', 'gustavo.pereira@aquecelar.com.br', '(54) 99480-9013', 'Serra Gaúcha', 'Inativo'],
    ['Larissa Antunes', 'larissa.antunes@aquecelar.com.br', '(51) 99196-5527', 'Litoral Norte', 'Inativo'],
];

$customers = [
    ['Restaurante Brasa Viva', 'PJ', '12.345.678/0001-90', '(54) 3222-1840', 'Caxias do Sul', 'Carlos Menezes'],
    ['Marcos Andrade', 'PF', '123.456.789-09', '(54) 99913-2207', 'Gramado', 'Patrícia Lima'],
    ['Condomínio Vale Verde', 'PJ', '23.456.789/0001-01', '(54) 3451-7720', 'Bento Gonçalves', 'Rafael Bortolini'],
    ['Juliana Teixeira', 'PF', '234.567.890-12', '(51) 99822-6631', 'Porto Alegre', 'Aline Costa'],
    ['Pousada Recanto da Serra', 'PJ', '34.567.890/0001-12', '(54) 3286-4415', 'Canela', 'Carlos Menezes'],
    ['Ricardo Moretto', 'PF', '345.678.901-23', '(51) 99634-0908', 'Novo Hamburgo', 'Diego Ferraz'],
    ['Espaço Gourmet Bento', 'PJ', '45.678.901/0001-23', '(54) 3452-9036', 'Bento Gonçalves', 'Patrícia Lima'],
    ['Ana Paula Ribeiro', 'PF', '456.789.012-34', '(54) 99157-8842', 'São Francisco de Paula', 'Tatiane Rocha'],
    ['Clube Recreativo Serrano', 'PJ', '56.789.012/0001-34', '(54) 3215-6650', 'Caxias do Sul', 'Rafael Bortolini'],
    ['Felipe Zanella', 'PF', '567.890.123-45', '(54) 99208-3176', 'Farroupilha', 'Aline Costa'],
    ['Hotel Bella Vista', 'PJ', '67.890.123/0001-45', '(54) 3295-1122', 'Nova Petrópolis', 'Carlos Menezes'],
    ['Beatriz Lazzari', 'PF', '678.901.234-56', '(54) 99476-5530', 'Flores da Cunha', 'Diego Ferraz'],
];

$products = [
    ['AQG-20D', 'Aquecedor a gás digital 20 L/min', 'Aquecedores a gás', 2890, 'Ativo'],
    ['AQG-33P', 'Aquecedor a gás de passagem 33 L/min', 'Aquecedores a gás', 4590, 'Ativo'],
    ['BLR-200', 'Boiler de acumulação 200 L', 'Boilers', 3790, 'Ativo'],
    ['LRL-900', 'Lareira a lenha 90 cm com vidro', 'Lareiras', 6490, 'Ativo'],
    ['PIS-AQ3', 'Aquecedor de piscina 3 kW', 'Piscina', 4190, 'Ativo'],
    ['CHM-150', 'Chaminé inox 150 mm (kit 3 m)', 'Acessórios', 1290, 'Ativo'],
    ['KIT-INS', 'Kit de instalação hidráulica', 'Acessórios', 480, 'Ativo'],
    ['VLV-GAS', 'Válvula de segurança para gás', 'Acessórios', 190, 'Ativo'],
    ['SRV-INS', 'Serviço de instalação e teste', 'Serviços', 650, 'Ativo'],
    ['AQG-15M', 'Aquecedor a gás mecânico 15 L/min', 'Aquecedores a gás', 1990, 'Inativo'],
    ['LRL-700', 'Lareira a lenha 70 cm (linha antiga)', 'Lareiras', 4890, 'Inativo'],
];

$db->beginTransaction();
$ids = [];
$insert = $db->prepare('INSERT INTO sellers (name, email, phone, region, status) VALUES (?, ?, ?, ?, ?)');
foreach ($sellers as $s) {
    $insert->execute($s);
    $ids[$s[0]] = $db->lastInsertId();
}
$insert = $db->prepare('INSERT INTO customers (name, kind, document, phone, city, seller_id) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($customers as [$name, $kind, $doc, $phone, $city, $seller]) {
    $insert->execute([$name, $kind, $doc, $phone, $city, $ids[$seller]]);
}
$insert = $db->prepare('INSERT INTO products (code, description, category, unit_price, status, inactivated_at) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($products as [$code, $description, $category, $price, $status]) {
    $insert->execute([$code, $description, $category, $price, $status, $status === 'Inativo' ? date('Y-m-d H:i:s') : null]);
}
$db->commit();

echo sprintf("%d vendedores, %d clientes e %d produtos criados.\n", count($sellers), count($customers), count($products));
