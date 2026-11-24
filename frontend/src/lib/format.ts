/** Keep in sync with UI_LOCALE in src/i18n/locale.ts. Relative import is avoided so Node's test runner can load this file. */
const UI_LOCALE = 'ru-RU';

const dateTime = new Intl.DateTimeFormat(UI_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat(UI_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

/** Display-only timestamp. Does not change values stored by the API. */
export function formatDateTimeDDMMYYYYHHmm(input?: string) {
    if (!input) return '';
    const d = new Date(input);
    if (isNaN(d.getTime())) return input;
    return dateTime.format(d);
}

/** Display-only date. Keeps DD-MM-YYYY assignment due values intact in storage. */
export function formatDue(input?: string) {
    if (!input) return '';
    const trimmed = input.trim();
    const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        if (!isNaN(d.getTime())) return dateOnly.format(d);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && /[T\-]/.test(trimmed)) return dateOnly.format(d);
    return input;
}

export function formatNumber(value: number, digits?: number) {
    const options: Intl.NumberFormatOptions = {};
    if (typeof digits === 'number') {
        options.minimumFractionDigits = digits;
        options.maximumFractionDigits = digits;
    }
    return new Intl.NumberFormat(UI_LOCALE, options).format(value);
}

export function formatPercent(ratio: number, digits = 0) {
    return new Intl.NumberFormat(UI_LOCALE, {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(ratio);
}
