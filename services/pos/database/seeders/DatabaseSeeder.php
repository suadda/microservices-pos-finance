<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Demo outlets & building-material products. Idempotent. Outlet ids are fixed because db_auth.users.outlet_id refers to them.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $outlets = [
            ['id' => 1, 'code' => 'BDG', 'name' => 'Outlet Bandung', 'address' => 'Jl. Asia Afrika No. 1, Bandung'],
            ['id' => 2, 'code' => 'GRT', 'name' => 'Outlet Garut', 'address' => 'Jl. Ahmad Yani No. 10, Garut'],
            ['id' => 3, 'code' => 'SKB', 'name' => 'Outlet Sukabumi', 'address' => 'Jl. Siliwangi No. 5, Sukabumi'],
            ['id' => 4, 'code' => 'TSM', 'name' => 'Outlet Tasikmalaya', 'address' => 'Jl. HZ Mustofa No. 7, Tasikmalaya'],
        ];
        Outlet::unguarded(function () use ($outlets) {
            foreach ($outlets as $outlet) {
                Outlet::firstOrCreate(['id' => $outlet['id']], [...$outlet, 'is_active' => true]);
            }
        });

        // test scenario S1 exactly; PAKU-5CM is the cheap item used by the e2e discount/parallel checks.
        $products = [
            ['sku' => 'CAT-5KG', 'name' => 'Cat Tembok Interior 5 kg', 'price' => '100000.00'],
            ['sku' => 'SMN-40KG', 'name' => 'Semen Portland 40 kg', 'price' => '50000.00'],
            ['sku' => 'PIPA-PVC4', 'name' => 'Pipa PVC 4 inch 4 m', 'price' => '200000.00'],
            ['sku' => 'PAKU-5CM', 'name' => 'Paku 5 cm (1 kg)', 'price' => '25000.00'],
            ['sku' => 'BESI-10', 'name' => 'Besi Beton 10 mm (12 m)', 'price' => '85000.00'],
            ['sku' => 'KRMK-4040', 'name' => 'Keramik Lantai 40x40 (per dus)', 'price' => '65000.00'],
            ['sku' => 'BATA-RGN', 'name' => 'Bata Ringan 10 cm (per pcs)', 'price' => '9500.00'],
            ['sku' => 'TRPK-9', 'name' => 'Triplek 9 mm 122x244', 'price' => '95000.00'],
            ['sku' => 'PSR-KRG', 'name' => 'Pasir Cor (per karung)', 'price' => '18000.00'],
            ['sku' => 'SMN-INS25', 'name' => 'Semen Instan Perekat Keramik 25 kg', 'price' => '95000.00'],
            ['sku' => 'GYP-9MM', 'name' => 'Gypsum 9 mm 120x240', 'price' => '75000.00'],
            ['sku' => 'KBL-NYA15', 'name' => 'Kabel NYA 1,5 mm (roll 50 m)', 'price' => '380000.00'],
            ['sku' => 'KRAN-12', 'name' => 'Kran Air 1/2 inch', 'price' => '35000.00'],
            ['sku' => 'ENGSL-4', 'name' => 'Engsel Pintu Stainless 4 inch', 'price' => '28000.00'],
            ['sku' => 'LEM-PVC', 'name' => 'Lem Pipa PVC 100 g', 'price' => '15000.00'],
            ['sku' => 'KUAS-3', 'name' => 'Kuas Cat 3 inch', 'price' => '12000.00'],
            ['sku' => 'OLD-001', 'name' => 'Produk Lama (nonaktif)', 'price' => '12000.00', 'is_active' => false],
        ];
        foreach ($products as $product) {
            Product::firstOrCreate(['sku' => $product['sku']], [...$product, 'is_active' => $product['is_active'] ?? true]);
        }
    }
}
