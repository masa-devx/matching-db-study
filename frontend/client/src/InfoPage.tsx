import { Link, useParams } from 'react-router'
import { readToken } from './shared/session/session'

// レガシー版（M1。#181）。案内の画面（/info/<名前>）。設定から来る。
// 文は、学習用の見本。本当のサービスでは、法務や運営が書いた文を置く。文を、この部品の中に直接書いた
const PAGES: Record<string, { title: string; sections: { heading: string; body: string[] }[] }> = {
  help: {
    title: 'ヘルプ',
    sections: [
      {
        heading: '相手を探す',
        body: [
          '下の「検索」から、条件に合う相手を探せます。「絞り込み」を押すと、年齢・身長・住んでいる所などを選べます。',
          'よく使う条件は、名前を付けて5件まで保存できます。',
        ],
      },
      {
        heading: 'いいねとマッチ',
        body: [
          '気になる相手のプロフィールで「いいね」を押します。相手からもいいねが届くと、マッチになります。',
          'マッチした相手とは、「メッセージ」でやり取りできます。',
        ],
      },
      {
        heading: '有料会員',
        body: [
          '男性の会員は、有料会員になると、メッセージを送る・いいねを何回でも・検索のこだわり条件、が使えます。',
          '女性の会員は、すべての機能を無料で使えます。',
        ],
      },
      {
        heading: 'メールアドレスの確認',
        body: [
          '登録のときに届いたメールのリンクを開くと、確認が終わります。確認すると、ほかの会員の検索に出るようになります。',
          'メールが見つからないときは、設定の「アカウント」から、もう一度送れます。',
        ],
      },
    ],
  },
  safety: {
    title: '安全に使うために',
    sections: [
      {
        heading: '個人の情報を、すぐに教えない',
        body: ['住所・勤め先・電話番号・ほかのサービスの連絡先は、相手をよく知るまで教えないでください。'],
      },
      {
        heading: 'お金の話が出たら、やり取りをやめる',
        body: [
          '投資・副業・送金・ほかのサイトへの登録をすすめられたら、やり取りをやめて、相手をブロックしてください。',
        ],
      },
      {
        heading: '初めて会うときは、人の多い場所で',
        body: ['昼間の、人の多い場所を選んでください。行き先と相手のことを、家族や友人に伝えておくと安心です。'],
      },
      {
        heading: '困った相手は、ブロックできます',
        body: [
          '相手のプロフィールかトーク画面から、ブロックできます。ブロックすると、お互いに、検索・いいね・メッセージに出なくなります。',
          'ブロックしたことは、相手には伝わりません。あとから、設定の「ブロックした相手」で解除できます。',
        ],
      },
    ],
  },
  terms: {
    title: '利用規約',
    sections: [
      {
        heading: 'この文について',
        body: ['これは、学習用のアプリの見本の文です。本当のサービスの規約ではありません。'],
      },
      {
        heading: '使える人',
        body: ['18歳以上で、独身の人が使えます。登録のときに入れた性別と生年月日は、あとから変えられません。'],
      },
      {
        heading: 'してはいけないこと',
        body: [
          'ほかの人になりすますこと・うその情報を載せること・勧誘や営業に使うこと・ほかの会員をおどしたり傷つけたりすること。',
          'これらが分かったときは、運営が利用を止めることがあります。',
        ],
      },
      {
        heading: '有料会員',
        body: ['有料会員の期間は、買ったときに決まります。期間の途中でやめても、お金は戻りません。'],
      },
    ],
  },
  privacy: {
    title: 'プライバシーポリシー',
    sections: [
      {
        heading: 'この文について',
        body: ['これは、学習用のアプリの見本の文です。本当のサービスの方針ではありません。'],
      },
      {
        heading: '集める情報',
        body: [
          'メールアドレス・パスワード（元に戻せない形にして保存します）・プロフィール・いいね・メッセージ・購入の記録。',
        ],
      },
      {
        heading: '使いみち',
        body: [
          'ほかの会員に見せるのは、プロフィールだけです。メールアドレスは見せません。',
          '運営は、困りごとの対応と、決まりを守らない利用を見つけるために、メッセージを見ることがあります。',
        ],
      },
      {
        heading: '退会したとき',
        body: ['退会すると、ほかの会員からは見えなくなります。'],
      },
    ],
  },
}

export default function InfoPage() {
  const { slug } = useParams()
  const page = PAGES[slug ?? '']

  return (
    <div>
      <div className="search-head">
        <h1 className="page-title">{page ? page.title : 'ページが見つかりません'}</h1>
        {/* M2（#193）：登録の画面からも開く（利用規約・プライバシーポリシー）。ログインしていなければ、登録に戻る */}
        <Link className="button button-small button-ghost" to={readToken() ? '/settings' : '/register'} viewTransition>
          戻る
        </Link>
      </div>
      {page?.sections.map((section) => (
        <section key={section.heading} className="card info-card">
          <h2 className="section-title">{section.heading}</h2>
          {section.body.map((text) => (
            <p key={text} className="info-text">
              {text}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}
