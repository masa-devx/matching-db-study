<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\VerifyMail;
use App\Models\Block;
use App\Models\Like;
use App\Models\Profile;
use App\Models\Skip;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 01b 登録（レガシー版。docs/api/01b-auth.md）。
 * 入力を確かめない・トランザクションがない。応答に確認用の文字が出ていた（今は User の #[Hidden] で隠す）。改善する段階で、要件 ID のテストにする。
 * 04 で、相手を探す index() を足した（docs/api/04-search.md）。OFFSET で20人ずつ・1＋N 本・条件は文字で比べる。
 * 06 で、退会の destroy() を足し（docs/api/06-blocks-withdrawal.md）、検索からブロックした・された相手と退会した会員を除いた。
 * #269 で、アカウント停止・強制退会の会員も除いた（User の accountUsable()。Controller → Service には、まだ移していない）。
 * 07 で、身長の条件を男性の無料の会員には使わせないようにした（送ったときだけ2本増える。docs/api/07-paid-members.md）。
 */
class UserController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // password は User の casts の 'hashed' で bcrypt になる
        $user = User::create($request->only(['email', 'password']) + [
            'verification_token' => Str::random(40),   // 平文・期限なし
        ]);

        Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);

        // ここで失敗しても、会員とプロフィールは残る（トランザクションがない）
        Mail::to($user->email)->send(new VerifyMail($user));

        return response()->json($user, 201);
    }

    public function index(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);

        // #150：有料の機能は、最終ログイン・登録して間もない会員・フリーワード・登録が新しい順の4つ（身長は無料にした）。
        // 男性の無料の会員は使えない（送ったときだけ確かめる。すぐ下で同じプロフィールをもう一度読む）
        if ($request->filled('last_login') || $request->filled('new_member') || $request->filled('keyword') || $request->input('sort') === 'new') {
            // 07：男性の無料の会員は使えない（is_paid だけを見る。paid_until は見ない。送る・いいね・検索に写した）
            $myProfile = Profile::where('user_id', $loginUserId)->first();
            $myUser = User::find($loginUserId);
            if ($myProfile?->gender === 'male' && ! $myUser->is_paid) {
                return response()->json(['message' => '有料会員になると使えます'], 403);
            }
        }

        // 性別を送らなければ、自分の反対の性別（male でなければ、みな male を探す）
        $me = Profile::where('user_id', $loginUserId)->first();
        $gender = $request->input('gender', $me?->gender === 'male' ? 'female' : 'male');

        // いいねした相手を全部 PHP に持ってきて、not in に並べる（いいねが増えるほど SQL が長くなる）
        $likedIds = Like::where('from_user_id', $loginUserId)->pluck('to_user_id');

        // 06：ブロックした・された相手を、向きごとに PHP に持ってくる（いいねを除くのと同じ形。ほかの一覧にも写す）
        $blocked = Block::where('blocker_id', $loginUserId)->pluck('blocked_id');     // UNIQUE の先頭なので索引が効く
        $blockedMe = Block::where('blocked_id', $loginUserId)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        // M3（#184）：スキップした相手も、同じ形で PHP に持ってきて除く（索引がなく、表を全部読む）
        $skipIds = Skip::where('skipper_id', $loginUserId)->pluck('skipped_id');

        $page = (int) $request->input('page', 1);

        $query = User::whereNotNull('email_verified_at')
            ->where('id', '!=', $loginUserId)
            ->whereNotIn('id', $likedIds)
            ->whereNotIn('id', $blockIds)
            ->whereNotIn('id', $skipIds)
            // ほかの会員に見せない会員（退会・アカウント停止・強制退会）を除く。条件は User の accountUsable() の1か所（FR-WD-005・013）
            ->accountUsable()
            // 条件は profiles にあるので exists（相関サブクエリ）で絞る。送られた条件だけを足し、値は確かめない
            ->whereHas('profile', function (Builder $q) use ($request, $gender) {
                $q->where('gender', $gender);
                // 年齢の幅を、生年月日の幅に直す。生年月日は文字の列なので、文字で比べる
                if ($request->filled('age_min')) {
                    $q->where('birthday', '<=', now()->subYears((int) $request->input('age_min'))->format('Y-m-d'));
                }
                if ($request->filled('age_max')) {
                    $q->where('birthday', '>', now()->subYears((int) $request->input('age_max') + 1)->format('Y-m-d'));
                }
                if ($request->filled('prefecture')) {
                    $q->whereIn('prefecture', $request->input('prefecture'));   // 配列でなければ 500
                }
                // 身長も文字の列なので、'99' >= '170' が真になる
                if ($request->filled('height_min')) {
                    $q->where('height', '>=', $request->input('height_min'));
                }
                if ($request->filled('height_max')) {
                    $q->where('height', '<=', $request->input('height_max'));
                }
                // #153：体型・お仕事・年収・タバコ・お酒・結婚歴。選択肢の名前（文字）の配列で来る（配列でなければ 500）。
                // 選択肢にない文字でも、そのまま探す。未回答（NULL）の会員は in に当たらないので出ない。
                // 年収も文字なので「500万円以上」とは比べられず、当てはまる区分を全部選んでもらう。同じ6行を並べた
                if ($request->filled('body_type')) {
                    $q->whereIn('body_type', $request->input('body_type'));
                }
                if ($request->filled('job')) {
                    $q->whereIn('job', $request->input('job'));
                }
                if ($request->filled('income')) {
                    $q->whereIn('income', $request->input('income'));
                }
                if ($request->filled('smoking')) {
                    $q->whereIn('smoking', $request->input('smoking'));
                }
                if ($request->filled('drinking')) {
                    $q->whereIn('drinking', $request->input('drinking'));
                }
                if ($request->filled('marital_status')) {
                    $q->whereIn('marital_status', $request->input('marital_status'));
                }
                // #150：フリーワード。自己紹介かニックネームに、その言葉が入っている会員。
                // 前後に % を付けるので索引は使えない。言葉の中の % と _ はそのまま渡る（% だけ送ると全員に当たる）。長さも確かめない
                if ($request->filled('keyword')) {
                    $keyword = $request->input('keyword');
                    $q->where(function (Builder $w) use ($keyword) {
                        $w->where('introduction', 'like', '%'.$keyword.'%')
                            ->orWhere('nickname', 'like', '%'.$keyword.'%');
                    });
                }
            });

        // #150：最終ログイン。24h・3d・7d のどれか（ほかの値は、何も絞らずに通る）
        $since = null;
        if ($request->input('last_login') === '24h') {
            $since = now()->subDay();
        } elseif ($request->input('last_login') === '3d') {
            $since = now()->subDays(3);
        } elseif ($request->input('last_login') === '7d') {
            $since = now()->subDays(7);
        }
        if ($since) {
            // #162：登録したばかりで、まだ一度もログインしていない会員（last_login_at が NULL）も出す。
            // 登録した日時を、最終ログインの代わりに見る。or が入るので、last_login_at の索引があっても使いにくい
            $query->where(function (Builder $w) use ($since) {
                $w->where('last_login_at', '>=', $since)
                    ->orWhere(function (Builder $n) use ($since) {
                        $n->whereNull('last_login_at')->where('created_at', '>=', $since);
                    });
            });
        }
        // #150：登録して1週間以内の会員だけ。created_at に索引はない
        if ($request->filled('new_member')) {
            $query->where('created_at', '>=', now()->subDays(7));
        }

        // #150：並び替え。sort=new なら登録が新しい順（同じ時刻の並びが決まらないのは、下と同じ）
        if ($request->input('sort') === 'new') {
            $query->orderBy('created_at', 'desc');
        } else {
            // 最終ログインだけで並べる。同じ時刻の並びが決まらない。desc なので NULL（ログインしていない）が先頭に出る
            $query->orderBy('last_login_at', 'desc');
        }

        $users = $query
            // 飛ばす行も読んでから捨てる。読んでいるあいだにだれかがログインすると、重なる・抜ける
            ->offset(($page - 1) * 20)
            ->limit(20)
            ->get();

        foreach ($users as $user) {
            $user->load('profile');   // 1人ずつプロフィールを読む（1＋N）
        }

        // users の行をそのまま返す（メールアドレス・生年月日も出る。確認用の文字は User の #[Hidden] で隠す）
        return response()->json($users);
    }

    public function destroy(Request $request): JsonResponse|Response
    {
        $loginUserId = $this->loginUserId($request);

        $user = User::find($loginUserId);
        if (! Hash::check((string) $request->input('password'), $user->password)) {
            return response()->json(['message' => 'パスワードが違います'], 422);
        }

        // メールアドレスの UNIQUE とぶつからないよう、書き換えて空ける（元のメールアドレスは残らない）。
        // 元が 237文字以上だと 255文字を超えて 500。持っていた JWT は、次のリクエストから user.authenticate が断る
        $user->update([
            'email' => $user->email.'#deleted#'.time(),
            'deleted_at' => now(),
        ]);

        return response()->noContent();
    }
}
