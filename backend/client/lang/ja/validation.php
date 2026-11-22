<?php

declare(strict_types=1);

// 入力の形の確かめ（FormRequest）で、422 の errors に出す文。使う決まりができたときに足す（書いていない決まりは、英語の文が出る）。
// 項目の名前（:attribute）は、FormRequest の attributes() で決める（同じ password でも、画面によって呼び方が違うため）
return [
    'required' => ':attributeを入れてください',
    'string' => ':attributeは文字で入れてください',
    'min' => [
        'string' => ':attributeは:min文字以上にしてください',
    ],
    'max' => [
        'string' => ':attributeは:max文字以内にしてください',
    ],
    // Laravel にない決まり。パスワードの72バイト（FR-AUTH-004。ChangePasswordRequest）
    'max_bytes' => ':attributeは:maxバイト以内にしてください',
];
