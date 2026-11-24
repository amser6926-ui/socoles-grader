export { UI_LANG, UI_LOCALE } from './locale';
export { m } from './messages';
export { uiError, apiErrorCatalog } from './apiErrors';
export {
    statusLabel,
    difficultyLabel,
    roleLabel,
    protocolLabel,
    csvHeaderLabel,
    displayFeedback,
    displayFeedbackList,
} from './labels';
export { formatDateTimeDDMMYYYYHHmm, formatDue, formatNumber, formatPercent } from '@/lib/format';

/** Russian cardinal plural: 1 студент, 2 студента, 5 студентов. */
export function ruCount(n: number, one: string, few: string, many: string): string {
    return `${n} ${ruWord(n, one, few, many)}`;
}

export function ruWord(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(Math.trunc(n)) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
}
