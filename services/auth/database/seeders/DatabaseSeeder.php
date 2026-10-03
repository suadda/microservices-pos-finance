<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Runs on every container start (idempotent).
 *
 * - Bootstraps the first superadmin from ADMIN_EMAIL / ADMIN_PASSWORD (created once, never overwritten).
 * - Test accounts (*@demo.test, shared password, listed in README) are seeded while SEED_DEMO_USERS is on (default).
 *   When the flag is turned off, any existing demo accounts are deactivated so the shared password stops working.
 *
 * Outlet ids match the POS seeder: 1 = BDG, 2 = GRT, 3 = SKB, 4 = TSM.
 */
class DatabaseSeeder extends Seeder
{
    public const DEMO_DOMAIN = '@demo.test';

    public const DEMO_PASSWORD = 'password123';

    public const ADMIN_MIN_PASSWORD = 12;

    public function run(): void
    {
        $this->seedAdmin();

        if (config('seeding.demo_users')) {
            $this->seedDemoUsers();
        } else {
            $this->deactivateDemoUsers();
        }
    }

    private function seedAdmin(): void
    {
        $email = trim((string) config('seeding.admin.email'));
        if ($email === '') {
            return;
        }

        if (User::where('email', $email)->exists()) {
            return;
        }

        $password = (string) config('seeding.admin.password');
        if (strlen($password) < self::ADMIN_MIN_PASSWORD) {
            throw new RuntimeException('ADMIN_PASSWORD must be at least '.self::ADMIN_MIN_PASSWORD.' characters to create '.$email);
        }

        User::create([
            'name' => (string) config('seeding.admin.name', 'Super Admin'),
            'email' => $email,
            'password' => $password,
            'role' => 'superadmin',
            'outlet_id' => null,
            'is_active' => true,
        ]);
        $this->command?->info("Superadmin {$email} created.");
    }

    private function seedDemoUsers(): void
    {
        $this->command?->warn('SEED_DEMO_USERS=true: demo accounts with a shared password are active. Local use only.');

        foreach (self::demoUsers() as $user) {
            // Password only set on creation; re-activates accounts deactivated while the flag was off.
            User::firstOrCreate(['email' => $user['email']], [...$user, 'password' => self::DEMO_PASSWORD])
                ->update(['is_active' => true]);
        }
    }

    private function deactivateDemoUsers(): void
    {
        $count = User::where('email', 'like', '%'.self::DEMO_DOMAIN)->where('is_active', true)->update(['is_active' => false]);
        if ($count > 0) {
            $this->command?->warn("Deactivated {$count} demo account(s) (SEED_DEMO_USERS is off).");
        }
    }

    /** @return list<array{name: string, email: string, role: string, outlet_id: int|null}> */
    public static function demoUsers(): array
    {
        $users = [
            ['name' => 'Super Admin', 'email' => 'superadmin'.self::DEMO_DOMAIN, 'role' => 'superadmin', 'outlet_id' => null],
            ['name' => 'Staff Finance', 'email' => 'staff.finance'.self::DEMO_DOMAIN, 'role' => 'staff_finance', 'outlet_id' => null],
            ['name' => 'Manager Finance', 'email' => 'manager.finance'.self::DEMO_DOMAIN, 'role' => 'manager_finance', 'outlet_id' => null],
        ];
        foreach ([1 => ['bdg', 'Bandung'], 2 => ['grt', 'Garut'], 3 => ['skb', 'Sukabumi'], 4 => ['tsm', 'Tasikmalaya']] as $outletId => [$code, $city]) {
            $users[] = ['name' => "Kasir {$city}", 'email' => "kasir.{$code}".self::DEMO_DOMAIN, 'role' => 'kasir', 'outlet_id' => $outletId];
            $users[] = ['name' => "Supervisor {$city}", 'email' => "supervisor.{$code}".self::DEMO_DOMAIN, 'role' => 'supervisor_pos', 'outlet_id' => $outletId];
        }

        return $users;
    }
}
