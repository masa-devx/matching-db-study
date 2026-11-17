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

- 全体の地図（業務のまとまり（Auth・Members のような、業務ごとの分け方）の一覧・どのアプリがどの表を書くか・今のファイルの移行の地図・やり直しのきっかけ）は [docs/backend.md](../../docs/backend.md)
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
6. どの業務のまとまりにも属さない基盤（SQL のログ・リクエスト ID）→ `app/Support/`。使ってよいのは Http と Infrastructure だけ（2章）

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
| Http | 外との入出力 | Application・Domain の例外と型・Infrastructure の QueryService（と、その読み取りの DTO）・`App\Support` | Infrastructure の QueryService 以外（Repository・Model・External・Transaction・Clock） | 使ってよい |
| Application | 1つの操作の手順・トランザクションの区切り | Domain | Http・Infrastructure・`App\Support`・`App\Models` | **使わない** |
| Domain | 業務の決まり | なし（PHP の標準だけ） | ほかの全部の層・`App\Support`・`App\Models` | **使わない** |
| Infrastructure | 約束の実装・DB・外のサービス | Domain・Application の interface と Dto・`App\Support`（QueryService は Domain と Application を使わない。ID は int、性別などは string で受け取る） | Http・Application の UseCase | 使ってよい |

- 「Laravel を使わない」には、ファサード（`DB::`・`Log::`・`Cache::`）・ヘルパー（`now()`・`config()`・`env()`・`collect()`・`abort()`）・Carbon・Eloquent・`Illuminate\` のクラスをすべて含む
- ログ（`App\Support\Logging`）を出すのは Http と Infrastructure だけ。業務の出来事を残したいときは、Infrastructure の実装（Repository・外への書き込み）の中で出す
- この表は `tests/Arch/LayersTest.php` で機械で確かめる（8章）。破るときは、先にこのファイルを直す

## 3. ディレクトリと名前

各層の中は**業務のまとまり**のフォルダで分け、**名前を全部の層でそろえる**。Domain の中は、さらに集約でフォルダを分ける。まとまりの一覧は [docs/backend.md](../../docs/backend.md) の2章だけに書く（ここにはコピーしない）。

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
│   ├── <まとまり>/〜Interface.php  集約を持たないまとまり（Auth など）の、外のサービスの約束だけは直下に置いてよい
│   └── <まとまり>/Services/    ドメインサービス
├── Infrastructure/
│   ├── Models/
│   ├── Repositories/<まとまり>/Eloquent〜Repository.php
│   ├── QueryServices/<まとまり>/〜QueryService.php・読み取りの DTO（〜Summary・〜Detail・〜Criteria）
│   ├── External/<サービス>/
│   ├── Transaction/LaravelTransactionManager.php
│   └── Clock/SystemClock.php
├── Providers/BindingServiceProvider.php
└── Support/                    どのまとまりにも属さない基盤（Http と Infrastructure だけが使う）
```

- Eloquent の Model は `app/Infrastructure/Models/` に置く（DB を扱うので Infrastructure。2026-11-15 に決めた）。まだ移していない Model は `app/Models/` に残り、8章の例外の一覧に並べる

| もの | 名前 | 例 |
| --- | --- | --- |
| Controller | `<名詞>Controller`。メソッドは `index`・`show`・`store`・`update`・`destroy` | `LikeController::store` |
| Request | `<動詞><名詞>Request`。書き込みは `toInput()` で Input を、読み取りは `toCriteria()` で Criteria を返す | `StoreLikeRequest`・`SearchMembersRequest` |
| Resource | `<名詞>Resource` | `LikeResultResource` |
| UseCase | `<動詞><名詞>UseCase`。公開するメソッドは `execute()` だけ | `LikeMemberUseCase` |
| Dto | UseCase の名前から `UseCase` を除いて `Input`・`Output` | `LikeMemberInput` |
| interface | `〜Interface` | `LikeRepositoryInterface`・`ChatSyncInterface` |
| Repository の実装 | `Eloquent〜Repository` | `EloquentLikeRepository` |
| QueryService | `<名詞>QueryService`。メソッドは `search`・`list`・`find`・`summarize` など読む動詞 | `MemberSearchQueryService::search` |
| 読み取りの DTO | `<名詞>Summary`（一覧の1行）・`<名詞>Detail`（詳細）・`<名詞>Criteria`（条件） | `MemberSummary`・`MemberSearchCriteria` |
| 外のサービスの実装 | `<仕組み><役割>` | `FirestoreChatSync`・`JwtTokenService` |
| 業務の例外 | `〜Exception` | `PaidPlanRequiredException` |
| エンティティの作り方 | 新しく作る `create()`（確かめる）・DB から作り直す `reconstruct()`（確かめを省く） | `Like::create()` |

- 1ファイル1クラス。クラスはすべて `final`（継承させる理由があるときだけ外す）。値を運ぶだけのものは `final readonly`
- `declare(strict_types=1);` と型は `quality-types.md` に従う
- Model の名前は Laravel の標準のまま（表の単数形。`User`・`Like`）。Domain のエンティティと同じ名前になるときは、使う側で `use ... as UserModel` のように別名を付ける

## 4. 層ごとの書き方

例は「いいねする」（`POST /api/me/likes`）。各層の見本は、移したら [docs/backend.md](../../docs/backend.md) の「見本のファイル」に書く。

> **この見本は書き方（層・名前・依存の向き）の見本。** ロック・日付の区切り・有料かどうか・応答の項目など、振る舞いの正しさは要件（`docs/requirements/`）と `docs/api/` を正とし、見本を写さない。見本と要件が違えば、要件に合わせる。

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
    // $this->tokens は Domain/Auth/TokenServiceInterface（実装は Infrastructure/External/Jwt）。Http は External を直接使わない
    $memberId = $this->tokens->memberIdFrom($request->bearerToken());   // 読めなければ null
    if ($memberId === null) {
        return response()->json(['message' => 'ログインしてください'], 401);
    }
    $request->attributes->set('member_id', $memberId);

    return $next($request);
}
```

### 4-2. Application

UseCase は**手順だけ**を書く。業務の判断（「10回を超えたか」「お互いにいいねしたか」）は Domain が決めて返す。UseCase は、その**結果で手順を分ける if だけ**を書いてよい（例：マッチしたならルームを作る）。条件の中身（性別・回数・期限の比較）を UseCase に書かない。Laravel を使わない。

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
    public const FREE_MALE_DAILY_LIMIT = 10;   // 要件（FR-PAID-008）で決まった値。運営が画面から変える値ではないので、設定の表にしない

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

Eloquent が出てくるのはここだけ。Eloquent の Model と Domain のエンティティの詰め替えも、ここで行う。**Model を Repository の外へ返さない。** DB から作り直すときは、エンティティの `reconstruct()` を使う（`new` しない）。

- UNIQUE の違反など、DB が断ったことのうち業務の意味があるもの（「もういいねしている」）は、Repository が Domain の例外に変えて投げる。`QueryException` を上へ出さない
- Model の Factory は `database/factories/` のまま。Model の名前空間が `App\Infrastructure\Models` でも見つかるように、`AppServiceProvider` で `Factory::guessFactoryNamesUsing()` を1か所だけ設定する（Model ごとに `newFactory()` を書かない）

```php
// app/Infrastructure/Repositories/Members/EloquentMemberRepository.php
final class EloquentMemberRepository implements MemberRepositoryInterface
{
    public function findByPublicId(string $publicId): Member
    {
        $row = User::query()->with('profile')->where('public_id', $publicId)->first()
            ?? throw new MemberNotFoundException();

        return Member::reconstruct(
            id: new MemberId($row->id),
            publicId: $row->public_id,
            gender: Gender::from($row->profile->gender),
            isPaid: (bool) $row->is_paid,
        );
    }
}
```

読み取りの QueryService は、画面の形の DTO を返す（Model を返さない。Resource がリレーションを読みに行き、N+1 になるため）。DTO は同じフォルダに置き、Http から使ってよい。見つからないときは `null` を返し、Controller が 404 にする（7章）。JOIN・`with()`・項目の選び方・並び・ページをここで決める。**出してはいけない人（退会・ブロック）の条件も、ここに1か所で書く。**

```php
// app/Infrastructure/QueryServices/Members/MemberSearchCriteria.php
final readonly class MemberSearchCriteria
{
    public function __construct(public string $gender, public int $limit) {}   // Domain の Gender を使わず string
}

// app/Infrastructure/QueryServices/Members/MemberSearchQueryService.php
final class MemberSearchQueryService
{
    /** @return list<MemberSummary> */
    public function search(int $memberId, MemberSearchCriteria $criteria): array   // Domain の型を使わない（8章）
    {
        return User::query()
            ->join('profiles', 'profiles.user_id', '=', 'users.id')
            ->whereNull('users.deleted_at')
            ->whereNotExists(fn ($q) => $q->from('blocks')
                ->whereColumn('blocks.blocked_id', 'users.id')
                ->where('blocks.blocker_id', $memberId))
            ->where('profiles.gender', $criteria->gender)
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
        return CarbonImmutable::now('UTC');   // DateTimeImmutable を継ぐ。テストの travelTo() で止まる
    }
}
```

### 4-5. Providers

interface と実装（Repository・外のサービス・トランザクション・時計）をつなぐのは `BindingServiceProvider` だけ。ほかのことはここに書かない。

```php
// app/Providers/BindingServiceProvider.php
final class BindingServiceProvider extends ServiceProvider
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
| 読み取り | Controller → Request（`toCriteria()`）→ QueryService → 読み取りの DTO → Resource | 一覧・詳細・検索・集計 |

- 会員の側：QueryService は必要なときだけ作る（検索・重い一覧）。簡単な読み取りは、UseCase から Repository の `find〜` を使ってよい
- 管理画面：読み取りはすべて QueryService（まとまりごとに1つ）。Controller から直接呼ぶ
- QueryService は書き込まない。書き込みは必ず UseCase を通す（使ってよい部品はアーキテクチャのテストで確かめ、`save()`・`update()`・`delete()` を呼んでいないかはレビューで見る。8章）

## 6. トランザクション・日時・外への書き込み

- トランザクションは UseCase が `TransactionManagerInterface::run()` で張る。Controller・Repository・QueryService では張らない
- 読んでから書く処理で、同時に2回来ると壊れるもの（停止・購入・回数の上限）は、Repository に `〜ForUpdate()`（行のロック）を作って使う
- 日時は `ClockInterface::now()` から取る（`DateTimeImmutable`・UTC）。UseCase の単体テストでは固定した時刻の偽物に差し替え、API テストでは `$this->travelTo()` で止める（`SystemClock` は Carbon の時刻を返すので、止めた時刻が届く）
- 外への書き込み（Firestore・メール・将来の決済と AI）は、**`run()` の外、コミットのあと**で行う。トランザクションの中で外へ書かない（DB が巻き戻っても、外には残るため）

## 7. エラー

- 業務の決まりに反したら、Domain の例外（`〜Exception`）を投げる。Domain と Application は状態コードを知らない
- 例外を状態コードとメッセージに変えるのは、各アプリの `bootstrap/app.php` の1か所だけ
- 業務の例外を足したら、`render` と `dontReport` の両方に足す。API テストで、下の表の行ごとに状態コードとメッセージを確かめる

```php
// bootstrap/app.php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(fn (PaidPlanRequiredException $e) => response()->json(['message' => '有料会員になると使えます'], 403));
    $exceptions->render(fn (MemberNotFoundException $e) => response()->json(['message' => '会員が見つかりません'], 404));

    // 業務の例外は、決まりどおりに断っただけなので、エラーのログに出さない（logging.md の「ノイズを増やさない」）
    $exceptions->dontReport([PaidPlanRequiredException::class, MemberNotFoundException::class]);
})
```

| 起きること | 止める場所 | 応答 |
| --- | --- | --- |
| トークンがない・壊れている | Middleware | 401 |
| 入力の形が違う | Request | 422（Laravel の形のまま） |
| 役割が足りない（管理画面） | Domain（`PermissionDeniedException`） | 403 |
| 業務の決まりに反する | Domain の例外 | 403・404・409 |
| 読み取りで見つからない | Controller（QueryService が返した `null` を見て、Laravel の標準の `NotFoundHttpException` を投げる） | 404 |
| DB・外のサービスが落ちた | どこでも握りつぶさない（`logging.md`） | 500 |

## 8. アーキテクチャのテスト

2章（依存の向き）と、3章の名前の一部（末尾の名前・`final`）と、`strict_types` を、Pest の `arch()` で確かめる。

- 置き場：`tests/Arch/LayersTest.php`。`phpunit.xml` のテストの組に `Arch`（`tests/Arch`）を足す。CI でほかのテストと一緒に流れる
- 正本は会員の側（`backend/client/tests/Arch/`）。管理画面（`backend/admin`）にも Pest と `pestphp/pest-plugin-arch` を入れ、同じファイルをコピーする。違うのは例外の一覧だけ
- テストで確かめられないこと（QueryService が `->save()`・`->update()`・`->delete()` を呼ばない・UseCase の if が判断の中身を持たない）は、レビューで見る（`pr-review`）

```php
// tests/Arch/LayersTest.php
// まだ移していない古いファイル。この2つの一覧が、そのまま移行の残り。移したら消す
// ignoring に渡すのは古いコントローラーだけ。ignoring は、渡した名前で始まる「使われる側」の依存も消すので、
// App\Models を渡すと、新しいコードが App\Models を使っても落ちなくなる
const LEGACY_CONTROLLERS = [
    'App\Http\Controllers\LikeController',
    // …（app/Http/Controllers の直下の古いコントローラー）
];
const LEGACY_MODELS = 'App\Models';   // 移行の残り（app/Models）。ignoring には渡さない

$laravelHelpers = ['now', 'today', 'config', 'env', 'app', 'collect', 'abort', 'response', 'request', 'logger', 'info'];

arch('Domain はほかの層・Laravel・Carbon・基盤を使わない')
    ->expect('App\Domain')
    ->not->toUse(['App\Http', 'App\Application', 'App\Infrastructure', 'App\Models', 'App\Support', 'Illuminate', 'Carbon']);

arch('Application は Http・Infrastructure・Laravel・Carbon・基盤を使わない')
    ->expect('App\Application')
    ->not->toUse(['App\Http', 'App\Infrastructure', 'App\Models', 'App\Support', 'Illuminate', 'Carbon']);

arch('Domain と Application は Laravel のヘルパー関数を使わない')
    ->expect($laravelHelpers)
    ->not->toBeUsedIn(['App\Domain', 'App\Application']);

arch('Http が使ってよい Infrastructure は QueryService だけ')
    ->expect('App\Http')
    ->not->toUse(['App\Infrastructure\Models', 'App\Infrastructure\Repositories', 'App\Infrastructure\External', 'App\Infrastructure\Transaction', 'App\Infrastructure\Clock', LEGACY_MODELS])
    ->ignoring(LEGACY_CONTROLLERS);

arch('Infrastructure は UseCase と Http を使わない')
    ->expect('App\Infrastructure')
    ->not->toUse(['App\Application\UseCases', 'App\Http']);

arch('QueryService は Application・Repository・Domain を使わない')
    ->expect('App\Infrastructure\QueryServices')
    ->not->toUse(['App\Application', 'App\Infrastructure\Repositories', 'App\Domain']);   // ID は int で受け取る

arch('Domain の interface は Interface で終わる')
    ->expect('App\Domain')
    ->interfaces()
    ->toHaveSuffix('Interface');

// 1つの arch() に1つの期待。鎖の2つ目以降には classes() の絞り込みが効かないため
arch('UseCase は final')
    ->expect('App\Application\UseCases')
    ->classes()
    ->toBeFinal();

arch('UseCase は UseCase で終わる')
    ->expect('App\Application\UseCases')
    ->classes()
    ->toHaveSuffix('UseCase');

arch('QueryService のフォルダのクラス（QueryService と読み取りの DTO）は final')
    ->expect('App\Infrastructure\QueryServices')
    ->classes()
    ->toBeFinal();

arch('新しい層のファイルは strict_types')
    ->expect(['App\Http', 'App\Application', 'App\Domain', 'App\Infrastructure', 'App\Support'])
    ->toUseStrictTypes()
    ->ignoring(LEGACY_CONTROLLERS);
```

- 書いたら、わざと違反を作って落ちるのを見る（Domain に `use Illuminate\Support\Facades\DB;`・`now()`、新しい Controller に `use App\Models\User;`）。`toBeUsedIn`・`ignoring` の動きは、入れるチケットで確かめ、違えばこのファイルを直す
- 古いコントローラーは `LEGACY_CONTROLLERS` に並べる。Model を全部 `app/Infrastructure/Models` へ移したら `LEGACY_MODELS` を消す。基底の `App\Http\Controllers\Controller` は移す対象ではないので、一覧に入れない

## 9. 共通の原則（画面にも当てはめる）

### SSoT（1つの事実は1か所に）

- 定義（ステータス・定数・金額の計算・判定・入力の決まり）を書く前に、既存の定義を検索して使う。見つからないときだけ新しく書く
- 共通化するのは「同じ事実」だけ。見た目が似ているだけの処理は、各まとまりに置いたままにする
- API の形・型は、生成元を1つに決める。手でコピーした定義を2か所に置かない

### 過剰設計の禁止

- 要件にない汎用化・設定項目・抽象化を足さない。interface は、Repository と外のサービスと、トランザクション・日時にだけ作る。それ以外の1か所でしか使わないクラスに interface を作らない（乱数・ID の生成などが要るようになったら、この一覧に足してから作る）
- 起こりえない入力への防御を足さない。形の確かめは Request、業務の確かめは Domain
- 凝った書き方より、読んですぐ分かる書き方を選ぶ

### 1ファイル1責務

- ファイルの担当を一文で言えること。「いいねの回数の上限を判定する」は合格、「いいねまわりの処理いろいろ」は失格
- UseCase が 100行を超えたら、手順か決まりのどちらかが混ざっている。決まりを Domain へ出す

### 副作用の分離

- 業務の判断・計算は Domain の純粋な関数とエンティティに集める
- DB・外のサービス・時刻は Infrastructure に寄せ、interface 越しに使う。環境変数（`config()`）を読むのも Infrastructure と Http だけ
- 狙いは、業務の決まりを DB なしで速くテストできる形に保つこと

## 10. まだ移していない古いコード

- 既存の API を触るチケットでは、**先にその API の今の動きを確かめるテスト（API テスト）を足し、それから**この形へ移す。移す単位はコントローラーのファイルなので、そのファイルの全メソッドに API テストがあること
- 「API テストがある」とは、その API に、**少なくとも**成功が1本と、`docs/api/` に書いた失敗（401・404・422・403 など）ごとに1本があること。どの観点（他人の行が変わらない・境界の両側・出してはいけない人など）を書くかは、`testing.md` の API テストの観点に従う
- 移すコミットと、振る舞いを変えるコミット（不具合の直し・性能）を分ける
  - 同じ URL のまま中を移すとき：移すコミットでは、API テストが1本も変わらずに通る
  - 新しい URL に移すとき（今の URL は変えずに残す）：新しい URL のテストは、今の URL に対する、今の動きを確かめるテストをコピーして作る。違ってよい点は、移すチケットの表に並べたものだけ（手順は `testing.md` の「新しい URL に移したときのテスト」）
  - 安全の穴を直すとき：別のコミットにし、先にテストの期待値を要件どおりに変えて、落ちることを見せる（`testing.md` の「安全の穴を直すときのテスト」）
- そのために、API テストは中の作りに頼らない
  - DB は表の名前で確かめる（`assertDatabaseHas('likes', [...])`・`assertDatabaseCount('likes', 0)`）。テストに Model の名前空間（`App\Models\…`）を書かない
  - データは `tests/Support/` の作る関数（例：`createMember()`・`createLike()`）で作る。Model の Factory を呼ぶのは、この関数の中だけ
  - 時刻は `travelTo()`（`$this->travelTo()` と同じ）で止める。ログインは、本物のトークンを作って送る（`actingAsMember()`）。部品の一覧は `testing.md` の「テストの部品」
  - 外への書き込み（Firestore）は、移す前と後で同じ方法で確かめる（Emulator の中身を読む）
- Model を `app/Models` から `app/Infrastructure/Models` へ移すのは、それだけのコミットにする。そのコミットでは `tests/Support/` の `use` の書き換えだけを許す
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
- 書き込みは UseCase を通す。運営の操作（停止・解除・値段の変更）は、必ず役割を確かめ（`Admin::assertCan()`）、同じトランザクションで監査ログを保存する
- 例外：ログイン（`LoginAdminUseCase`。役割はまだ分からない）と、見たことの記録（`RecordAuditLogUseCase`。それ自体が監査ログ）は、役割を確かめない
- 管理画面の Domain は「運営の権限と監査」。まとまりと集約の一覧は [docs/backend.md](../../docs/backend.md) の 2-2
- 「見たこと」の監査ログ（会員の詳細を開いた・`member.view`）も書き込みなので、Controller が QueryService で読んだあとに `RecordAuditLogUseCase` を呼んで書く。QueryService の中で書かない
- 管理画面は会員の側のコードを読み込まない。書いてよい表と列は [docs/backend.md](../../docs/backend.md) の表に従う

```php
// backend/admin/app/Domain/Admins/Admin/AdminRole.php
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
        $this->auditLogs->save(AuditLog::create($admin->id, AuditAction::SuspendMember, 'users', $suspended->memberId, ['reason' => $input->reason], $now));
    });
}
```
