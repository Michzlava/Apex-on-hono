export function Logo({ width, height }: { width?: number; height?: number }) {
  const fontSize = height ? `${height * 0.55}px` : '20px';
  
  return (
    <span
      style={{
        fontFamily: "var(--disp, 'Barlow Condensed', sans-serif)",
        fontWeight: 800,
        fontSize,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--t1)",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      APEX<span style={{ color: "var(--elec)", margin: "0 0.15em" }}>•</span>MARKETS
    </span>
  );
}
