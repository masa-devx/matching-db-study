<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * ログインしている会員の番号（users.id）。ログインを確かめる Middleware（AuthenticateUser）が載せる。
     * 載っていない（ルートに Middleware を付け忘れた）ときは、「会員 0 番」として動かずに 401 にする
     */
    protected function loginUserId(Request $request): int
    {
        $id = $request->attributes->get('login_user_id');
        if (! is_int($id)) {
            throw new AuthenticationException;
        }

        return $id;
    }
}
