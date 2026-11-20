<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Middleware\AuthenticateUser;
use Illuminate\Http\Request;
use LogicException;

abstract class Controller
{
    /**
     * ログインしている会員の番号（users.id）。ログインを確かめる Middleware（AuthenticateUser）が載せる。
     * 載っていないのは、ルートに Middleware を付け忘れたとき（プログラムの誤り）。「会員 0 番」として動かず、
     * エラーのログに残る 500 にする（利用者の「ログインしていない」の 401 にすると、ログに残らず気づけない）
     */
    protected function loginUserId(Request $request): int
    {
        $id = $request->attributes->get(AuthenticateUser::LOGIN_USER_ID);
        if (! is_int($id)) {
            throw new LogicException('ログインしている会員の番号が載っていない。このルートに user.authenticate を付け忘れている');
        }

        return $id;
    }
}
