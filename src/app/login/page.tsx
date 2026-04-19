import { login } from '@/app/actions/auth'
import { COLOR, FONT, smallCaps } from '@/lib/design'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLOR.paper,
        color: COLOR.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p
            style={{
              fontSize: 10,
              color: COLOR.accent,
              marginBottom: 14,
              ...smallCaps,
            }}
          >
            Myatt&apos;s Fields Cocktails
          </p>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: 44,
              fontWeight: 400,
              letterSpacing: '-0.025em',
              lineHeight: 1,
              color: COLOR.ink,
            }}
          >
            The Back Bar
          </h1>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: 'italic',
              fontSize: 14,
              color: COLOR.muted,
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Internal — not for circulation.
          </p>
        </div>
        <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              outline: 'none',
              background: 'transparent',
              border: `1px solid ${COLOR.rule}`,
              color: COLOR.ink,
              fontFamily: FONT.sans,
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 12,
              background: COLOR.ink,
              color: COLOR.paper,
              border: 'none',
              cursor: 'pointer',
              ...smallCaps,
            }}
          >
            Enter
          </button>
          <WrongPassword searchParams={searchParams} />
        </form>
      </div>
    </div>
  )
}

async function WrongPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null
  return (
    <p
      style={{
        textAlign: 'center',
        fontSize: 13,
        fontFamily: FONT.serif,
        fontStyle: 'italic',
        color: COLOR.flag,
      }}
    >
      Incorrect password
    </p>
  )
}
