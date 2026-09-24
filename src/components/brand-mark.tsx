type BrandMarkProps = { compact?: boolean; priority?: boolean };

export function BrandMark({ compact = false, priority = false }: BrandMarkProps) {
  return <div className={`brand-mark${compact ? " brand-mark-compact" : ""}`}>
    <img src="/brand/tse-catts-logo.png" alt="Emblema do Curso de Abordagem Técnica à Tentativa de Suicídio — CATTS 2026" fetchPriority={priority ? "high" : "auto"} />
    {!compact && <div><strong>Curso de Abordagem Técnica</strong><span>CATTS 2026 · CBMERJ</span></div>}
  </div>;
}
