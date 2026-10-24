import SearchField from '@/components/ui/SearchField';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import type { StatisticsFilters } from './use-statistics-filters';
import styles from './teacher-statistics.module.css';

export default function StatisticsTableToolbar({ filters, search, onSearch, label, count }: {
  filters: StatisticsFilters; search: string; onSearch: (value: string) => void; label: string; count: string;
}) {
  return <div className={styles.toolbar}>
    <SearchField label={label} placeholder={label} value={search} onValueChange={onSearch} maxLength={200} />
    <div className={styles.toolbarRight}><span className={styles.rowCount}>{count}</span>
      <WorkSelect aria-label="Формат значений" value={filters.unit} onChange={(event) => filters.update({ unit: event.target.value === 'count' ? 'count' : 'percent' })}>
        <option value="percent">Доля, %</option><option value="count">Количество</option>
      </WorkSelect>
    </div>
  </div>;
}
