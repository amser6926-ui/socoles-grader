'use client';
import React from 'react';
import { Box, Card, CardContent, CardHeader, Typography, Table, TableBody, TableCell, TableHead, TableRow, Button, Tooltip, Divider, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { RadarChart } from '@mui/x-charts/RadarChart';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GradeIcon from '@mui/icons-material/Grade';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/features/auth/AuthProvider';
import { m as ru, uiError, formatNumber, formatPercent } from '@/i18n';

interface ResultsChartsProps {
    results?: any[];
    loadAttemptsForCohort?: { assignmentId: string; token?: string };
    onAdvancedChange?: (open: boolean) => void;
}
export default function ResultsCharts({ results = [] as any[], loadAttemptsForCohort, onAdvancedChange }: ResultsChartsProps) {
    const theme = useTheme();
    const { user } = useAuth();
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const toggleAdvanced = (val: boolean) => { setShowAdvanced(val); try { onAdvancedChange?.(val); } catch { /* ignore */ } };
    const [attemptAugmented, setAttemptAugmented] = React.useState<any[] | null>(null);
    const [loadingAttempts, setLoadingAttempts] = React.useState(false);
    const [selectedQuestionId, setSelectedQuestionId] = React.useState<string>('all');

    // Auto-fetch attempts if loadAttemptsFor provided; this runs client-side with token via fetch API.
    React.useEffect(() => {
        async function load() {
            if (!loadAttemptsForCohort) { setAttemptAugmented(null); return; }
            const { assignmentId, token } = loadAttemptsForCohort;
            if (!assignmentId) return;
            setLoadingAttempts(true);
            try {
                // 1. Get current question submissions for this assignment (all students)
                const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) baseHeaders['Authorization'] = `Bearer ${token}`;
                const qsUrl = `/api/question-submissions?assignmentId=${encodeURIComponent(assignmentId)}&allStudents=1`;
                const qsRes = await fetch(qsUrl, { headers: baseHeaders });
                if (!qsRes.ok) throw new Error('failed question submissions');
                const qs = await qsRes.json();
                const enriched: any[] = [];
                // 2. For each question submission, fetch history attempts (sequential to limit load)
                for (const q of qs) {
                    if (!q.id) continue;
                    try {
                        const histRes = await fetch(`/api/question-submissions?historyOf=${encodeURIComponent(q.id)}`, { headers: baseHeaders });
                        if (!histRes.ok) continue;
                        const attempts = await histRes.json();
                        const normAttempts = attempts.map((a: any) => ({
                            attempt: a.attempt,
                            grade: typeof a.grade === 'number' ? (a.grade <= 1 ? a.grade : a.grade) : 0,
                            ts: a.createdAt,
                            rubric: a.rubric || null,
                            feedback: Array.isArray(a.feedback) ? a.feedback : []
                        }));
                        enriched.push({ ...q, attempts: normAttempts });
                    } catch { /* ignore single failure */ }
                }
                setAttemptAugmented(enriched);
            } catch { setAttemptAugmented(null); } finally { setLoadingAttempts(false); }
        }
        void load();
    }, [loadAttemptsForCohort?.assignmentId, loadAttemptsForCohort?.token]);
    // Reset question filter when dataset changes
    React.useEffect(() => { setSelectedQuestionId('all'); }, [attemptAugmented?.length]);
    // Optionally exclude non-final submissions (e.g., In Progress, Draft, Pending) from top-level aggregates
    const resultsFiltered = Array.isArray(results) ? results.filter((r: any) => {
        const sRaw = (r.Status ?? r.status ?? '').toString().trim().toLowerCase();
        if (!sRaw) return true; // keep if status unknown (e.g., CSV import)
        if (sRaw.includes('in progress')) return false;
        if (sRaw === 'draft' || sRaw === 'pending') return false;
        return true; // keep final-like statuses (Auto-graded, Manual, Needs review, etc.)
    }) : [];

    // Normalize grades 0..1 and compute aggregates
    const dist = Array.from({ length: 11 }, (_, i) => ({ bin: formatNumber(i / 10, 1), n: 0 })); // bins labeled 0.0..1.0
    const normalizedGrades: number[] = [];
    const answers: string[] = [];

    for (const r of resultsFiltered) {
        const q = String((r as any)['Q #'] ?? (r as any).q ?? (r as any).question ?? '?');
        const rawScore = Number((r as any).Score ?? (r as any).score ?? (r as any).Grade ?? (r as any).grade ?? 0);
        const outOf = Number((r as any)['Out Of'] ?? (r as any).outOf ?? (r as any)['OutOf'] ?? 1) || 1;
        const ans = String((r as any).Answer ?? (r as any).Query ?? (r as any).query ?? '').trim();

        // Normalize to 0..1
        let normalized = outOf > 1 ? rawScore / outOf : rawScore;
        if (!isFinite(normalized) || isNaN(normalized)) normalized = 0;
        normalized = Math.max(0, Math.min(1, normalized));
        normalizedGrades.push(normalized);
        if (ans) answers.push(ans);

        // Distribution
        let bin = Math.round(normalized * 10);
        bin = Math.max(0, Math.min(10, bin));
        dist[bin].n += 1;
    }

    // Summary stats
    const totalAnswers = resultsFiltered.length;
    const uniqueAnswers = new Set(answers).size;
    const avgGrade = normalizedGrades.length ? +(normalizedGrades.reduce((a, b) => a + b, 0) / normalizedGrades.length).toFixed(2) : 0;
    const maxGrade = normalizedGrades.length ? +Math.max(...normalizedGrades).toFixed(2) : 0;
    const minGrade = normalizedGrades.length ? +Math.min(...normalizedGrades).toFixed(2) : 0;

    // Pass/Fail pie (threshold 0.6)
    const pass = normalizedGrades.filter((g) => g >= 0.6).length;
    const fail = normalizedGrades.filter((g) => g < 0.6).length;
    const passFailData = [
        { id: 0, value: pass, label: ru.charts.pass },
        { id: 1, value: fail, label: ru.charts.fail },
    ];

    // Colors for bars (11 bins)
    const COLORS = [
        theme.palette.primary.light,
        theme.palette.secondary.light,
        theme.palette.success.light,
        theme.palette.warning.light,
        theme.palette.info.light,
        theme.palette.error.light,
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.info.main,
    ];

    // Single series with per-category colors to keep bars thick
    const distDataset = dist.map((d) => ({ bin: d.bin, n: d.n }));

    // Common incorrect answers (grade < 1.0)
    const incorrectCounts: Record<string, number> = {};
    resultsFiltered.forEach((r) => {
        const rawScore = Number((r as any).Score ?? (r as any).score ?? (r as any).Grade ?? 0);
        const outOf = Number((r as any)['Out Of'] ?? (r as any).outOf ?? 1) || 1;
        let normalized = outOf > 1 ? rawScore / outOf : rawScore;
        if (!isFinite(normalized) || isNaN(normalized)) normalized = 0;
        const ans = String((r as any).Answer ?? (r as any).Query ?? '').trim();
        if (normalized < 1 && ans) incorrectCounts[ans] = (incorrectCounts[ans] || 0) + 1;
    });
    const commonIncorrect = Object.entries(incorrectCounts)
        .map(([answer, count]) => ({ answer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // -------- Advanced Charts Data Preparation --------
    // Expect each result to have attempts: [{attempt, grade, ts, rubric:{syntax,semantics,results}, feedback:[] }]
    type Attempt = { attempt: number; grade: number; ts?: string; rubric?: { syntax?: number; semantics?: number; results?: number }; feedback?: string[] };
    interface ResultWithAttempts { attempts?: Attempt[] }
    const allAttempts: Attempt[] = [];
    // Build question options when attempt data is available
    const questionOptions = React.useMemo(() => {
        if (!Array.isArray(attemptAugmented)) return [] as Array<{ id: string; label: string }>;
        const byQ = new Map<string, string>();
        attemptAugmented.forEach((q: any, idx: number) => {
            const qid = String(q.questionId ?? q.question_id ?? '');
            if (!qid) return;
            const label = String(q.title ?? q.question ?? q.name ?? q['Q #'] ?? ru.charts.qLabel(idx + 1));
            if (!byQ.has(qid)) byQ.set(qid, label);
        });
        return Array.from(byQ.entries()).map(([id, label]) => ({ id, label }));
    }, [attemptAugmented]);
    // Apply filter: when a specific question is selected, narrow down datasets
    const baseResults = React.useMemo(() => {
        if (!attemptAugmented) return resultsFiltered;
        if (!selectedQuestionId || selectedQuestionId === 'all') return attemptAugmented;
        return attemptAugmented.filter((q: any) => String(q.questionId ?? q.question_id) === String(selectedQuestionId));
    }, [attemptAugmented, resultsFiltered, selectedQuestionId]);
    (baseResults as (ResultWithAttempts & any)[]).forEach(r => {
        if (Array.isArray(r.attempts) && r.attempts.length) {
            // If backend didn't provide attempt numbers (or they are all identical), synthesize per question
            const haveValid = r.attempts.some((a: any) => typeof a.attempt === 'number' && a.attempt > 0);
            r.attempts.forEach((a: any, idx: number) => {
                const attNum = haveValid ? a.attempt : (idx + 1); // fallback sequence
                allAttempts.push({
                    attempt: attNum,
                    grade: typeof a.grade === 'number' ? Math.max(0, Math.min(1, a.grade <= 1 ? a.grade : a.grade)) : 0,
                    ts: a.createdAt || a.ts,
                    rubric: a.rubric || undefined,
                    feedback: a.feedback || []
                });
            });
        } else if (!attemptAugmented) {
            const rawScore = Number(r.Score ?? r.score ?? r.Grade ?? r.grade ?? 0);
            const outOf = Number(r['Out Of'] ?? r.outOf ?? 1) || 1;
            const grade = outOf > 1 ? (rawScore / outOf) : rawScore;
            allAttempts.push({ attempt: 1, grade: Math.max(0, Math.min(1, grade)) });
        }
    });
    // Sort attempts by attempt number
    allAttempts.sort((a, b) => a.attempt - b.attempt);
    // Aggregate averages per attempt index
    const byAttempt: Record<number, { count: number; gradeSum: number; syntaxSum: number; semanticsSum: number; resultsSum: number; syntaxN: number; semanticsN: number; resultsN: number }> = {};
    allAttempts.forEach(a => {
        const key = a.attempt;
        if (!byAttempt[key]) byAttempt[key] = { count: 0, gradeSum: 0, syntaxSum: 0, semanticsSum: 0, resultsSum: 0, syntaxN: 0, semanticsN: 0, resultsN: 0 };
        const bucket = byAttempt[key];
        bucket.count += 1;
        if (typeof a.grade === 'number' && isFinite(a.grade)) bucket.gradeSum += a.grade;
        if (a.rubric) {
            if (typeof a.rubric.syntax === 'number') { bucket.syntaxSum += a.rubric.syntax; bucket.syntaxN++; }
            if (typeof a.rubric.semantics === 'number') { bucket.semanticsSum += a.rubric.semantics; bucket.semanticsN++; }
            if (typeof a.rubric.results === 'number') { bucket.resultsSum += a.rubric.results; bucket.resultsN++; }
        }
    });
    const progressDataset = Object.keys(byAttempt).map(k => {
        const att = Number(k);
        const b = byAttempt[att];
        return {
            attempt: att,
            grade: b.gradeSum / (b.count || 1),
            syntax: b.syntaxN ? b.syntaxSum / b.syntaxN : null,
            semantics: b.semanticsN ? b.semanticsSum / b.semanticsN : null,
            results: b.resultsN ? b.resultsSum / b.resultsN : null,
        };
    }).sort((a, b) => a.attempt - b.attempt);
    // Deltas per attempt (grade + rubric components if present)
    const deltaDataset = progressDataset.slice(1).map((row, i) => {
        const prev = progressDataset[i];
        return {
            attempt: row.attempt,
            gradeDelta: row.grade - prev.grade,
            syntaxDelta: (row.syntax ?? prev.syntax ?? 0) - (prev.syntax ?? row.syntax ?? 0),
            semanticsDelta: (row.semantics ?? prev.semantics ?? 0) - (prev.semantics ?? row.semantics ?? 0),
            resultsDelta: (row.results ?? prev.results ?? 0) - (prev.results ?? row.results ?? 0),
        };
    });
    // Time gap vs improvement (requires timestamps). If absent, dataset empty.
    const attemptsWithTime = allAttempts.filter(a => a.ts && typeof a.grade === 'number').sort((a, b) => new Date(a.ts || '').getTime() - new Date(b.ts || '').getTime());
    const timeGapDataset: Array<{ gapMinutes: number; improvement: number }> = [];
    for (let i = 1; i < attemptsWithTime.length; i++) {
        const prev = attemptsWithTime[i - 1];
        const cur = attemptsWithTime[i];
        const gap = (new Date(cur.ts!).getTime() - new Date(prev.ts!).getTime()) / (1000 * 60);
        timeGapDataset.push({ gapMinutes: gap, improvement: (cur.grade - prev.grade) });
    }
    // Radar first vs best
    const first = progressDataset[0];
    const best = progressDataset.reduce((acc, r) => r.grade > (acc?.grade ?? -1) ? r : acc, first || null);
    const radarData = (first && best) ? [
        { axis: ru.charts.syntax, first: first.syntax ?? 0, best: best.syntax ?? first.syntax ?? 0 },
        { axis: ru.charts.semantics, first: first.semantics ?? 0, best: best.semantics ?? first.semantics ?? 0 },
        { axis: ru.charts.results, first: first.results ?? 0, best: best.results ?? first.results ?? 0 },
    ] : [];
    // Cumulative mastery (step) – max grade reached after each attempt.
    const cumulDataset = progressDataset.map((r, i) => ({ attempt: r.attempt, bestSoFar: Math.max(...progressDataset.slice(0, i + 1).map(x => x.grade)) }));

    const attemptsSummary = React.useMemo(() => {
        if (!Array.isArray(baseResults)) return null;
        const perQuestion = baseResults.map((q: any) => ({ id: q.id, attempts: Array.isArray((q as any).attempts) ? (q as any).attempts.length : 0 }));
        const totalHist = perQuestion.reduce((a, b) => a + b.attempts, 0);
        const attemptKeys = progressDataset.map(p => p.attempt);
        return { perQuestion, totalHist, attemptKeys };
    }, [baseResults, progressDataset]);

    // Attempts vs Students distribution: total attempt records per student (sum across their questions)
    const attemptsVsStudents = React.useMemo(() => {
        // For attempt index i, count how many entities have reached at least i attempts.
        // If a specific question is selected: entities = students (unique by student).
        // If All questions: entities = student-question pairs.
        if (!Array.isArray(baseResults) || !baseResults.length) return null;
        const perEntityTotals: Record<string, number> = {};
        baseResults.forEach((q: any) => {
            const studentKey = String(q.student ?? q.studentId ?? 'unknown');
            const qid = String(q.questionId ?? q.question_id ?? '');
            const key = (selectedQuestionId && selectedQuestionId !== 'all') ? studentKey : `${studentKey}|${qid}`;
            const attCount = Array.isArray(q.attempts) ? q.attempts.length : 0;
            perEntityTotals[key] = (perEntityTotals[key] || 0) + attCount;
        });
        const totals = Object.values(perEntityTotals).filter(t => t > 0);
        if (!totals.length) return { dataset: [], keys: [] as number[] };
        const maxAttempts = Math.max(...totals);
        const dataset: { attemptIndex: number; students: number }[] = [];
        for (let i = 1; i <= maxAttempts; i++) {
            const count = totals.filter(t => t >= i).length; // entities who have "used up" attempt i
            dataset.push({ attemptIndex: i, students: count });
        }
        return { dataset, keys: dataset.map(d => d.attemptIndex) };
    }, [baseResults, selectedQuestionId]);

    if (showAdvanced) {
        return (
            <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant='h6' sx={{ whiteSpace: 'normal' }}>{ru.charts.title}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {Array.isArray(attemptAugmented) && attemptAugmented.length > 1 && (
                            <FormControl size='small' sx={{ minWidth: 220 }}>
                                <InputLabel id='attempt-q-filter-label'>{ru.charts.question}</InputLabel>
                                <Select
                                    labelId='attempt-q-filter-label'
                                    label={ru.charts.question}
                                    value={selectedQuestionId}
                                    onChange={(e) => setSelectedQuestionId(e.target.value)}
                                >
                                    <MenuItem value='all'><em>{ru.charts.allQuestions}</em></MenuItem>
                                    {questionOptions.map(q => (
                                        <MenuItem key={q.id} value={q.id} sx={{ whiteSpace: 'normal' }}>{q.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        <Button size='small' onClick={() => toggleAdvanced(false)} sx={{ whiteSpace: 'normal' }}>{ru.charts.back}</Button>
                    </Box>
                </Box>
                {!loadingAttempts && Array.isArray(baseResults) && (
                    <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>
                        {ru.charts.summary(attemptsSummary?.perQuestion?.length || 0, new Set((baseResults as any[]).map(a => a.student)).size, attemptsSummary?.totalHist || 0)}
                    </Typography>
                )}
                {/* Per-student toggle removed per requirement; cohort only */}
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.progress}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.progressHelp}</Typography>} />
                        <CardContent>
                            {progressDataset.length ? (
                                <LineChart height={260} margin={{ top: 8, right: 12, bottom: 36, left: 56 }} dataset={progressDataset} xAxis={[{ dataKey: 'attempt', label: ru.charts.attempt }]} yAxis={[{ label: ru.charts.avgGrade }]} series={[
                                    { dataKey: 'grade', label: ru.charts.grade, color: theme.palette.primary.main },
                                    ...(progressDataset.some(r => r.syntax != null) ? [{ dataKey: 'syntax', label: ru.charts.syntax, color: theme.palette.success.main }] : []),
                                    ...(progressDataset.some(r => r.semantics != null) ? [{ dataKey: 'semantics', label: ru.charts.semantics, color: theme.palette.warning.main }] : []),
                                    ...(progressDataset.some(r => r.results != null) ? [{ dataKey: 'results', label: ru.charts.results, color: theme.palette.info.main }] : []),
                                ]} />
                            ) : <Typography variant='caption' color='text.secondary'>{ru.charts.noAttempts}</Typography>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.deltas}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.deltasHelp}</Typography>} />
                        <CardContent>
                            {deltaDataset.length ? (
                                <BarChart height={260} margin={{ top: 8, right: 12, bottom: 36, left: 56 }} dataset={deltaDataset} xAxis={[{ dataKey: 'attempt', label: ru.charts.attempt }]} yAxis={[{ label: ru.charts.deltaAxis }]} series={[
                                    { dataKey: 'gradeDelta', label: ru.charts.gradeDelta, color: theme.palette.primary.main },
                                    ...(deltaDataset.some(d => d.syntaxDelta !== 0) ? [{ dataKey: 'syntaxDelta', label: ru.charts.syntaxDelta, color: theme.palette.success.main }] : []),
                                    ...(deltaDataset.some(d => d.semanticsDelta !== 0) ? [{ dataKey: 'semanticsDelta', label: ru.charts.semanticsDelta, color: theme.palette.warning.main }] : []),
                                    ...(deltaDataset.some(d => d.resultsDelta !== 0) ? [{ dataKey: 'resultsDelta', label: ru.charts.resultsDelta, color: theme.palette.info.main }] : []),
                                ]} />
                            ) : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.needTwo}</Typography>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.timeGap}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.timeGapHelp}</Typography>} />
                        <CardContent>
                            {timeGapDataset.length ? (
                                <ScatterChart height={260} margin={{ top: 8, right: 12, bottom: 36, left: 56 }} series={[{ data: timeGapDataset.map(p => ({ x: p.gapMinutes, y: p.improvement })) }]} xAxis={[{ label: ru.charts.gap }]} yAxis={[{ label: ru.charts.gradeDelta }]} />
                            ) : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.noTimestamps}</Typography>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.usedPerStudent}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.usedHelp}</Typography>} />
                        <CardContent>
                            {attemptsVsStudents && attemptsVsStudents.dataset.length ? (
                                <BarChart
                                    height={260}
                                    margin={{ top: 8, right: 12, bottom: 36, left: 56 }}
                                    dataset={attemptsVsStudents.dataset}
                                    xAxis={[{
                                        dataKey: 'attemptIndex', label: ru.charts.attemptNum, colorMap: {
                                            type: 'ordinal', colors: [
                                                theme.palette.primary.light,
                                                theme.palette.secondary.light,
                                                theme.palette.success.light,
                                                theme.palette.warning.light,
                                                theme.palette.info.light,
                                                theme.palette.error.light,
                                                theme.palette.primary.main,
                                                theme.palette.secondary.main,
                                                theme.palette.success.main,
                                                theme.palette.warning.main,
                                                theme.palette.info.main,
                                            ], values: attemptsVsStudents.dataset.map(d => d.attemptIndex)
                                        }
                                    }]}
                                    yAxis={[{ label: ru.charts.students }]}
                                    series={[{ dataKey: 'students', label: ru.charts.students }]}
                                    hideLegend
                                />
                            ) : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.needAttempts}</Typography>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.mastery}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.masteryHelp}</Typography>} />
                        <CardContent>
                            {cumulDataset.length ? (
                                <LineChart height={260} margin={{ top: 8, right: 12, bottom: 36, left: 56 }} dataset={cumulDataset} xAxis={[{ dataKey: 'attempt', label: ru.charts.attempt }]} yAxis={[{ label: ru.charts.bestSoFar }]} series={[{ dataKey: 'bestSoFar', label: ru.charts.bestSoFar, color: theme.palette.primary.main }]} />
                            ) : <Typography variant='caption' color='text.secondary'>{ru.charts.noAttemptsShort}</Typography>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader title={<Typography variant='subtitle1' sx={{ whiteSpace: 'normal' }}>{ru.charts.difficulty}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.difficultyHelp}</Typography>} />
                        <CardContent>
                            {Array.isArray(baseResults) && baseResults.length ? (() => {
                                const qMetrics = baseResults.map((q: any) => {
                                    const attempts = Array.isArray(q.attempts) ? q.attempts : [];
                                    const first = attempts[0];
                                    const best = attempts.reduce((acc: any, a: any) => (a.grade ?? 0) > (acc?.grade ?? -1) ? a : acc, first || null);
                                    return { attemptsCount: attempts.length, best: best?.grade ?? 0 };
                                });
                                const scatter = qMetrics.map(m => ({ x: m.attemptsCount, y: m.best }));
                                return <ScatterChart height={260} margin={{ top: 8, right: 12, bottom: 36, left: 56 }} series={[{ data: scatter.map(p => ({ x: p.x, y: p.y })) }]} xAxis={[{ label: ru.common.attempts }]} yAxis={[{ label: ru.charts.bestGrade }]} />;
                            })() : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.needAttempts}</Typography>}
                        </CardContent>
                    </Card>
                </Box>
                <InstructorSurveyAnalytics assignmentId={loadAttemptsForCohort?.assignmentId} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            {/* Summary stats */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Card>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <PeopleIcon color="primary" />
                        <Box>
                            <Typography variant="h5">{formatNumber(totalAnswers)}</Typography>
                            <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.totalAnswers}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <AssignmentIcon color="secondary" />
                        <Box>
                            <Typography variant="h5">{formatNumber(uniqueAnswers)}</Typography>
                            <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.uniqueAnswers}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <GradeIcon color="success" />
                        <Box>
                            <Typography variant="h5">{formatNumber(avgGrade, 2)}</Typography>
                            <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.avgGrade01}</Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* High/Low */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Card>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ArrowUpwardIcon color="info" />
                        <Box>
                            <Typography variant="h5">{formatNumber(maxGrade, 2)}</Typography>
                            <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.highest}</Typography>
                        </Box>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ArrowDownwardIcon color="error" />
                        <Box>
                            <Typography variant="h5">{formatNumber(minGrade, 2)}</Typography>
                            <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.lowest}</Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Visualizations */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Card>
                    <CardHeader title={<Typography variant="subtitle1" sx={{ whiteSpace: 'normal' }}>{ru.charts.distribution}</Typography>} subheader={<Typography variant='caption' color='text.secondary'>N = {formatNumber(totalAnswers)}</Typography>} />
                    <CardContent>
                        <BarChart
                            margin={{ top: 4, right: 8, bottom: 26, left: 34 }}
                            height={260}
                            dataset={distDataset}
                            xAxis={[{
                                dataKey: 'bin',
                                label: ru.charts.grade01,
                                categoryGapRatio: 0.15,
                                barGapRatio: 0.0,
                                colorMap: { type: 'ordinal', colors: COLORS, values: distDataset.map((d) => d.bin) },
                            }]}
                            series={[{ dataKey: 'n' }]}
                            hideLegend
                            borderRadius={2}
                            grid={{ horizontal: true }}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader title={<Typography variant="subtitle1" sx={{ whiteSpace: 'normal' }}>{ru.charts.passFail}</Typography>} subheader={<Typography variant='caption' color='text.secondary'>N = {formatNumber(normalizedGrades.length)}</Typography>} />
                    <CardContent>
                        <PieChart series={[{ data: passFailData }]} height={260} />
                    </CardContent>
                </Card>
            </Box>

            {user?.role === 'instructor' && (
                <Box>
                    <Tooltip title={ru.charts.moreCharts}>
                        <span>
                            <Button variant='outlined' onClick={() => toggleAdvanced(true)} sx={{ whiteSpace: 'normal' }}>{ru.charts.more}</Button>
                        </span>
                    </Tooltip>
                </Box>
            )}

            {/* Common Incorrect Answers */}
            <Card>
                <CardHeader title={<Typography variant="subtitle1" sx={{ whiteSpace: 'normal' }}>{ru.charts.commonWrong}</Typography>} />
                <CardContent>
                    {commonIncorrect.length ? (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.count}</TableCell>
                                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.answer}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {commonIncorrect.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{formatNumber(item.count)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.answer}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Typography color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.charts.noCommon}</Typography>
                    )}
                </CardContent>
            </Card>


        </Box>
    );
}

// Lightweight component to load & present instructor feedback survey analytics inside advanced section
interface InstructorSurveyAnalyticsProps { assignmentId?: string }
function InstructorSurveyAnalytics({ assignmentId }: InstructorSurveyAnalyticsProps) {
    const [data, setData] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [showRaw, setShowRaw] = React.useState(false);
    // Lazy import to avoid circular if AuthProvider changes
    const auth = (typeof window !== 'undefined') ? (window as any).__AUTH : null;
    const token: string | undefined = auth?.user?.token;
    const [showAll, setShowAll] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true); setError(null);
            try {
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const url = showAll ? '/api/feedback?aggregate=1' : (assignmentId ? `/api/feedback?aggregate=1&assignmentId=${encodeURIComponent(assignmentId)}` : '/api/feedback?aggregate=1');
                const res = await fetch(url, { headers });
                if (res.status === 401) { setError(uiError('Unauthorized', ru.errors.generic)); return; }
                if (!res.ok) throw new Error('fetch failed');
                const json = await res.json();
                if (!cancelled) setData(json);
            } catch (e: any) {
                if (!cancelled) setError(uiError(e, ru.errors.generic));
            } finally { if (!cancelled) setLoading(false); }
        }
        load();
        return () => { cancelled = true; };
    }, [token, assignmentId, showAll]);
    if (loading) return <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.loadingSurvey}</Typography>;
    if (error) return <Typography variant='caption' color='error' sx={{ whiteSpace: 'normal' }}>{ru.charts.surveyUnavailable(error)}</Typography>;
    if (!data || !data.total_responses) return <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.noSurvey}</Typography>;
    // Prepare distributions for charts
    const helpedRaw = (data.helped_fix_distribution || []).map((d: any) => ({ rating: d.helped_fix as number, n: d.n as number }));
    const understandingRaw = (data.improved_understanding_distribution || []).map((d: any) => ({ rating: d.improved_understanding as number, n: d.n as number }));
    // High-contrast distinct colors (blue, orange, green, purple, red) chosen for differentiation & color-blind friendliness
    const surveyColors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#9467bd', '#d62728'];
    // Convert into single-row dataset with columns value1..value5 so each bar becomes its own series (allowing distinct colors)
    function toSeriesDataset(rows: { rating: number; n: number }[]) {
        const base: any = { bucket: ru.charts.ratings };
        rows.forEach(r => { base['v' + r.rating] = r.n; });
        return [base];
    }
    const helpedDataset = toSeriesDataset(helpedRaw);
    const understandingDataset = toSeriesDataset(understandingRaw);
    const helpedSeries = helpedRaw.map((r: { rating: number; n: number }) => ({ dataKey: 'v' + r.rating, label: String(r.rating), color: surveyColors[(r.rating - 1) % surveyColors.length] }));
    const understandingSeries = understandingRaw.map((r: { rating: number; n: number }) => ({ dataKey: 'v' + r.rating, label: String(r.rating), color: surveyColors[(r.rating - 1) % surveyColors.length] }));
    // Raw responses extraction: expect backend to optionally include `responses` array if aggregate=1
    const rawResponses: any[] = Array.isArray(data.responses) ? data.responses : [];
    const fmt2 = (v: any) => {
        const n = Number(v);
        return isFinite(n) ? formatNumber(n, 2) : '–';
    };
    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant='h6' sx={{ whiteSpace: 'normal' }}>{ru.charts.survey}</Typography>
                <FormControlLabel
                    control={<Switch size='small' checked={showAll} onChange={(_, v) => setShowAll(v)} />}
                    label={<Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{showAll ? ru.charts.allAssignments : ru.charts.currentAssignment}</Typography>}
                />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' } }}>
                <Card><CardContent><Typography variant='h6'>{formatNumber(Number(data.total_responses))}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.responses}</Typography></CardContent></Card>
                <Card><CardContent><Typography variant='h6'>{data.avg_helped_fix != null ? fmt2(data.avg_helped_fix) : '–'}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.avgHelped}</Typography></CardContent></Card>
                <Card><CardContent><Typography variant='h6'>{data.avg_improved_understanding != null ? fmt2(data.avg_improved_understanding) : '–'}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.avgUnderstanding}</Typography></CardContent></Card>
                <Card><CardContent><Typography variant='h6'>{data.avg_improvement != null ? fmt2(data.avg_improvement) : '–'}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.avgImprovement}</Typography></CardContent></Card>
                <Card><CardContent><Typography variant='h6'>{data.percent_improved != null ? formatPercent(Number(data.percent_improved) / 100, 1) : '–'}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.pctImproved}</Typography></CardContent></Card>
                <Card><CardContent><Typography variant='h6'>{data.median_improvement != null ? fmt2(data.median_improvement) : '–'}</Typography><Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', display: 'block' }}>{ru.charts.medianDelta}</Typography></CardContent></Card>
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Card>
                    <CardHeader title={<Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.charts.helpedDist}</Typography>} />
                    <CardContent>
                        {helpedDataset[0] && helpedSeries.length ? <BarChart height={200} dataset={helpedDataset} xAxis={[{ dataKey: 'bucket', scaleType: 'band', label: ru.charts.helpedAxis, categoryGapRatio: 0.4 }]} series={helpedSeries} /> : <Typography variant='caption' color='text.secondary'>{ru.charts.noData}</Typography>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader title={<Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.charts.understandingDist}</Typography>} />
                    <CardContent>
                        {understandingDataset[0] && understandingSeries.length ? <BarChart height={200} dataset={understandingDataset} xAxis={[{ dataKey: 'bucket', scaleType: 'band', label: ru.charts.understandingAxis, categoryGapRatio: 0.4 }]} series={understandingSeries} /> : <Typography variant='caption' color='text.secondary'>{ru.charts.noData}</Typography>}
                    </CardContent>
                </Card>
            </Box>
            <Card>
                <CardHeader title={<Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.charts.correlations}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.correlationsHelp}</Typography>} />
                <CardContent>
                    <Table size='small'>
                        <TableHead><TableRow><TableCell sx={{ whiteSpace: 'normal' }}>{ru.charts.metric}</TableCell><TableCell>r</TableCell></TableRow></TableHead>
                        <TableBody>
                            <TableRow><TableCell sx={{ whiteSpace: 'normal' }}>{ru.charts.corrHelped}</TableCell><TableCell>{data.correlation?.improvement_helped_fix != null && isFinite(Number(data.correlation.improvement_helped_fix)) ? formatNumber(Number(data.correlation.improvement_helped_fix), 2) : ru.common.na}</TableCell></TableRow>
                            <TableRow><TableCell sx={{ whiteSpace: 'normal' }}>{ru.charts.corrUnderstanding}</TableCell><TableCell>{data.correlation?.improvement_understanding != null && isFinite(Number(data.correlation.improvement_understanding)) ? formatNumber(Number(data.correlation.improvement_understanding), 2) : ru.common.na}</TableCell></TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader title={<Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.charts.raw}</Typography>} subheader={<Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.charts.rawHelp}</Typography>} action={<Button size='small' onClick={() => setShowRaw(r => !r)} sx={{ whiteSpace: 'normal' }}>{showRaw ? ru.charts.hide : ru.charts.show}</Button>} />
                <CardContent>
                    {showRaw ? (
                        rawResponses.length ? (
                            <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Table size='small' stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.helped}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.understanding}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.improvement}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{ru.charts.comment}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rawResponses.map((r, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell>{r.helped_fix ?? '–'}</TableCell>
                                                <TableCell>{r.improved_understanding ?? '–'}</TableCell>
                                                <TableCell>{isFinite(Number(r.improvement)) ? formatNumber(Number(r.improvement), 2) : '–'}</TableCell>
                                                <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 260 }}>{(r.comment ?? r.comments ?? '').trim() || <Typography component='span' variant='caption' color='text.secondary'>—</Typography>}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        ) : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.noRaw}</Typography>
                    ) : <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.charts.hidden}</Typography>}
                </CardContent>
            </Card>
        </Box>
    );
}
