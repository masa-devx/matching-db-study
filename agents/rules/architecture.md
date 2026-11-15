---
paths:
  - "backend/*/app/**"
  - "backend/*/routes/**"
  - "backend/*/bootstrap/app.php"
  - "backend/*/tests/**"
  - "frontend/*/src/**"
---

# architecture（改訂版）

改訂版（`refactored-repo`）で、置き場・責務・依存の向きを決めるときの決まりと、書き方。会員の側（`backend/client`）と管理画面（`backend/admin`）の両方に当てはめる。

- 全体の地図（業務のまとまりの一覧・どのアプリがどの表を書くか・今のファイルの移行の地図・やり直しのきっかけ）は [docs/backend.md](../../docs/backend.md)
- なぜこの形にしたかは [docs/cycles/01-backend-foundation/03-how.md](../../docs/cycles/01-backend-foundation/03-how.md)
- レガシー版（Fat Controller・テストなし）の書き方は、`legacy-repo` の同じ名前のファイル。改訂版では使わない
- 画面（`frontend/`）には、9章の共通の原則だけを当てはめる。画面の置き場は [docs/frontend.md](../../docs/frontend.md)

## 1. 迷ったときの判断の順

新しいコードを書く前に、上から順に問う。

1. **業務の決まりか？**（「無料の男性は1日10回まで」「お互いにいいねしたらマッチ」）→ Domain
2. **1つの操作の手順か？**（確かめる → 保存する → 外へ知らせる）→ Application の UseCase
3. **HTTP の形か？**（入力の形・状態コード・JSON の項目）→ Http
4. **DB・外のサービス・Laravel の都合か？**（SQL・Eloquent・Firestore・JWT・トランザクションの張り方）→ Infrastructure
5. **読み取り（一覧・検索・集計）だけか？** → Infrastructure の QueryService（Domain を通さない）
6. どの業務のまとまりにも属さない基盤（SQL のログ・リクエスト ID）→ `app/Support/`

## 2. 層と依存の向き

**DIP（依存性逆転）を使ったレイヤードアーキテクチャ。** 矢印はすべて Domain に向く。Domain はだれにも依存しない。

```text
Http ──→ Application ──→ Domain ←── Infrastructure
  ├───────────────────→ Domain（例外・値オブジェクト・enum）
  └──→ Infrastructure の QueryService（読み取りだけ）
Providers：interface と実装をつなぐ（全部を知ってよい唯一の場所）
```

| 層 | 受け持ち | 使ってよい相手 | 使ってはいけない相手 | Laravel |
| --- | --- | --- | --- | --- |
| Http | 外との入出力 | Application・Domain の例外と型・Infrastructure の QueryService | Infrastructure の Repository と Model | 使ってよい |
| Application | 1つの操作の手順・トランザクションの区切り | Domain | Http・Infrastructure | **使わない** |
| Domain | 業務の決まり | なし（PHP の標準だけ） | ほかの全部の層 | **使わない** |
| Infrastructure | 約束の実装・DB・外のサービス | Domain・Application の interface と Dto | Http・Application の UseCase | 使ってよい |

- 「Laravel を使わない」には、ファサード（`DB::`・`Log::`・`Cache::`）・ヘルパー（`now()`・`config()`・`env()`・`collect()`・`abort()`）・Carbon・Eloquent・`Illuminate\` のクラスをすべて含む
- この表は `tests/Arch/LayersTest.php` で機械で守る（8章）。破るときは、先にこのファイルを直す

## 3. ディレクトリと名前

各層の中は**業務のまとまり**（会員の側：`Auth`・`Members`・`Matching`・`Messaging`・`Billing`。管理画面：`Dashboard`・`Members`・`Messages`・`Sales`・`Plans`・`AuditLogs`・`Admins`）のフォルダで分け、**名前を全部の層でそろえる**。Domain の中は、さらに集約でフォルダを分ける。まとまりの一覧は [docs/backend.md](../../docs/backend.md)。

```text
app/
├── Http/
│   ├── Controllers/<まとまり>/〜Controller.php
│   ├── Requests/<まとまり>/〜Request.php
│   ├── Resources/<まとまり>/〜Resource.php
│   └── Middleware/
├── Application/
│   ├── UseCases/<まとまり>/〜UseCase.php
│   ├── Dtos/<まとまり>/〜Input.php・〜Output.php
│   └── Transaction/TransactionManagerInterface.php
├── Domain/
│   ├── Shared/ClockInterface.php
│   ├── <まとまり>/<集約>/      エンティティ・値オブジェクト・enum・〜RepositoryInterface・〜Exception
│   └── <まとまり>/Services/    ドメインサービス
├── Infrastructure/
│   ├── Models/
│   ├── Repositories/<まとまり>/Eloquent〜Repository.php
│   ├── QueryServices/<まとまり>/〜QueryService.php
│   ├── External/<サービス>/
│   ├── Transaction/LaravelTransactionManager.php
│   └── Clock/SystemClock.php
├── Providers/RepositoryServiceProvider.php
└── Support/                    どのまとまりにも属さない基盤
```

| もの | 名前 | 例 |
| --- | --- | --- |
| Controller | `<名詞>Controller`。メソッドは `index`・`show`・`store`・`update`・`destroy` | `LikeController::store` |
| Request | `<動詞><名詞>Request`。書き込みは `toInput()` で Input を返す | `StoreLikeRequest` |
| Resource | `<名詞>Resource` | `LikeResultResource` |
| UseCase | `<動詞><名詞>UseCase`。公開するメソッドは `execute()` だけ | `LikeMemberUseCase` |
| Dto | UseCase の名前から `UseCase` を除いて `Input`・`Output` | `LikeMemberInput` |
| interface | `〜Interface` | `LikeRepositoryInterface`・`ChatSyncInterface` |
| Repository の実装 | `Eloquent〜Repository` | `EloquentLikeRepository` |
| QueryService | `<名詞>QueryService` | `SearchMembersQueryService` |
| 外のサービスの実装 | `<仕組み><役割>` | `FirestoreChatSync`・`JwtTokenService` |
| 業務の例外 | `〜Exception` | `PaidPlanRequiredException` |
| エンティティの作り方 | 新しく作る `create()`（確かめる）・DB から作り直す `reconstruct()`（確かめを省く） | `Like::create()` |

- 1ファイル1クラス。クラスはすべて `final`（継承させる理由があるときだけ外す）。値を運ぶだけのものは `final readonly`
- `declare(strict_types=1);` と型は `quality-types.md` に従う

## 4. 層ごとの書き方

例は「いいねする」（`POST /api/me/likes`）。各層の見本は、移したら [docs/backend.md](../../docs/backend.md) の「見本のファイル」に書く。

### 4-1. Http

Controller は**受け取る → 呼ぶ → 返す**だけ。判断・SQL・トランザクションを書かない。

```php
// app/Http/Controllers/Matching/LikeController.php
final class LikeController extends Controller
{
    public function store(StoreLikeRequest $request, LikeMemberUseCase $useCase): JsonResponse
    {
        $output = $useCase->execute($request->toInput());

        return (new LikeResultResource($output))->response()->setStatusCode(201);
    }
}
```

Request は**形だけ**を確かめ、Input に詰める。「相手がいるか」「回数を超えていないか」は業務の決まりなので Domain で確かめる。

```php
// app/Http/Requests/Matching/StoreLikeRequest.php
final class StoreLikeRequest extends FormRequest
{
    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['user_id' => ['required', 'uuid']];
    }

    public function toInput(): LikeMemberInput
    {
        return new LikeMemberInput(
            memberId: new MemberId((int) $this->attributes->get('member_id')),
            targetPublicId: $this->string('user_id')->toString(),
        );
    }
}
```

Resource は**返してよい項目だけ**を並べる。Model を丸ごと返さない。中で新しくリレーションを読まない（N+1）。

```php
// app/Http/Resources/Matching/LikeResultResource.php
final class LikeResultResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var LikeMemberOutput $output */
        $output = $this->resource;

        return ['matched' => $output->matched, 'talk_room_id' => $output->talkRoomPublicId];
    }
}
```

トークンを読むのは Middleware だけ。Controller ごとに JWT を読まない。

```php
// app/Http/Middleware/AuthenticateMember.php
public function handle(Request $request, Closure $next): Response
{
    $memberId = $this->tokens->memberIdFrom($request->bearerToken());   // 読めなければ null
    if ($memberId === null) {
        return response()->json(['message' => 'ログインしてください'], 401);
    }
    $request->attributes->set('member_id', $memberId);

    return $next($request);
}
```

### 4-2. Application

UseCase は**手順だけ**を書く。業務の判断の if を書かない（Domain に置く）。Laravel を使わない。

```php
// app/Application/Dtos/Matching/LikeMemberInput.php
final readonly class LikeMemberInput
{
    public function __construct(public MemberId $memberId, public string $targetPublicId) {}
}

// app/Application/Dtos/Matching/LikeMemberOutput.php
final readonly class LikeMemberOutput
{
    public function __construct(public bool $matched, public ?string $talkRoomPublicId) {}
}
```

```php
// app/Application/UseCases/Matching/LikeMemberUseCase.php
final class LikeMemberUseCase
{
    public function __construct(
        private MemberRepositoryInterface $members,
        private LikeRepositoryInterface $likes,
        private UserMatchRepositoryInterface $matches,
        private TalkRoomRepositoryInterface $talkRooms,
        private MatchingService $matching,
        private ChatSyncInterface $chatSync,
        private TransactionManagerInterface $transaction,
        private ClockInterface $clock,
    ) {}

    public function execute(LikeMemberInput $input): LikeMemberOutput
    {
        $me = $this->members->findById($input->memberId);
        $target = $this->members->findByPublicId($input->targetPublicId);   // いなければ MemberNotFoundException
        $now = $this->clock->now();

        LikeQuota::assertNotExceeded($me, $this->likes->countSentOn($me->id, $now));

        $room = $this->transaction->run(function () use ($me, $target, $now): ?TalkRoom {
            $this->likes->save(Like::create($me->id, $target->id, $now));
            if (! $this->matching->isMutual($me->id, $target->id)) {
                return null;
            }
            $match = UserMatch::create($me->id, $target->id, $now);
            $this->matches->save($match);
            $room = TalkRoom::openFor($match);
            $this->talkRooms->save($room);

            return $room;
        });

        if ($room !== null) {
            $this->chatSync->openRoom($room);   // 外への書き込みはコミットのあと（6章）
        }

        return new LikeMemberOutput(matched: $room !== null, talkRoomPublicId: $room?->publicId);
    }
}
```

### 4-3. Domain

ふつうの PHP だけで書く。値オブジェクトは作るときに確かめ、あとから変えない。

```php
// app/Domain/Members/Member/MemberId.php
final readonly class MemberId
{
    public function __construct(public int $value)
    {
        if ($value <= 0) {
            throw new InvalidArgumentException('会員の ID は 1 以上');
        }
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }
}

// app/Domain/Members/Member/Gender.php
enum Gender: string
{
    case Male = 'male';
    case Female = 'female';
}
```

エンティティは、新しく作る `create()` と、DB から作り直す `reconstruct()` を分ける。コンストラクタは `private`。

```php
// app/Domain/Matching/Like/Like.php
final class Like
{
    private function __construct(
        public readonly ?int $id,
        public readonly MemberId $from,
        public readonly MemberId $to,
        public readonly DateTimeImmutable $likedAt,
    ) {}

    public static function create(MemberId $from, MemberId $to, DateTimeImmutable $now): self
    {
        return new self(null, $from, $to, $now);   // 新しく作るときの決まりはここで確かめる
    }

    public static function reconstruct(int $id, MemberId $from, MemberId $to, DateTimeImmutable $likedAt): self
    {
        return new self($id, $from, $to, $likedAt);   // DB の値は正しい前提で、確かめを省く
    }
}
```

業務の決まりは1か所に。同じ判定を2か所に書かない。

```php
// app/Domain/Matching/Like/LikeQuota.php
final class LikeQuota
{
    public const FREE_MALE_DAILY_LIMIT = 10;

    public static function assertNotExceeded(Member $member, int $sentToday): void
    {
        if ($member->gender === Gender::Male && ! $member->isPaid && $sentToday >= self::FREE_MALE_DAILY_LIMIT) {
            throw new PaidPlanRequiredException();
        }
    }
}
```

Repository の interface は、業務の側が「何が要るか」を、業務の言葉で決める。SQL や Eloquent の言葉（`where`・`query`）を出さない。表ごとではなく、集約ごとに作る。

```php
// app/Domain/Matching/Like/LikeRepositoryInterface.php
interface LikeRepositoryInterface
{
    public function save(Like $like): void;

    public function exists(MemberId $from, MemberId $to): bool;

    public function countSentOn(MemberId $from, DateTimeImmutable $day): int;
}
```

1つのエンティティに置くと不自然な決まりは、ドメインサービスに置く。

```php
// app/Domain/Matching/Services/MatchingService.php
final class MatchingService
{
    public function __construct(private LikeRepositoryInterface $likes) {}

    public function isMutual(MemberId $me, MemberId $target): bool
    {
        return $this->likes->exists(from: $target, to: $me);
    }
}
```

外のサービスの約束も、使う Domain のフォルダに置く。

```php
// app/Domain/Messaging/TalkRoom/ChatSyncInterface.php
interface ChatSyncInterface
{
    public function openRoom(TalkRoom $room): void;
}
```

### 4-4. Infrastructure

Eloquent が出てくるのはここだけ。Eloquent の Model と Domain のエンティティの詰め替えも、ここで行う。**Model を Repository の外へ返さない。**

```php
// app/Infrastructure/Repositories/Members/EloquentMemberRepository.php
final class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function findByPublicId(string $publicId): Member
    {
        $row = User::query()->with('profile')->where('public_id', $publicId)->first()
            ?? throw new MemberNotFoundException();

        return new Member(
            id: new MemberId($row->id),
            publicId: $row->public_id,
            gender: Gender::from($row->profile->gender),
            isPaid: (bool) $row->is_paid,
        );
    }
}
```

読み取りの QueryService は、画面の形の DTO（または Model）を直接返す。JOIN・`with()`・項目の選び方・並び・ページをここで決める。**出してはいけない人（退会・ブロック）の条件も、ここに1か所で書く。**

```php
// app/Infrastructure/QueryServices/Members/SearchMembersQueryService.php
final class SearchMembersQueryService
{
    /** @return list<MemberSummary> */
    public function search(MemberId $me, SearchCriteria $criteria): array
    {
        return User::query()
            ->join('profiles', 'profiles.user_id', '=', 'users.id')
            ->whereNull('users.deleted_at')
            ->whereNotExists(fn ($q) => $q->from('blocks')
                ->whereColumn('blocks.blocked_id', 'users.id')
                ->where('blocks.blocker_id', $me->value))
            ->where('profiles.gender', $criteria->gender->value)
            ->orderByDesc('users.last_login_at')
            ->limit($criteria->limit)
            ->get(['users.public_id', 'profiles.nickname', 'profiles.birthday'])
            ->map(fn ($row) => new MemberSummary($row->public_id, $row->nickname, $row->birthday))
            ->all();
    }
}
```

トランザクションと日時の実装。

```php
// app/Infrastructure/Transaction/LaravelTransactionManager.php
final class LaravelTransactionManager implements TransactionManagerInterface
{
    public function run(callable $callback): mixed
    {
        return DB::transaction($callback);
    }
}

// app/Infrastructure/Clock/SystemClock.php
final class SystemClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }
}
```

### 4-5. Providers

interface と実装をつなぐのは `RepositoryServiceProvider` だけ。

```php
// app/Providers/RepositoryServiceProvider.php
final class RepositoryServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        LikeRepositoryInterface::class => EloquentLikeRepository::class,
        ChatSyncInterface::class => FirestoreChatSync::class,
        TransactionManagerInterface::class => LaravelTransactionManager::class,
        ClockInterface::class => SystemClock::class,
    ];
}
```

## 5. 書き込みの道と読み取りの道

| 道 | 流れ | 使うとき |
| --- | --- | --- |
| 書き込み | Controller → Request（`toInput()`）→ UseCase → Domain の決まり → Repository の interface → Output → Resource | 状態を変える。業務の決まりを守る |
| 読み取り | Controller → Request → QueryService → Resource | 一覧・詳細・検索・集計 |

- 会員の側：QueryService は必要なときだけ作る（検索・重い一覧）。簡単な読み取りは、UseCase から Repository の `find〜` を使ってよい
- 管理画面：読み取りはすべて QueryService（まとまりごとに1つ）。Controller から直接呼ぶ
- QueryService は書き込まない。書き込みは必ず UseCase を通す

## 6. トランザクション・日時・外への書き込み

- トランザクションは UseCase が `TransactionManagerInterface::run()` で張る。Controller・Repository・QueryService では張らない
- 読んでから書く処理で、同時に2回来ると壊れるもの（停止・購入・回数の上限）は、Repository に `〜ForUpdate()`（行のロック）を作って使う
- 日時は `ClockInterface::now()` から取る（`DateTimeImmutable`・UTC）。テストでは固定した時刻の偽物に差し替える
- 外への書き込み（Firestore・メール・将来の決済と AI）は、**`run()` の外、コミットのあと**で行う。トランザクションの中で外へ書かない（DB が巻き戻っても、外には残るため）

## 7. エラー

- 業務の決まりに反したら、Domain の例外（`〜Exception`）を投げる。Domain と Application は状態コードを知らない
- 例外を状態コードとメッセージに変えるのは、各アプリの `bootstrap/app.php` の1か所だけ

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(fn (PaidPlanRequiredException $e) => response()->json(['message' => '有料会員になると使えます'], 403));
    $exceptions->render(fn (MemberNotFoundException $e) => response()->json(['message' => '会員が見つかりません'], 404));
})
```

| 起きること | 止める場所 | 応答 |
| --- | --- | --- |
| トークンがない・壊れている | Middleware | 401 |
| 入力の形が違う | Request | 422（Laravel の形のまま） |
| 役割が足りない（管理画面） | Domain（`PermissionDeniedException`） | 403 |
| 業務の決まりに反する | Domain の例外 | 403・404・409 |
| DB・外のサービスが落ちた | どこでも握りつぶさない（`logging.md`） | 500 |

## 8. アーキテクチャのテスト

2章と3章は `tests/Arch/LayersTest.php` で守る。会員の側と管理画面で同じものを使う。

```php
// tests/Arch/LayersTest.php
arch('Domain はほかの層と Laravel を使わない')
    ->expect('App\Domain')
    ->not->toUse(['App\Http', 'App\Application', 'App\Infrastructure', 'Illuminate']);

arch('Application は Http・Infrastructure・Laravel を使わない')
    ->expect('App\Application')
    ->not->toUse(['App\Http', 'App\Infrastructure', 'Illuminate']);

arch('Http は Repository と Model を直接使わない')
    ->expect('App\Http')
    ->not->toUse(['App\Infrastructure\Repositories', 'App\Infrastructure\Models']);

arch('Infrastructure は UseCase と Http を使わない')
    ->expect('App\Infrastructure')
    ->not->toUse(['App\Application\UseCases', 'App\Http']);

arch('QueryService は書き込みの道を使わない')
    ->expect('App\Infrastructure\QueryServices')
    ->not->toUse(['App\Application']);

arch('Domain の interface は Interface で終わる')
    ->expect('App\Domain')
    ->interfaces()
    ->toHaveSuffix('Interface');
```

- まだ移していない古いファイル（`app/Http/Controllers/` の直下・`app/Models/`）は、テストの中で例外として並べる。この一覧が、そのまま移行の残り。移したら一覧から消す

## 9. 共通の原則（画面にも当てはめる）

### SSoT（1つの事実は1か所に）

- 定義（ステータス・定数・金額の計算・判定・入力の決まり）を書く前に、既存の定義を検索して使う。見つからないときだけ新しく書く
- 共通化するのは「同じ事実」だけ。見た目が似ているだけの処理は、各まとまりに置いたままにする
- API の形・型は、生成元を1つに決める。手で写した定義を2か所に置かない

### 過剰設計の禁止

- 要件にない汎用化・設定項目・抽象化を足さない。interface は、Repository と外のサービスと、トランザクション・日時にだけ作る。それ以外の1か所でしか使わないクラスに interface を作らない
- 起こりえない入力への防御を足さない。形の確かめは入口（Request）、業務の確かめは Domain
- 凝った書き方より、読んですぐ分かる書き方を選ぶ

### 1ファイル1責務

- ファイルの担当を一文で言えること。「いいねの回数の上限を判定する」は合格、「いいねまわりの処理いろいろ」は失格
- UseCase が 300行を超えたら、手順か決まりのどちらかが混ざっている。決まりを Domain へ出す

### 副作用の分離

- 業務の判断・計算は Domain の純粋な関数とエンティティに集める
- DB・外のサービス・時刻・乱数・環境変数は Infrastructure に寄せ、interface 越しに使う
- 狙いは、業務の決まりを DB なしで速くテストできる形に保つこと

## 10. まだ移していない古いコード

- 既存の API を触るチケットでは、**先にその API の振る舞いを固める API テストを足し、それから**この形へ移す
- 移すコミットと、振る舞いを変えるコミット（不具合の直し・性能）を分ける。移すコミットでは API テストが1本も変わらずに通る
- 新しく書くコードは、必ずこの形で書く。古いコントローラー（`app/Http/Controllers/` の直下）に機能を足さない
- 古いコードの中で見つけた問題は、移すときに直さず、改善のチケットにする（測った問題の一覧は各一歩の解説の 9-2）

## 11. やってはいけない書き方

```php
// ❌ Controller に業務の判断と SQL（レガシー版の形）
if ($profile->gender === 'male' && ! $user->is_paid) {
    $today = Like::where('from_user_id', $id)->whereDate('created_at', now()->toDateString())->count();
}
// ✅ 判断は Domain、数えるのは Repository、つなぐのは UseCase
LikeQuota::assertNotExceeded($me, $this->likes->countSentOn($me->id, $this->clock->now()));

// ❌ Application や Domain で Laravel を使う
$now = now();
DB::transaction(fn () => ...);
// ✅ interface 越し
$now = $this->clock->now();
$this->transaction->run(fn () => ...);

// ❌ Repository が業務の判断をする（「10回なら」は業務の決まり）
public function canLikeToday(int $memberId): bool { return $this->count($memberId) < 10; }
// ✅ Repository は数えるだけ
public function countSentOn(MemberId $from, DateTimeImmutable $day): int;

// ❌ Eloquent の Model を Repository の外へ返す（Resource でリレーションを読み、N+1 になる）
public function findByPublicId(string $publicId): User;
// ✅ Domain のエンティティに詰め替えて返す
public function findByPublicId(string $publicId): Member;

// ❌ トランザクションの中で外へ書く
$this->transaction->run(function () use ($room) { $this->talkRooms->save($room); $this->chatSync->openRoom($room); });
// ✅ コミットのあと
$this->transaction->run(fn () => $this->talkRooms->save($room));
$this->chatSync->openRoom($room);

// ❌ Domain が状態コードを知っている
abort(403, '有料会員になると使えます');
// ✅ Domain の例外を投げ、bootstrap/app.php で 403 に変える
throw new PaidPlanRequiredException();
```

## 管理画面での当てはめ

骨組みと依存の向きは同じ。違いは使い方だけ。

- 読み取り（API の9割）は、Controller から QueryService を直接呼ぶ
- 書き込みは UseCase を通し、必ず役割を確かめ（`Admin::assertCan()`）、同じトランザクションで監査ログを保存する
- 管理画面の Domain は「運営の権限と監査」（`Admins/`・`Members/MemberSuspension`・`Plans/PlanPrice`・`AuditLogs/`）
- 管理画面は会員の側のコードを読み込まない。書いてよい表と列は [docs/backend.md](../../docs/backend.md) の表に従う

```php
// backend/admin/app/Domain/Admins/AdminRole.php
enum AdminRole: string
{
    case Owner = 'owner';
    case Viewer = 'viewer';

    public function allows(Permission $permission): bool
    {
        return match ($this) {
            self::Owner => true,
            self::Viewer => false,
        };
    }
}

// backend/admin/app/Application/UseCases/Members/SuspendMemberUseCase.php
public function execute(SuspendMemberInput $input): void
{
    $admin = $this->admins->findById($input->adminId);
    $admin->assertCan(Permission::SuspendMember);   // 見るだけの人なら PermissionDeniedException → 403
    $now = $this->clock->now();

    $this->transaction->run(function () use ($input, $admin, $now): void {
        $suspended = $this->suspensions->findByPublicIdForUpdate($input->memberPublicId)->suspend($input->reason, $now);
        $this->suspensions->save($suspended);
        $this->auditLogs->save(new AuditLog($admin->id, AuditAction::SuspendMember, 'users', $suspended->memberId, ['reason' => $input->reason], $now));
    });
}
```
