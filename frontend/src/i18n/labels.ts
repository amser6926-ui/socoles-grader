/**
 * Display labels for values that must stay unchanged in storage, URLs, and the grader protocol.
 * Unknown values (user-entered text, SQL, unseen codes) are returned as-is.
 */

const STATUS_LABELS: Record<string, string> = {
    'Submitted': 'Отправлено',
    'Auto-graded': 'Проверено автоматически',
    'Needs review': 'Нужна проверка',
    'In Progress': 'В процессе',
    'Pending': 'Ожидает',
    'Resolved': 'Решён',
    'Invited': 'Приглашён',
    'Active': 'Активен',
    'Dropped': 'Исключён',
    'Removed': 'Удалён',
    'Draft': 'Черновик',
    'Published': 'Опубликовано',
    'Manual': 'Вручную',
    'Graded': 'Оценено',
};

const DIFFICULTY_LABELS: Record<string, string> = {
    beginner: 'Начальный',
    intermediate: 'Средний',
    advanced: 'Продвинутый',
};

/** Grading-option values are parsed by numeric prefix. Labels only. */
const PROTOCOL_LABELS: Record<string, string> = {
    '0 Absent': '0 — не учитывается',
    '2 Levels': '2 уровня',
    '3 Levels': '3 уровня',
    '8 Levels': '8 уровней',
    '1 - Syntax, Semantics, Results': '1 — синтаксис, семантика, результат',
    '2 - Semantics, Syntax, Results': '2 — семантика, синтаксис, результат',
    '3 - Results, Semantics, Syntax': '3 — результат, семантика, синтаксис',
    '4 - Syntax, Results, Semantics': '4 — синтаксис, результат, семантика',
    '5 - Semantics, Results, Syntax': '5 — семантика, результат, синтаксис',
    '6 - Results, Syntax, Semantics': '6 — результат, синтаксис, семантика',
};

/** CSV column names are a file protocol. This map is for on-screen headers only. */
const CSV_HEADER_LABELS: Record<string, string> = {
    'Org Defined ID': 'ID в системе',
    'Student': 'Студент',
    'Last Name': 'Фамилия',
    'First Name': 'Имя',
    'Student ID': 'ID студента',
    'Q #': '№ вопроса',
    'Attempt #': '№ попытки',
    'Answer': 'Ответ',
    'Score': 'Балл',
    'Out Of': 'Из',
    'Percent': 'Процент',
    'Percentage': 'Процент',
    'Feedback': 'Обратная связь',
    'feedback': 'Обратная связь',
};

const CLAUSE_LABELS: Record<string, string> = {
    'SELECT clause': 'конструкция SELECT',
    'FROM clause': 'конструкция FROM',
    'WHERE clause': 'конструкция WHERE',
    'GROUP BY clause': 'конструкция GROUP BY',
    'HAVING clause': 'конструкция HAVING',
    'ORDER BY clause': 'конструкция ORDER BY',
    'LIMIT/OFFSET clause': 'конструкция LIMIT/OFFSET',
    'LIMIT clause': 'конструкция LIMIT',
};

const FEEDBACK_EXACT: Record<string, string> = {
    'Autograder unavailable or timed out.': 'Автопроверка недоступна или превышено время ожидания.',
    'Autograder request failed.': 'Не удалось запросить автопроверку.',
    'RESULTS: Correct! Well done.': 'РЕЗУЛЬТАТ: верно. Отличная работа.',
    'RESULTS: Not correct! Though, the correct results are contained within the query results,  they were not correctly filtered.': 'РЕЗУЛЬТАТ: неверно. Нужные строки есть в ответе, но они отфильтрованы неправильно.',
    'RESULTS: The output of the query is not correct.': 'РЕЗУЛЬТАТ: вывод запроса неверен.',
    'SYNTAX: Correct! Well done.': 'СИНТАКСИС: верно. Отличная работа.',
    'SYNTAX: The query is not parseable.': 'СИНТАКСИС: запрос не разбирается.',
    'SEMANTICS: Correct! Well done.': 'СЕМАНТИКА: верно. Отличная работа.',
    'SEMANTICS: Since the query is not parseable, we could not verify the semantics.': 'СЕМАНТИКА: запрос не разбирается, поэтому семантику проверить нельзя.',
    'SEMANTICS: The query does not have correct semantics.': 'СЕМАНТИКА: смысл запроса неверен.',
    'The query failed to process in syntax analysis.': 'Запрос не прошёл синтаксический разбор.',
    'DBMS crashed.': 'СУБД аварийно завершила работу.',
    'One or both statements are empty.': 'Один или оба оператора пусты.',
    'Statement type not handled.': 'Этот тип оператора не обрабатывается.',
    'No LIMIT/OFFSET clause present': 'Конструкция LIMIT/OFFSET отсутствует',
    'Excellent! Your query matches the reference query.': 'Отлично! Запрос совпадает с эталоном.',
    'Excellent! Your CREATE statement matches the reference.': 'Отлично! Оператор CREATE совпадает с эталоном.',
    'Excellent! Your CREATE VIEW statement matches the reference.': 'Отлично! Оператор CREATE VIEW совпадает с эталоном.',
    'Excellent! Your UPDATE statement matches the reference.': 'Отлично! Оператор UPDATE совпадает с эталоном.',
    'Excellent! Your DELETE statement matches the reference.': 'Отлично! Оператор DELETE совпадает с эталоном.',
    'Excellent! Your ASSERTION statement matches the reference.': 'Отлично! Оператор ASSERTION совпадает с эталоном.',
    'Excellent! Your INSERT statement matches the reference.': 'Отлично! Оператор INSERT совпадает с эталоном.',
    'Excellent! Your ALTER statement matches the reference.': 'Отлично! Оператор ALTER совпадает с эталоном.',
    '2️⃣ Correct Components:': '2️⃣ Верные компоненты:',
    '3️⃣ Issues found in the following components:': '3️⃣ Замечания по компонентам:',
    '❗ Problem Details:': '❗ Подробности:',
    '4️⃣ Next steps:': '4️⃣ Что сделать дальше:',
    '● None.': '● Нет.',
    'Basic SQL structure is mostly correct.': 'Базовая структура SQL в основном верна.',
    'Syntax issues detected in clauses or order.': 'В конструкциях или их порядке есть синтаксические ошибки.',
    'Joins and relationships inferred correctly.': 'Соединения и связи определены верно.',
    'Potential logical issues in joins or aggregations.': 'Возможны логические ошибки в соединениях или агрегатах.',
    'Output tuples align with expected test results.': 'Строки результата совпадают с ожидаемыми.',
    'Returned rows/values differ from expected outcomes.': 'Возвращённые строки или значения отличаются от ожидаемых.',
    'Review the SELECT clause to ensure you are selecting the correct columns, functions, or expressions as specified in the goal.': 'Проверьте SELECT: столбцы, функции и выражения должны соответствовать условию.',
    'Check the FROM clause to ensure you are using the correct tables and joins as required.': 'Проверьте FROM: таблицы и соединения должны соответствовать условию.',
    'Review the GROUP BY clause to ensure you are grouping by the correct columns or expressions.': 'Проверьте GROUP BY: группировка должна идти по нужным столбцам или выражениям.',
    'Check the HAVING clause to make sure the conditions applied to the grouped data are correct.': 'Проверьте HAVING: условия для сгруппированных данных должны быть верными.',
    'Adjust the ORDER BY clause to sort the results as specified.': 'Поправьте ORDER BY, чтобы сортировка совпала с условием.',
    'No answer provided': 'Ответ не дан',
};

function normalizeFeedback(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

function translateClausePiece(piece: string) {
    const trimmed = piece.trim();
    return CLAUSE_LABELS[trimmed] || trimmed;
}

export function statusLabel(status?: string | null): string {
    if (!status) return '';
    return STATUS_LABELS[status] ?? status;
}

export function difficultyLabel(value?: string | null): string {
    if (!value) return '';
    return DIFFICULTY_LABELS[value.toLowerCase()] ?? value;
}

export function roleLabel(role?: string | null, evaluator?: boolean): string {
    if (role === 'student' && evaluator) return 'студент · ассистент';
    if (role === 'student') return 'студент';
    if (role === 'instructor') return 'преподаватель';
    return role || '';
}

export function protocolLabel(value?: string | null): string {
    if (!value) return '';
    return PROTOCOL_LABELS[value] ?? value;
}

export function csvHeaderLabel(header: string): string {
    return CSV_HEADER_LABELS[header] ?? header;
}

/** Translate known grader/UI feedback lines. Leaves SQL and unknown instructor text unchanged. */
export function displayFeedback(text: string): string {
    if (!text) return text;
    const trimmed = text.trim();
    if (FEEDBACK_EXACT[trimmed]) return FEEDBACK_EXACT[trimmed];
    const collapsed = normalizeFeedback(trimmed);
    const exactCollapsed = Object.keys(FEEDBACK_EXACT).find((key) => normalizeFeedback(key) === collapsed);
    if (exactCollapsed) return FEEDBACK_EXACT[exactCollapsed];

    let match = trimmed.match(/^SYNTAX MINOR ERROR: To make the query parseable, it was changed to, '([\s\S]+)'\.?$/);
    if (match) return `НЕБОЛЬШАЯ ОШИБКА СИНТАКСИСА: чтобы запрос разбирался, он был изменён на «${match[1]}».`;

    match = trimmed.match(/^SEMANTICS MINOR ERROR: To make the query have correct semantics, it was changed to, '([\s\S]+)'\.?$/);
    if (match) return `НЕБОЛЬШАЯ ОШИБКА СЕМАНТИКИ: чтобы смысл стал верным, запрос был изменён на «${match[1]}».`;

    match = trimmed.match(/^Query error: ([\s\S]+)$/);
    if (match) return `Ошибка запроса: ${match[1]}`;

    match = trimmed.match(/^Unsupported statement type: (\S+)$/);
    if (match) return `Неподдерживаемый тип оператора: ${match[1]}`;

    match = trimmed.match(/^The correct statement is a (\S+) but your statement is a (\S+)\.?$/);
    if (match) return `Эталонный оператор имеет тип ${match[1]}, а ваш — ${match[2]}.`;

    match = trimmed.match(/^Excellent! Your ([A-Z][A-Z ]+?) statement matches the reference\.?$/);
    if (match) return `Отлично! Оператор ${match[1].trim()} совпадает с эталоном.`;

    match = trimmed.match(/^✅\s*(.+)$/);
    if (match) return `✅ ${translateClausePiece(match[1])}`;

    match = trimmed.match(/^❌\s*(.+)$/);
    if (match) return `❌ ${translateClausePiece(match[1])}`;

    match = trimmed.match(/^No ([A-Z][A-Z /]+ clause) present$/);
    if (match) return `${translateClausePiece(match[1])} отсутствует`;

    match = trimmed.match(/^Autograder request failed: ([\s\S]+)$/);
    if (match) return `Не удалось запросить автопроверку: ${displayFeedback(match[1])}`;

    return text;
}

export function displayFeedbackList(lines: string[]): string[] {
    return lines.map((line) => displayFeedback(line));
}
