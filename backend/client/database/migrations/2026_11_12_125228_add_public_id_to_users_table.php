<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * #46：URL で会員を指す ID（D-022）。中の id（bigint）と、表どうしのつながり・JWT の sub はそのまま。
 * 値は DB が作る（PostgreSQL 18 の uuidv7()。時刻の順に並ぶ UUID）。どこから行を入れても必ず入る。
 * 列を足すときに、今いる会員の行にも1行ずつ別の値が入る（既定の値が関数なので、表を書き直す）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('public_id')->default(new Expression('uuidv7()'))->unique();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }
};
