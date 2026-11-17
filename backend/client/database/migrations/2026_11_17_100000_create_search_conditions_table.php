<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（04b）：保存した検索条件。会員が、検索の条件に名前を付けて取っておく（1人5件まで）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - user_id は数の列だけ（外部キーなし・インデックスなし）。会員を消しても行が残り、user_id で探すと表を全部読む
 * - conditions は jsonb。中身は検索の API のクエリと同じ項目（age_min・prefecture など）。DB は中身を確かめない
 * - name の長さ・5件の上限は、DB では確かめない
 * - public_id は URL と応答で条件を指す ID（D-022。DB の uuidv7() で入る）
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('search_conditions', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->default(new Expression('uuidv7()'))->unique();
            $table->unsignedBigInteger('user_id');   // 持ち主。外部キーもインデックスもなし
            $table->string('name');                  // パターンの名前（長さは確かめない）
            $table->jsonb('conditions');             // 条件の中身（何でも入る）
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('search_conditions');
    }
};
