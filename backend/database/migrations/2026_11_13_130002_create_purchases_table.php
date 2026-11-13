<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（07）：購入の記録（だれが・どのプランを・いつ）。
 * 値段と期間は持たず、プランを指すだけ（値段を変えると、前の記録の値段も変わって見える）。
 * 外部キーを持ち、インデックスは足さない（user_id だけで探すと表を全部読む）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
