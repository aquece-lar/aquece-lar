import { DatePicker } from '@/components/DatePicker';
import type { Period } from '@/types/dashboard';
import styles from './PeriodFilter.module.css';

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className={styles.filter} role="group" aria-label="Período">
      <label className={styles.field}>
        De
        <DatePicker
          variant="inline"
          aria-label="Data inicial"
          value={value.from}
          max={value.to}
          onChange={(iso) => iso && onChange({ ...value, from: iso })}
        />
      </label>
      <span className={styles.sep} aria-hidden="true">
        |
      </span>
      <label className={styles.field}>
        Até
        <DatePicker
          variant="inline"
          aria-label="Data final"
          value={value.to}
          min={value.from}
          onChange={(iso) => iso && onChange({ ...value, to: iso })}
        />
      </label>
    </div>
  );
}
