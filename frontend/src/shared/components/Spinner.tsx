import styles from '@/shared/components/Spinner.module.css'

/** Indicador de carga a pantalla completa. */
export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
