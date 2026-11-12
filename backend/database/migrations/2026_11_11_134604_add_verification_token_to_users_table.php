<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（01b）：メールアドレスの確認に使う文字を、users に平文で持つ。
 * 有効期限の列は持たず、確認したかどうかは、ひな形の email_verified_at を使う。
 * 改善する段階で、署名つきのリンク（DB に持たない）に変え、この列は使わなくする（explanations/01b-auth.html）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('verification_token')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('verification_token');
        });
    }
};
