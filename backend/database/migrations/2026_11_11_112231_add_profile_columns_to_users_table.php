<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（01）：プロフィールの列を users に足す。
 * Laravel 5 系のころによくあった形で、全部を文字で持ち、制約は付けない。
 * 表示名は、ひな形にある name を使う。
 * 直す段階で、profiles に分け、型と制約を DB に持たせる（explanations/01-members.html）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('gender')->nullable();
            $table->string('birthday')->nullable();
            $table->string('prefecture')->nullable();
            $table->string('height')->nullable();
            $table->text('introduction')->nullable();
            $table->string('image')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['gender', 'birthday', 'prefecture', 'height', 'introduction', 'image']);
        });
    }
};
