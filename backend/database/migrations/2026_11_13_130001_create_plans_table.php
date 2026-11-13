<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（07）：有料のプラン（期間と、今の値段）。運営が値段を変えると、この行を書き換える。
 * どの環境でも要るので、3行をマイグレーションで入れる（1か月 3,980円・3か月 9,800円・6か月 16,800円。試しの値段）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('months');
            $table->integer('price');   // 円
            $table->timestamps();
        });

        $now = now();
        DB::table('plans')->insert([
            ['name' => '1か月', 'months' => 1, 'price' => 3980, 'created_at' => $now, 'updated_at' => $now],
            ['name' => '3か月', 'months' => 3, 'price' => 9800, 'created_at' => $now, 'updated_at' => $now],
            ['name' => '6か月', 'months' => 6, 'price' => 16800, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
