/**
 * Maps API error strings to Russian at display time.
 * Response bodies stay in their original English codes so clients can keep comparing them.
 */

const API_ERRORS: Record<string, string> = {
    'unauthorized': 'Нужно войти в систему',
    'forbidden': 'Недостаточно прав',
    'invalid token': 'Сессия недействительна',
    'invalid student token': 'Сессия студента недействительна',
    'missing token': 'Сессия не найдена',
    'token required': 'Нужен код приглашения',
    'Not found': 'Не найдено',
    'not found': 'Не найдено',
    'failed': 'Не удалось выполнить запрос',
    'id required': 'Не указан идентификатор',
    'no entries': 'Нет записей',
    'status is read-only': 'Статус менять вручную нельзя',
    'currentPassword & newPassword required': 'Нужны текущий и новый пароль',
    'email & password required': 'Нужны почта и пароль',
    'account not found': 'Учётная запись не найдена',
    'multiple accounts found; specify instructorId': 'Найдено несколько учётных записей',
    'multiple accounts': 'Найдено несколько учётных записей',
    'credentials not set': 'Пароль ещё не задан',
    'invalid credentials': 'Неверная почта или пароль',
    'credentials not provisioned': 'Учётная запись ещё не настроена',
    'account already exists': 'Такая учётная запись уже есть',
    'token & password required': 'Нужны приглашение и пароль',
    'invite already used': 'Приглашение уже использовано',
    'invite expired': 'Срок приглашения истёк',
    'assignment required': 'Нужно указать задание',
    'student required': 'Нужно указать студента',
    'Only in-progress submissions can be deleted.': 'Удалить можно только незаконченную работу.',
    'assignmentId required': 'Нужно указать задание',
    'assignmentId & questionId required': 'Нужны задание и вопрос',
    'assignmentId & order[] required': 'Нужны задание и порядок вопросов',
    'assignmentId, questionId, submissionId, comment required': 'Нужны задание, вопрос, работа и комментарий',
    'Title required': 'Нужно название',
    'access revoked': 'Доступ к курсу отозван',
    'instructor not provisioned': 'Учётная запись преподавателя ещё не создана',
    'email mismatch': 'Почта не совпадает с приглашением',
    'name required': 'Нужно название',
    'Dataset name must be unique': 'Название набора данных должно быть уникальным',
    'students only': 'Это действие доступно только студентам',
    'missing fields': 'Заполнены не все поля',
    'job required': 'Не указано задание проверки',
    'Request resolved': 'Запрос уже решён',
    'SMTP not configured': 'Почта не настроена',
    'send failed': 'Не удалось отправить письмо',
    'No answer provided': 'Ответ не дан',
    'request failed': 'запрос не выполнен',
    'Exchange failed': 'Не удалось завершить вход',
    'Invalid session': 'Сессия недействительна',
    'SSO exchange failed': 'Не удалось завершить вход через SSO',
    'Login failed': 'Не удалось войти',
    'SSO login failed': 'Не удалось войти через SSO',
    'Invite not found': 'Приглашение не найдено',
    'Failed to load invite': 'Не удалось загрузить приглашение',
    'Invite acceptance failed': 'Не удалось принять приглашение',
    'Please sign in with Keycloak first.': 'Сначала войдите через Keycloak.',
    'Please sign in with Keycloak first': 'Сначала войдите через Keycloak',
    'Invite invalid or already used.': 'Приглашение недействительно или уже использовано.',
    'Failed to establish session. Please refresh.': 'Не удалось открыть сессию. Обновите страницу.',
    'Invalid session exchange result': 'Сессия получена в неверном виде',
    'Sign in failed': 'Не удалось войти',
    'Signup code required': 'Нужен код регистрации',
    'Provisioning failed': 'Не удалось создать учётную запись',
    'Provisioned, but failed to establish session. Please refresh.': 'Учётная запись создана, но сессию открыть не удалось. Обновите страницу.',
    'Provisioned, but invalid session exchange result': 'Учётная запись создана, но сессия получена в неверном виде',
    'Not authenticated': 'Нужно войти в систему',
    'You are not authenticated.': 'Нужно войти в систему.',
    'Failed to fetch': 'Нет соединения с сервером',
    'Unauthorized': 'Нужно войти в систему',
    'fetch failed': 'Не удалось получить данные',
};

function messageOf(error: unknown): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || '';
    if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
    }
    if (typeof error === 'object' && error && 'error' in error && typeof (error as { error?: unknown }).error === 'string') {
        return (error as { error: string }).error;
    }
    return '';
}

function lookup(raw: string): string | undefined {
    return API_ERRORS[raw] ?? API_ERRORS[raw.trim()];
}

/** True for short machine codes that should not be shown literally. */
function isMachineCode(raw: string): boolean {
    if (/[А-Яа-яЁё]/.test(raw)) return false;
    if (raw.length > 120) return false;
    if (raw.includes('\n')) return false;
    return /^[A-Za-z0-9][A-Za-z0-9 _.,&\[\]:'/-]*$/.test(raw) && raw.split(/\s+/).length <= 8;
}

export function uiError(error: unknown, fallback: string): string {
    const raw = messageOf(error).trim();
    if (!raw) return fallback;
    const mapped = lookup(raw);
    if (mapped) return mapped;

    let match = raw.match(/^Missing headers: (.+)$/);
    if (match) return `Не хватает столбцов: ${match[1]}`;

    match = raw.match(/^Failed to load \((\d+)\)$/);
    if (match) return `Не удалось загрузить (${match[1]})`;

    match = raw.match(/^Failed \((\d+)\)$/);
    if (match) return `Ошибка (${match[1]})`;

    match = raw.match(/^Autograder error (\d+)$/);
    if (match) return `Ошибка автопроверки (${match[1]})`;

    match = raw.match(/^Backend error \((\d+)\): ([\s\S]*)$/);
    if (match) {
        const detail = lookup(match[2].trim());
        const shown = detail || (isMachineCode(match[2].trim()) ? 'запрос не выполнен' : match[2].trim());
        return `Ошибка сервера (${match[1]}): ${shown}`;
    }

    match = raw.match(/^Invalid file type\. Expected (.+)$/);
    if (match) return `Неверный тип файла. Ожидается ${match[1]}`;

    if (isMachineCode(raw)) return fallback;
    return raw;
}

export const apiErrorCatalog = API_ERRORS;
