<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\SearchCondition;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 04b 保存した検索条件（レガシー版。docs/api/04b-saved-searches.md）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * だれが使うかは、AuthController::me() の JWT の処理を、メソッドごとにコピーして決める（これで 17〜20か所目）。
 * - 上限（5件）は、数えてから入れるだけ（ロックもトランザクションもない。同時に送ると超える）
 * - 条件の中身も名前も確かめない（jsonb に何でも入る）
 * - 有料かどうかの確かめは、検索（UserController::index）からコピーした（is_paid だけを見る）。直すほうにはコピーしていない
 * - 直す・消すは、持ち主を確かめない（ID を知っていれば、他人の条件を変えられる）
 */
class SearchConditionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() からコピーした（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // user_id にインデックスがないので、表を全部読む。行をそのまま返す（中の id・user_id も出る）
        // 「今の自分が使えるか」は返さない（画面が、有料かどうかの判断をもう一度書く）
        $rows = SearchCondition::where('user_id', $payload->sub)->orderBy('id')->get();

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        // index() と同じ処理を、もう一度コピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 送られた条件を、確かめずにそのまま使う（配列でも文字でも通る）
        $conditions = $request->input('conditions');

        // 07 の検索からコピーした：身長の条件は、男性の無料の会員は使えない（is_paid だけを見る。paid_until は見ない）
        if (is_array($conditions) && (! empty($conditions['height_min']) || ! empty($conditions['height_max']))) {
            $myProfile = Profile::where('user_id', $payload->sub)->first();
            $myUser = User::find($payload->sub);
            if ($myProfile?->gender === 'male' && ! $myUser->is_paid) {
                return response()->json(['message' => '有料会員になると使えます'], 403);
            }
        }

        // 数えてから入れる（ロックなし）。数えてから入れるまでのあいだに、ほかの保存が入れる
        $count = SearchCondition::where('user_id', $payload->sub)->count();
        if ($count >= 5) {
            return response()->json(['message' => '保存できるのは5件までです'], 422);
        }

        // name か conditions がなければ、NOT NULL の違反で 500
        $row = SearchCondition::create([
            'user_id' => $payload->sub,
            'name' => $request->input('name'),
            'conditions' => $conditions,
        ]);
        $row->refresh();   // public_id は DB の既定の値で入るので、読み直す

        return response()->json($row, 201);
    }

    public function update(Request $request, string $publicId): JsonResponse
    {
        // これで3回目のコピー
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 持ち主を確かめない（だれの条件でも見つかる）。なければ null で、下の update() が 500
        $row = SearchCondition::where('public_id', $publicId)->first();

        // 送られた項目を、そのまま全部入れる（user_id も書き換えられる）。有料かどうかの確かめは、ここにはない
        $row->update($request->all());

        return response()->json($row);
    }

    public function destroy(Request $request, string $publicId): JsonResponse|Response
    {
        // これで4回目のコピー
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 持ち主を確かめない。消えた行がなくても 204
        SearchCondition::where('public_id', $publicId)->delete();

        return response()->noContent();
    }
}
