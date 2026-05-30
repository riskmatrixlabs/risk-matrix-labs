const RMLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="34" viewBox="0 0 48 46" fill="none">
    <path
      d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      fill="#BDFF00"
    />
    <path
      d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      fill="url(#rm-gloss)"
      opacity="0.25"
    />
    <defs>
      <linearGradient id="rm-gloss" x1="24" y1="0" x2="24" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="transparent" />
      </linearGradient>
    </defs>
  </svg>
)

function DashboardHeader() {
  return (
    <header style={{
      backgroundColor: '#0A0A0A',
      borderBottom: '1px solid rgba(189, 255, 0, 0.18)',
      padding: '0 40px',
      height: '68px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 24px rgba(189, 255, 0, 0.04)',
    }}>
      <RMLogo />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: '19px',
          letterSpacing: '0.22em',
          color: '#BDFF00',
          lineHeight: 1,
          textShadow: '0 0 18px rgba(189, 255, 0, 0.45)',
          userSelect: 'none',
        }}>
          RISK MATRIX LABS
        </span>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 500,
          fontSize: '9px',
          letterSpacing: '0.32em',
          color: 'rgba(189, 255, 0, 0.48)',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          OPERATE WITH DISCIPLINE
        </span>
      </div>
    </header>
  )
}

export default DashboardHeader
