<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 05c 画面が Firebase（手元の Emulator）にログインするためのカスタムトークンを出す（レガシー版。docs/api/05c-firestore.md）。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。確認していない会員も使える。
 * Auth の Emulator はカスタムトークンの署名と期限を確かめないので、署名のない JWT（alg: none）を返す。
 * 本物の Firebase では通らない（サービスアカウントの鍵で RS256 の署名が要る。改善版で環境ごとに分ける）。
 */
class FirebaseTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        // Firebase の uid は、会員の public_id（Firestore の受信箱のパスと、ルールの request.auth.uid に使う）
        $uid = User::where('id', $loginUserId)->value('public_id');

        // firebase/php-jwt は alg: none を作らないので、ヘッダーと中身を base64url にして、署名を空のままつなぐ
        $b64 = fn (array $part): string => rtrim(strtr(base64_encode((string) json_encode($part)), '+/', '-_'), '=');
        $now = time();
        $custom = $b64(['alg' => 'none', 'typ' => 'JWT']).'.'.$b64([
            // 本物ならサービスアカウントのメールアドレス。Emulator は確かめないので、偽の名前にする
            'iss' => 'emulator@demo-matching.iam.gserviceaccount.com',
            'sub' => 'emulator@demo-matching.iam.gserviceaccount.com',
            'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            'iat' => $now,
            'exp' => $now + 3600,
            'uid' => $uid,
        ]).'.';

        return response()->json(['token' => $custom, 'uid' => $uid]);
    }
}
