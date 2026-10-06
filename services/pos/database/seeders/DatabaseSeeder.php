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

        $products = [
            // Building-material catalogue (category is derived from the SKU prefix in the frontend).
            ['sku' => 'SMN-001', 'name' => 'Semen Portland 50 Kg', 'price' => '68000.00'],
            ['sku' => 'BTA-001', 'name' => 'Bata Merah Press', 'price' => '1200.00'],
            ['sku' => 'PSR-001', 'name' => 'Pasir Pasang', 'price' => '250000.00'],
            ['sku' => 'BJK-008', 'name' => 'Besi Beton 8 mm', 'price' => '55000.00'],
            ['sku' => 'CAT-005', 'name' => 'Cat Tembok Putih 5 Kg', 'price' => '95000.00'],
            ['sku' => 'KRM-040', 'name' => 'Keramik Lantai 40×40 cm', 'price' => '62000.00'],
            ['sku' => 'PKU-005', 'name' => 'Paku Beton 5 cm', 'price' => '28000.00'],
            ['sku' => 'PLY-012', 'name' => 'Plywood 12 mm', 'price' => '165000.00', 'is_active' => false],
            ['sku' => 'PVC-003', 'name' => 'Pipa PVC 3 Inch', 'price' => '85000.00'],

            // Required by scripts/e2e-scenarios.sh — keep SKU and price unchanged:
            // test scenario S1 exactly (100k/50k/200k); PAKU-5CM is the cheap item for the discount/parallel checks;
            // OLD-001 is the inactive product that must be rejected at checkout.
            ['sku' => 'CAT-5KG', 'name' => 'Cat Tembok Interior 5 kg', 'price' => '100000.00'],
            ['sku' => 'SMN-40KG', 'name' => 'Semen Portland 40 kg', 'price' => '50000.00'],
            ['sku' => 'PIPA-PVC4', 'name' => 'Pipa PVC 4 inch 4 m', 'price' => '200000.00'],
            ['sku' => 'PAKU-5CM', 'name' => 'Paku 5 cm (1 kg)', 'price' => '25000.00'],
            ['sku' => 'OLD-001', 'name' => 'Produk Lama (nonaktif)', 'price' => '12000.00', 'is_active' => false],
        ];
        foreach ($products as $product) {
            Product::firstOrCreate(['sku' => $product['sku']], [...$product, 'is_active' => $product['is_active'] ?? true]);
        }
    }
}
