<?php

// Read by DatabaseSeeder (runs on every container start). Kept in config so values survive `config:cache`.
return [
    // Test accounts (*@demo.test, shared password, listed in README). On by default so the stack is usable after one
    // `docker compose up`. Set SEED_DEMO_USERS=false on public deployments; existing demo accounts are then deactivated.
    'demo_users' => (bool) env('SEED_DEMO_USERS', true),

    // First superadmin, created only if the email does not exist yet. Password is never overwritten afterwards.
    'admin' => [
        'name' => env('ADMIN_NAME', 'Super Admin'),
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],
];
