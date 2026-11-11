<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 素朴な版（01 の作り直し。D-015）：users（アカウント）と profiles（その会員についての情報）に分ける。
 * 以前の形に近く、profiles は自分の id と、外部キーも UNIQUE もない user_id を持ち、列は文字のまま・制約なし。
 * 流したマイグレーションは書き換えず、新しいマイグレーションで「作る → 写す → 消す」の順に進める。
 */
return new class extends Migration
{
    private const MOVED = ['gender', 'birthday', 'prefecture', 'height', 'introduction', 'image'];

    public function up(): void
    {
        // ① 新しい表を作る
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');   // 外部キーも UNIQUE もない（素朴な版）
            $table->string('nickname')->nullable();
            $table->string('gender')->nullable();
            $table->string('birthday')->nullable();
            $table->string('prefecture')->nullable();
            $table->string('height')->nullable();
            $table->text('introduction')->nullable();
            $table->string('image')->nullable();
            $table->timestamps();
        });

        // ② 今の会員のプロフィールを写す（users.name は nickname に）
        DB::statement('
            INSERT INTO profiles (user_id, nickname, gender, birthday, prefecture, height, introduction, image, created_at, updated_at)
            SELECT id, name, gender, birthday, prefecture, height, introduction, image, created_at, updated_at
            FROM users
        ');

        // ③ 写したあとに、users から消す
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['name', ...self::MOVED]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable();
            $table->string('gender')->nullable();
            $table->string('birthday')->nullable();
            $table->string('prefecture')->nullable();
            $table->string('height')->nullable();
            $table->text('introduction')->nullable();
            $table->string('image')->nullable();
        });

        // 1人に複数のプロフィールがあるときは、id がいちばん小さいものを戻す
        DB::statement('
            UPDATE users u SET
                name = p.nickname, gender = p.gender, birthday = p.birthday, prefecture = p.prefecture,
                height = p.height, introduction = p.introduction, image = p.image
            FROM (SELECT DISTINCT ON (user_id) * FROM profiles ORDER BY user_id, id) p
            WHERE p.user_id = u.id
        ');

        Schema::dropIfExists('profiles');
    }
};
