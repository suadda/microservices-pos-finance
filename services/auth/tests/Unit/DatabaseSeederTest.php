<?php

namespace Tests\Unit;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['seeding.demo_users' => false, 'seeding.admin' => ['name' => 'Root', 'email' => null, 'password' => null]]);
    }

    public function test_demo_users_enabled_by_default_in_config(): void
    {
        $config = require base_path('config/seeding.php');

        $this->assertTrue($config['demo_users']);
    }

    public function test_no_users_when_demo_flag_off_and_no_admin(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, User::count());
    }

    public function test_admin_bootstrapped_once_and_never_overwritten(): void
    {
        config(['seeding.admin.email' => 'owner@example.com', 'seeding.admin.password' => 'a-long-admin-password']);
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'owner@example.com')->firstOrFail();
        $this->assertSame('superadmin', $admin->role);
        $this->assertTrue(Hash::check('a-long-admin-password', $admin->password));

        config(['seeding.admin.password' => 'another-long-password']);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, User::count());
        $this->assertTrue(Hash::check('a-long-admin-password', $admin->fresh()->password));
    }

    public function test_short_admin_password_is_rejected(): void
    {
        config(['seeding.admin.email' => 'owner@example.com', 'seeding.admin.password' => 'short']);

        $this->expectException(RuntimeException::class);
        $this->seed(DatabaseSeeder::class);
    }

    public function test_demo_users_seeded_only_with_flag_and_deactivated_when_flag_off(): void
    {
        config(['seeding.demo_users' => true]);
        $this->seed(DatabaseSeeder::class);

        $demoCount = count(DatabaseSeeder::demoUsers());
        $this->assertSame($demoCount, User::where('is_active', true)->count());

        config(['seeding.demo_users' => false]);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, User::where('email', 'like', '%@demo.test')->where('is_active', true)->count());
        $this->assertSame($demoCount, User::count(), 'demo accounts are deactivated, not deleted');
    }
}
