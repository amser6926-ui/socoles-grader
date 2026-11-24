'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    Typography,
    TextField,
    MenuItem,
    Tabs,
    Tab,
    Button,
    Chip,
    Divider,
    Snackbar,
    Alert,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    Menu,
    Switch,
    FormControlLabel,
} from '@mui/material';
import HeaderActions from '@/components/HeaderActions';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneIcon from '@mui/icons-material/Done';
// moved per-question actions menu trigger into QuestionCard component
import AddIcon from '@mui/icons-material/Add';
import type { Question, NewQuestionPayload } from '@/lib/types';
import type { Assignment } from '@/lib/types';
import { DEFAULT_GRADING_OPTIONS } from '@/lib/api';
import type { GradingOptions as GradingOptionsType } from '@/lib/types';
import GradingOptions from '@/features/instructor/GradingOptions';
import { useTheme } from '@mui/material/styles';
import PageCard from '@/components/PageCard';
import QuestionCard from '@/components/QuestionCard';
import DifficultyChip from '@/components/DifficultyChip';
import RichTextEditor from '@/components/RichTextEditor';
import PromptWithHint from '@/components/PromptWithHint';
import SchemaPreview from '@/components/SchemaPreview';
import SqlEditor from '@/components/SqlEditor';
import RubricBars from '@/components/RubricBars';
import FeedbackList from '@/components/FeedbackList';
import GradeDisplay from '@/components/GradeDisplay';
import { difficultyLabel, formatDue, m as ru, protocolLabel, uiError } from '@/i18n';

/** Bank table moved above component to avoid any transient name resolution issues */
function BankTable({ rows = [] as Question[], loading, onEdit, selectedId, onSelect, onAssign, onDelete }: { rows?: Question[]; loading: boolean; onEdit: (id: string) => void; selectedId?: string | null; onSelect?: (id: string) => void; onAssign?: (id: string) => void; onDelete?: (id: string) => void }) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuRowId, setMenuRowId] = useState<string | null>(null);
    const open = Boolean(menuAnchor);
    const handleOpen = (e: React.MouseEvent<HTMLElement>, id: string) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuRowId(id); };
    const handleClose = () => { setMenuAnchor(null); setMenuRowId(null); };
    const triggerAction = (cb?: (id: string) => void) => { if (cb && menuRowId) cb(menuRowId); handleClose(); };

    return (
        <Box>
            {!safeRows.length && !loading && (
                <Typography variant='body2' color='text.secondary' sx={{ p: 1, whiteSpace: 'normal' }}>{ru.questions.none}</Typography>
            )}
            <Box sx={{
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(2, 1fr)' },
                opacity: loading ? 0.5 : 1,
            }}>
                {safeRows.map(q => (
                    <QuestionCard
                        key={q.id}
                        id={q.id}
                        title={q.title || ru.common.untitledQuestion}
                        difficulty={q.difficulty || 'Intermediate'}
                        status={q.status || 'Draft'}
                        maxPoints={q.maxPoints || 0}
                        attempts={q.attempts || 0}
                        useDefaultGrading={q.useDefaultGrading}
                        selected={selectedId === q.id}
                        onSelect={onSelect}
                        onMenu={handleOpen}
                    />
                ))}
            </Box>
            <Menu
                anchorEl={menuAnchor}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={() => triggerAction(onEdit)} sx={{ whiteSpace: 'normal' }}><EditIcon fontSize='small' style={{ marginRight: 8 }} /> {ru.questions.edit}</MenuItem>
                <MenuItem onClick={() => triggerAction(onAssign)} sx={{ whiteSpace: 'normal' }}><AddIcon fontSize='small' style={{ marginRight: 8 }} /> {ru.questions.assign}</MenuItem>
                <MenuItem onClick={() => triggerAction(onDelete)} sx={{ whiteSpace: 'normal' }}>
                    <ListItemIcon><DeleteIcon fontSize='small' color='error' /></ListItemIcon>
                    <ListItemText primaryTypographyProps={{ color: 'error.main' }}>{ru.questions.delete}</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
}

/** Filled + monospace textarea wrapper used in the tabs */
function MonospaceArea(
    props: Omit<React.ComponentProps<typeof TextField>, 'fullWidth' | 'multiline' | 'minRows'> & {
        variant?: 'filled' | 'outlined';
    }
) {
    const { variant = 'filled', ...rest } = props;
    return (
        <TextField
            {...rest}
            variant={variant}
            fullWidth
            multiline
            minRows={8}
            InputProps={{
                sx: {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.55,
                    '& textarea': { fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', tabSize: 4 },
                },
            }}
            inputProps={{
                spellCheck: false,
                autoCapitalize: 'off',
                autoCorrect: 'off',
                autoComplete: 'off',
            }}
        />
    );
}

export default function QuestionManager() {
    const { authFetch, user } = useAuth();
    // Defer rendering until authFetch is available & token resolved to avoid conditional hook rule issues
    const authReady = typeof authFetch === 'function' && !!user?.token;
    // (We still continue declaring hooks below; UI will branch later.)
    if (process.env.NODE_ENV !== 'production') {
        // Lightweight debug (non-blocking)
        // eslint-disable-next-line no-console
        console.debug('[QuestionManager] mount user?', user?.name, 'token?', !!user?.token);
    }
    // form state
    const [tab, setTab] = useState(0); // 0 model answers, 1 hints
    const [difficulty, setDifficulty] = useState('Intermediate');
    const [dataset, setDataset] = useState('Library');
    const [title, setTitle] = useState('');
    const [maxPoints, setMaxPoints] = useState(15);
    const [prompt, setPrompt] = useState('');
    const [modelSql, setModelSql] = useState('');
    const [hints, setHints] = useState('');
    const [initSql, setInitSql] = useState('');
    const [modelQueryInput, setModelQueryInput] = useState('');
    const [modelQueries, setModelQueries] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    // data state
    const [questions, setQuestions] = useState<Question[]>([]);
    // page view state: 'list' (bank) or 'editor'
    const [view, setView] = useState<'list' | 'editor'>('list');
    // assignment chooser state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [assignTargetQuestionId, setAssignTargetQuestionId] = useState<string | null>(null);
    const [assignmentsList, setAssignmentsList] = useState<Assignment[]>([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [assignFilter, setAssignFilter] = useState('');
    // track which assignments already contain the question being assigned
    const [checkingAssignedLinks, setCheckingAssignedLinks] = useState(false);
    const [alreadyLinkedAssignments, setAlreadyLinkedAssignments] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [snack, setSnack] = useState<string | null>(null);
    const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

    const theme = useTheme();

    // preview state for single-question preview (restored richer preview)
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<Question | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // student-style preview interaction state
    const [studentSql, setStudentSql] = useState('');
    const [grading, setGrading] = useState(false);
    // Removed old gradeResult simulation; use real autograder outputs
    const [previewGrade, setPreviewGrade] = useState<number | null>(null);
    const [previewFeedback, setPreviewFeedback] = useState<string[]>([]);
    const [showHint, setShowHint] = useState(false);
    // Student-like preview extra state
    const [previewTab, setPreviewTab] = useState(1); // 0 schema,1 editor
    const [attemptsAllowed] = useState(3);
    const [attemptsUsed, setAttemptsUsed] = useState(0);
    const attemptsLeft = Math.max(0, attemptsAllowed - attemptsUsed);
    const [rubric, setRubric] = useState<{ syntax: number | null; semantics: number | null; results: number | null; absent?: { syntax?: boolean; semantics?: boolean; results?: boolean } }>({ syntax: 0, semantics: 0, results: 0 });
    // Per-question grading parameters
    const [savedDefaults, setSavedDefaults] = useState<GradingOptionsType>({ ...DEFAULT_GRADING_OPTIONS });
    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch('/api/instructor/settings', { method: 'GET' });
                if (res.ok) {
                    const data = await res.json();
                    setSavedDefaults({ ...DEFAULT_GRADING_OPTIONS, ...(data.grading_defaults || {}) });
                }
            } catch { /* ignore */ }
        })();
    }, [authFetch]);
    const [useDefaultGrading, setUseDefaultGrading] = useState<boolean>(true);
    const [customGrading, setCustomGrading] = useState<GradingOptionsType>({ ...DEFAULT_GRADING_OPTIONS });
    useEffect(() => { setCustomGrading({ ...savedDefaults }); }, [savedDefaults]);
    const [gradingDlgOpen, setGradingDlgOpen] = useState(false);

    async function openPreview() {
        // If we're in editor view, show current unsaved form values (no fetch)
        if (view === 'editor') {
            setStudentSql('');
            setPreviewGrade(null);
            setPreviewFeedback([]);
            setShowHint(false);
            setPreviewData(null); // ensure we use local form fields
            setPreviewOpen(true);
            setPreviewLoading(false);
            setPreviewTab(1);
            setAttemptsUsed(0);
            setRubric({ syntax: 0, semantics: 0, results: 0 });
            return;
        }
        const id = selectedId || editingId;
        // reset transient preview interaction state each time
        setStudentSql('');
        setPreviewGrade(null);
        setPreviewFeedback([]);
        setShowHint(false);
        setPreviewOpen(true);
        setPreviewLoading(true);
        setPreviewTab(1);
        setAttemptsUsed(0);
        setRubric({ syntax: 0, semantics: 0, results: 0 });
        if (!id) {
            // No saved question selected; preview current form values
            setPreviewData(null);
            setPreviewLoading(false);
            return;
        }
        try {
            const res = await authFetch(`/api/questions/${id}`);
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            } else {
                setPreviewData(null);
            }
        } catch { setPreviewData(null); } finally { setPreviewLoading(false); }
    }

    async function runPreviewGrade() {
        if (!studentSql.trim() || grading || attemptsLeft <= 0) return;
        const q = previewData || { modelSql, modelQueries, maxPoints, initSql } as Pick<Question, 'modelSql' | 'modelQueries' | 'maxPoints' | 'initSql'>;
        const models: string[] = ([] as string[])
            .concat(q.modelQueries || [])
            .concat(q.modelSql ? [q.modelSql] : [])
            .filter((s, i, arr) => !!s && arr.indexOf(s) === i);
        const init: string = q.initSql || initSql || '';
        const attemptNum = attemptsUsed + 1;
        setGrading(true);
        setPreviewGrade(null);
        setPreviewFeedback([]);
        try {
            // Use chosen grading parameters (defaults or custom)
            // @ts-ignore
            const opts = (typeof useDefaultGrading !== 'undefined' && useDefaultGrading) ? (typeof savedDefaults !== 'undefined' ? savedDefaults : DEFAULT_GRADING_OPTIONS) : (typeof customGrading !== 'undefined' ? customGrading : DEFAULT_GRADING_OPTIONS);
            const payload = {
                sql_data: init,
                sql_create_data: init,
                queries: [[encodeURIComponent('instructor_preview'), attemptNum, '1', studentSql]],
                model_queries: models,
                syntax: parseInt(opts.syntaxSensitivity, 10) || 0,
                semantics: parseInt(opts.semanticsSensitivity, 10) || 0,
                results: parseInt(opts.resultsSensitivity, 10) || 0,
                prop_order: parseInt(opts.evaluationPriority, 10) || 0,
                edit_dist: parseInt(opts.textEditDistance, 10) || 0,
                tree_dist: parseInt(opts.treeEditDistance, 10) || 0,
                check_order: opts.checkOrder ? 1 : 0,
                auto_db: opts.autoDB ? 1 : 0,
                num_db: parseInt(opts.numberOfDBs, 10) || 0,
                dbname: opts.dbName || '',
                use_postgresql: !!opts.use_postgresql,
            };
            // Use same-origin proxy to the autograder (avoids CORS/mixed-content issues)
            const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try { return await fetch(url, { ...options, signal: controller.signal }); }
                finally { clearTimeout(timer); }
            };
            const resp = await fetchWithTimeout('/api/autograde', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 20000);
            if (!resp.ok) throw new Error(`Autograder error ${resp.status}`);
            let data: unknown = null;
            try { data = await resp.json(); } catch { /* ignore */ }
            // Parse grade + feedback heuristically (mirror student logic)
            let g = 0; let fb: string[] = [];
            if (Array.isArray(data) && data.length) {
                const first: any = data[0];
                g = Number(first?.Score || first?.grade || first?.Grade || 0);
                const rawFb = first?.Feedback || first?.feedback || '';
                fb = Array.isArray(rawFb) ? rawFb : String(rawFb).split(/;|\n/).filter((s: string) => s.trim());
                const r = first.Rubric || first.rubric;
                if (r && typeof r === 'object') {
                    setRubric({
                        syntax: typeof r.syntax === 'number' ? r.syntax : null,
                        semantics: typeof r.semantics === 'number' ? r.semantics : null,
                        results: typeof r.results === 'number' ? r.results : null,
                        absent: {
                            syntax: typeof r.syntax !== 'number',
                            semantics: typeof r.semantics !== 'number',
                            results: typeof r.results !== 'number'
                        }
                    });
                }
            } else if (data && typeof data === 'object') {
                const obj: any = data;
                g = Number(obj.score || obj.Score || obj.grade || obj.Grade || 0);
                fb = Array.isArray(obj.feedback) ? obj.feedback : [];
                const r = obj.Rubric || obj.rubric;
                if (r && typeof r === 'object') {
                    setRubric({
                        syntax: typeof r.syntax === 'number' ? r.syntax : null,
                        semantics: typeof r.semantics === 'number' ? r.semantics : null,
                        results: typeof r.results === 'number' ? r.results : null,
                        absent: {
                            syntax: typeof r.syntax !== 'number',
                            semantics: typeof r.semantics !== 'number',
                            results: typeof r.results !== 'number'
                        }
                    });
                }
            }
            setPreviewGrade(g);
            setPreviewFeedback(fb);
            if (!fb.length || !g) {
                // fallback if no rubric extracted
                setRubric(r => ({ syntax: r.syntax ?? 0, semantics: r.semantics ?? 0, results: r.results ?? 0, absent: r.absent || { syntax: true, semantics: true, results: true } }));
            }
        } catch (e) {
            const msg = uiError(e, ru.errors.gradingFailed);
            setPreviewFeedback([`Autograder request failed: ${msg}`]);
        } finally {
            setAttemptsUsed(u => Math.min(attemptsAllowed, u + 1));
            setGrading(false);
        }
    }

    // Helper: extract schema from init SQL for preview (PK underlined)

    async function loadQuestions() {
        if (!user?.token) return; // wait for auth
        setLoading(true);
        try {
            const res = await authFetch('/api/questions', { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load (${res.status})`);
            const data = await res.json();
            setQuestions(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(uiError(e, ru.errors.loadQuestions));
        } finally { setLoading(false); }
    }

    useEffect(() => { void loadQuestions(); }, [user, authFetch]);

    function resetForm() {
        setTitle('');
        setDifficulty('Intermediate');
        setDataset('Library');
        setMaxPoints(15);
        setPrompt('');
        setModelSql('');
        setHints('');
        setInitSql(''); // reset init SQL
        setModelQueries([]);
        setModelQueryInput('');
        setTab(0);
        setEditingId(null);
        // grading parameters
        // Always use latest savedDefaults from backend
        setCustomGrading({ ...savedDefaults });
        // @ts-ignore
        setUseDefaultGrading(true);
        // @ts-ignore
        setGradingDlgOpen(false);
    }

    function startCreate() {
        resetForm();
        // Clear any prior selection from the bank so previews reflect the editor form
        setSelectedId(null);
        setView('editor');
    }

    async function deleteQuestion(id: string) {
        if (!id) return;
        if (!window.confirm(ru.questions.deleteConfirm)) return;
        setDeletingQuestionId(id);
        try {
            const res = await authFetch(`/api/questions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!res.ok) {
                const msg = (await res.json().catch(() => ({})))?.error || 'Delete failed';
                throw new Error(msg);
            }
            setQuestions(list => list.filter(q => q.id !== id));
            if (selectedId === id) setSelectedId(null);
            if (editingId === id) { resetForm(); setView('list'); }
            setSnack(ru.questions.deleted);
        } catch (e: any) {
            setError(uiError(e, ru.errors.deleteQuestion));
        } finally { setDeletingQuestionId(null); }
    }

    async function submitQuestion(publish: boolean) {
        setSaving(true); setError(null);
        const payload: NewQuestionPayload & { id?: string; useDefaultGrading?: boolean; gradingOptions?: GradingOptionsType } = {
            title: title.trim(),
            difficulty,
            maxPoints: Number(maxPoints) || 0,
            dataset,
            prompt,
            modelSql,
            hints,
            publish,
            modelQueries,
            initSql, // include per-question init SQL
            id: editingId || undefined,
            useDefaultGrading,
            gradingOptions: useDefaultGrading ? undefined : customGrading,
        } as any;
        try {
            const res = await authFetch('/api/questions', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to save');
            setSnack(editingId ? ru.questions.updated : (publish ? ru.questions.published : ru.questions.draftSaved));
            resetForm();
            await loadQuestions();
            setView('list');
        } catch (e: any) {
            setError(uiError(e, ru.errors.saveQuestion));
        } finally { setSaving(false); }
    }

    async function loadQuestionDetail(id: string) {
        try {
            const res = await authFetch(`/api/questions/${id}`);
            if (!res.ok) return;
            const q = await res.json();
            setEditingId(q.id);
            setTitle(q.title || '');
            setDifficulty(q.difficulty || 'Intermediate');
            setDataset(q.dataset || 'Library');
            setMaxPoints(q.maxPoints || 0);
            setPrompt(q.prompt || '');
            setModelSql(q.modelSql || '');
            setHints(q.hints || '');
            setInitSql(q.initSql || '');
            setModelQueries(Array.isArray(q.modelQueries) ? q.modelQueries : []);
            setModelQueryInput('');
            setTab(0);
            setUseDefaultGrading(typeof q.useDefaultGrading === 'boolean' ? q.useDefaultGrading : true);
            setCustomGrading(q.gradingOptions ? (q.gradingOptions as any) : { ...savedDefaults });
            setView('editor');
        } catch { /* ignore */ }
    }

    const canSubmit = title.trim().length > 0 && (modelSql.trim().length > 0 || modelQueries.length > 0);

    function addModelQuery() {
        const v = modelQueryInput.trim();
        if (!v) return;
        setModelQueries(list => [...list, v]);
        setModelQueryInput('');
    }
    function removeModelQuery(idx: number) { setModelQueries(list => list.filter((_, i) => i !== idx)); }

    // determine which assignments already contain the target question
    async function refreshAlreadyLinked(questionId: string, assignmentsOverride?: Assignment[]) {
        const list = assignmentsOverride ?? assignmentsList;
        if (!questionId) { setAlreadyLinkedAssignments(new Set()); setCheckingAssignedLinks(false); return; }
        if (!list.length) { setAlreadyLinkedAssignments(new Set()); return; }
        setCheckingAssignedLinks(true);
        try {
            const results = await Promise.all(list.map(async a => {
                try {
                    const r = await authFetch(`/api/assignment-questions?assignmentId=${a.id}`);
                    if (!r.ok) return null;
                    const links = await r.json();
                    if (Array.isArray(links) && links.some((l: any) => l.questionId === questionId)) return a.id;
                } catch { /* ignore */ }
                return null;
            }));
            setAlreadyLinkedAssignments(new Set(results.filter(Boolean) as string[]));
        } finally { setCheckingAssignedLinks(false); }
    }
    // Assign a question to an assignment (missing implementation)
    async function assignQuestionToAssignment(assignmentId: string) {
        if (!assignTargetQuestionId || !assignmentId) return;
        setAssigning(true);
        setAssignmentsError(null);
        try {
            const res = await authFetch('/api/assignment-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId, questionId: assignTargetQuestionId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Failed to assign');
            }
            setSnack(ru.questions.assigned);
            setAssignDialogOpen(false);
        } catch (e: any) {
            setAssignmentsError(uiError(e, ru.errors.assignQuestion));
        } finally { setAssigning(false); }
    }
    // Replace previous openAssignChooser logic with a sequential loader to avoid stuck state
    async function openAssignChooser(questionId: string) {
        setAssignTargetQuestionId(questionId);
        setAssignDialogOpen(true);
        setAssignFilter('');
        setAssignmentsError(null);
        setAlreadyLinkedAssignments(new Set());
        setCheckingAssignedLinks(true);
        try {
            if (!assignmentsList.length) {
                setAssignmentsLoading(true);
                const res = await authFetch('/api/assignments');
                if (!res.ok) throw new Error(`Failed (${res.status})`);
                const data = await res.json();
                const arr: Assignment[] = Array.isArray(data) ? data : [];
                setAssignmentsList(arr); // schedule state update
                await refreshAlreadyLinked(questionId, arr); // use fresh list directly
            } else {
                await refreshAlreadyLinked(questionId, assignmentsList);
            }
        } catch (e: any) {
            setAssignmentsError(uiError(e, ru.errors.loadAssignments));
            setCheckingAssignedLinks(false);
        } finally {
            setAssignmentsLoading(false);
        }
    }

    const filteredAssignmentsList = assignmentsList.filter(a => {
        if (checkingAssignedLinks) return false;
        if (alreadyLinkedAssignments.has(a.id)) return false;
        const f = assignFilter.trim().toLowerCase();
        if (!f) return true;
        return a.title.toLowerCase().includes(f) || (a.tags || []).some(t => t.toLowerCase().includes(f));
    });

    // dataset selection + create-new only (management moved to Datasets page)
    const [datasets, setDatasets] = useState<Array<{ id: string; name: string; sql: string }>>([]);
    const [datasetDlgOpen, setDatasetDlgOpen] = useState(false);
    const [datasetName, setDatasetName] = useState('');
    const [datasetSql, setDatasetSql] = useState('');
    const [savingDataset, setSavingDataset] = useState(false);
    const [loadingDatasets, setLoadingDatasets] = useState(false);

    async function loadDatasets() {
        setLoadingDatasets(true);
        try {
            const res = await authFetch('/api/datasets');
            const data = await res.json();
            if (Array.isArray(data)) setDatasets(data);
        } catch { /* ignore */ } finally { setLoadingDatasets(false); }
    }

    useEffect(() => { void loadDatasets(); }, []);

    async function createDataset() {
        if (!datasetName.trim() || !datasetSql.trim()) return;
        setSavingDataset(true);
        try {
            const res = await authFetch('/api/datasets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: datasetName.trim(), sql: datasetSql }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed');
            setDatasets(prev => [...prev, data]);
            // select it and copy SQL into Init SQL
            setDataset(data.name);
            setInitSql(data.sql || '');
            setDatasetDlgOpen(false);
            setDatasetName(''); setDatasetSql('');
        } catch (e: any) {
            alert(uiError(e, ru.errors.saveDataset));
        } finally { setSavingDataset(false); }
    }

    // Early auth gating (after all hooks declared)
    if (!authReady) {
        return <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.questions.authInit}</Typography>;
    }

    const headerActions = (
        <HeaderActions
            actions={[
                view === 'list' ? {
                    key: 'preview',
                    label: ru.questions.preview,
                    ariaLabel: ru.questions.preview,
                    onClick: openPreview,
                    disabled: !selectedId,
                    icon: <VisibilityIcon fontSize='small' />,
                } : null,
                view === 'list' ? {
                    key: 'add',
                    label: ru.questions.add,
                    ariaLabel: ru.questions.add,
                    onClick: startCreate,
                    icon: <AddIcon fontSize='small' />,
                    emphasis: 'high',
                } : null,
                view === 'editor' ? {
                    key: 'back',
                    label: ru.questions.back,
                    ariaLabel: ru.questions.back,
                    onClick: () => { setView('list'); },
                    icon: <ArrowBackIcon fontSize='small' />,
                } : null,
                view === 'editor' ? {
                    key: 'new',
                    label: ru.questions.new,
                    ariaLabel: ru.questions.newForm,
                    onClick: resetForm,
                } : null,
            ].filter(Boolean) as any}
        />
    );

    return (
        <PageCard headerTitle={view === 'editor' ? (editingId ? ru.questions.editTitle : ru.questions.createTitle) : ru.questions.listTitle} headerProps={{ height: 56 }} headerActions={headerActions} headerActionsVariant='plain'>
            <Box sx={{ display: 'grid', gap: 2, p: { xs: 2, md: 3 } }}>
                {view === 'editor' && (
                    <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, bgcolor: 'transparent', backgroundImage: 'none' }}>
                        {/* Editor form */}
                        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: 'repeat(2,1fr)', xs: '1fr' } }}>
                            <Box>
                                <TextField label={ru.common.title} placeholder={ru.questions.titlePh} variant="outlined" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
                            </Box>
                            <Box>
                                <TextField label={ru.common.difficulty} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} select variant="outlined" fullWidth>
                                    {['Beginner', 'Intermediate', 'Advanced'].map((d) => (
                                        <MenuItem key={d} value={d}>{difficultyLabel(d)}</MenuItem>
                                    ))}
                                </TextField>
                            </Box>
                            <Box>
                                <TextField label={ru.questions.maxPoints} type="number" value={maxPoints} onChange={(e) => setMaxPoints(Number(e.target.value))} variant="outlined" fullWidth />
                            </Box>
                            <Box>
                                <TextField
                                    label={ru.questions.dataset}
                                    value={dataset}
                                    onChange={(e) => {
                                        const v = e.target.value as string;
                                        if (v === '__create__') { setDatasetDlgOpen(true); return; }
                                        setDataset(v);
                                        const hit = datasets.find(d => d.name === v);
                                        if (hit) setInitSql(hit.sql || '');
                                    }}
                                    select
                                    variant="outlined"
                                    fullWidth
                                >
                                    <MenuItem value='__create__' sx={{ whiteSpace: 'normal' }}><AddIcon fontSize='small' style={{ marginRight: 8 }} />{ru.questions.newDataset}</MenuItem>
                                    <Divider />
                                    {loadingDatasets && <MenuItem disabled>{ru.questions.loadingDatasets}</MenuItem>}
                                    {datasets.map(d => <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>)}
                                </TextField>
                            </Box>
                            <Box sx={{ gridColumn: '1 / -1' }}>
                                <RichTextEditor label={ru.questions.prompt} value={prompt} onChange={setPrompt} placeholder={ru.questions.promptHelp} />
                            </Box>
                            {/* Grading parameters selector */}
                            <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                <Tooltip
                                    arrow
                                    enterDelay={400}
                                    placement='top-start'
                                    title={
                                        <Box sx={{ p: 0.5 }}>
                                            <Typography variant='caption' sx={{ fontWeight: 700, display: 'block', mb: 0.5, whiteSpace: 'normal' }}>{ru.questions.defaultsTitle}</Typography>
                                            <Box component='ul' sx={{ m: 0, pl: 2, listStyle: 'disc' }}>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.syntax}: {protocolLabel(savedDefaults.syntaxSensitivity)}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.semantics}: {protocolLabel(savedDefaults.semanticsSensitivity)}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.results}: {protocolLabel(savedDefaults.resultsSensitivity)}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.priorityShort}: {protocolLabel(savedDefaults.evaluationPriority)}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.textDistance}: {savedDefaults.textEditDistance}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.treeDistance}: {savedDefaults.treeEditDistance}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.checkOrder}: {savedDefaults.checkOrder ? ru.common.yes : ru.common.no}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.autoDb}: {savedDefaults.autoDB ? ru.questions.autoDbOn(savedDefaults.numberOfDBs || '—', savedDefaults.dbName || undefined) : ru.common.no}</Typography></li>
                                                <li><Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.grading.usePg}: {savedDefaults.use_postgresql ? ru.common.on : ru.common.off}</Typography></li>
                                            </Box>
                                        </Box>
                                    }
                                >
                                    <Box component='span'>
                                        <FormControlLabel sx={{ alignItems: 'flex-start', '& .MuiFormControlLabel-label': { whiteSpace: 'normal' } }} control={<Switch checked={useDefaultGrading as any} onChange={(_, v) => setUseDefaultGrading(v as any)} />} label={ru.questions.useDefaults} />
                                    </Box>
                                </Tooltip>
                                <Button size='small' variant='outlined' sx={{ whiteSpace: 'normal' }} disabled={useDefaultGrading as any} onClick={() => setGradingDlgOpen(true)}>{ru.questions.customParams}</Button>
                            </Box>
                            <Box sx={{ gridColumn: '1 / -1' }}>
                                <SqlEditor label={ru.questions.initSql} placeholder={ru.questions.initSqlPh} value={initSql} onChange={setInitSql} minRows={10} />
                            </Box>
                            <Box sx={{ gridColumn: '1 / -1' }}>
                                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36 }}>
                                    <Tab label={ru.questions.modelAnswers} sx={{ minHeight: 36, whiteSpace: 'normal' }} />
                                    <Tab label={ru.questions.hints} sx={{ minHeight: 36, whiteSpace: 'normal' }} />
                                </Tabs>
                                <Divider sx={{ mb: 2 }} />
                                {tab === 0 && (
                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <SqlEditor label={ru.questions.primaryModel} placeholder={ru.questions.primaryModelPh} value={modelSql} onChange={setModelSql} minRows={10} />
                                        <Box>
                                            <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.questions.extraModels}</Typography>
                                            <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
                                                <SqlEditor label={ru.questions.addModel} placeholder={ru.questions.modelPh} value={modelQueryInput} onChange={setModelQueryInput} minRows={4} onEnterSubmit={addModelQuery} />
                                                <Button size='small' variant='outlined' startIcon={<AddIcon />} onClick={addModelQuery} disabled={!modelQueryInput.trim()} sx={{ whiteSpace: 'normal' }}>{ru.common.add}</Button>
                                                {!modelQueries.length && <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.questions.noExtra}</Typography>}
                                                {!!modelQueries.length && (
                                                    <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                                        {modelQueries.map((mq, i) => (
                                                            <ListItem key={i} secondaryAction={<IconButton edge='end' onClick={() => removeModelQuery(i)}><DeleteIcon fontSize='small' /></IconButton>}>
                                                                <ListItemText primaryTypographyProps={{ sx: { fontFamily: 'ui-monospace,monospace', fontSize: 13 } }} primary={mq} />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                )}
                                                {!!modelQueries.length && <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.questions.extraCount(modelQueries.length)}</Typography>}
                                            </Box>
                                        </Box>
                                    </Box>
                                )}
                                {tab === 1 && (
                                    <TextField label={ru.questions.hints} placeholder={ru.questions.hintsOptional} variant="outlined" multiline minRows={6} fullWidth value={hints} onChange={(e) => setHints(e.target.value)} />
                                )}
                            </Box>
                        </Box>
                        <Box sx={{ mt: 2, justifyContent: 'space-between', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {editingId && <Button startIcon={<CancelIcon />} size='small' sx={{ whiteSpace: 'normal' }} onClick={() => { resetForm(); setView('list'); }}>{ru.questions.cancelEdit}</Button>}
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button variant="outlined" startIcon={editingId ? <SaveIcon /> : <TaskAltIcon />} size="small" sx={{ whiteSpace: 'normal' }} disabled={!canSubmit || saving} onClick={() => submitQuestion(false)}>{editingId ? ru.questions.updateDraft : ru.questions.saveDraft}</Button>
                                <Button variant="contained" startIcon={<AutoAwesomeIcon />} size="small" sx={{ whiteSpace: 'normal' }} disabled={!canSubmit || saving} onClick={() => submitQuestion(true)}>{editingId ? ru.questions.updatePublish : ru.questions.publish}</Button>
                            </Box>
                        </Box>
                    </Box>
                )}

                {view === 'list' && (
                    <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, bgcolor: 'transparent', backgroundImage: 'none' }}>
                        <BankTable rows={questions} loading={loading} onEdit={loadQuestionDetail} selectedId={selectedId} onSelect={setSelectedId} onAssign={openAssignChooser} onDelete={deleteQuestion} />
                        {error && <Typography variant="caption" color="error" sx={{ mt: 1 }}>{error}</Typography>}
                    </Box>
                )}
                {/* ASSIGN QUESTION -> ASSIGNMENT DIALOG */}
                <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} fullWidth maxWidth='sm'>
                    <DialogTitle sx={{ whiteSpace: 'normal' }}>{ru.questions.assignTitle}</DialogTitle>
                    <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField label={ru.questions.filterAssignments} size='small' value={assignFilter} onChange={e => setAssignFilter(e.target.value)} helperText={ru.questions.filterHelp} />
                        {(assignmentsLoading || checkingAssignedLinks) && <LinearProgress />}
                        {assignmentsError && <Typography variant='caption' color='error'>{assignmentsError}</Typography>}
                        <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {!assignmentsLoading && checkingAssignedLinks && (
                                <Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.questions.checkingLinks}</Typography>
                            )}
                            {!assignmentsLoading && !checkingAssignedLinks && !filteredAssignmentsList.length && (
                                <Typography variant='caption' sx={{ whiteSpace: 'normal' }}>{ru.questions.noAssignments}</Typography>
                            )}
                            {!checkingAssignedLinks && filteredAssignmentsList.map(a => (
                                <Box key={a.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }} onClick={() => assignQuestionToAssignment(a.id)}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <Typography variant='body2' fontWeight={600} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{a.title}</Typography>
                                        <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.common.dueOn(a.due ? formatDue(a.due) : '—')} • {difficultyLabel(a.difficulty)} • {ru.common.pts(a.points)}</Typography>
                                    </Box>
                                    <Button size='small' variant='outlined' disabled={assigning} sx={{ whiteSpace: 'normal' }}>{assigning ? ru.questions.assigning : ru.questions.assignBtn}</Button>
                                </Box>
                            ))}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAssignDialogOpen(false)} sx={{ whiteSpace: 'normal' }}>{ru.common.close}</Button>
                    </DialogActions>
                </Dialog>
                <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                    <Alert severity='success' variant='filled' onClose={() => setSnack(null)}>{snack}</Alert>
                </Snackbar>
                {/* Per-question Grading Parameters dialog */}
                <Dialog open={gradingDlgOpen} onClose={() => setGradingDlgOpen(false)} fullWidth maxWidth='md'>
                    <DialogTitle sx={{ whiteSpace: 'normal' }}>{ru.questions.customDialog}</DialogTitle>
                    <DialogContent dividers>
                        <GradingOptions options={customGrading as any} onChange={(k, v) => setCustomGrading(prev => ({ ...(prev as any), [k]: v }))} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setGradingDlgOpen(false)} sx={{ whiteSpace: 'normal' }}>{ru.common.close}</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={previewOpen} onClose={() => { setPreviewOpen(false); setPreviewData(null); }} fullWidth maxWidth='xl'>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', whiteSpace: 'normal' }}>
                        <Chip size='small' color='warning' label={ru.player.previewMode} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                        {(previewData?.title || title) || ru.common.untitledQuestion}
                    </DialogTitle>
                    <DialogContent dividers sx={{ p: 2 }}>
                        {previewLoading && <LinearProgress sx={{ mb: 2 }} />}
                        {!previewLoading && (
                            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { lg: '1fr 340px', md: '1fr', sm: '1fr' } }}>
                                {/* LEFT: question working area replicating student view */}
                                <Card variant='outlined' sx={{ order: { md: 0 } }}>
                                    <CardHeader title={<Typography variant='subtitle1' sx={{ fontSize: 16, whiteSpace: 'normal' }}>{previewData?.title || title || ru.common.untitledQuestion}</Typography>} subheader={<Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.player.previewMode} • {ru.player.attemptsLeft(attemptsLeft)}</Typography>} />
                                    <CardContent sx={{ pt: 0, display: 'grid', gap: 1.5 }}>
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            {!!(previewData?.difficulty || difficulty) && <DifficultyChip value={previewData?.difficulty || difficulty} />}
                                            <Chip size='small' label={ru.common.pts(previewData?.maxPoints ?? maxPoints)} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                            <Chip size='small' variant='outlined' label={ru.questions.datasetLine(previewData?.dataset || dataset)} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                            <Chip size='small' color='default' variant='outlined' label={ru.questions.attemptsUsed(attemptsUsed)} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                        </Box>
                                        <Box>
                                            <PromptWithHint
                                                prompt={String(previewData?.prompt || prompt || ru.common.noPrompt)}
                                                hint={String(previewData?.hints || hints || '')}
                                                showHint={showHint}
                                                onToggle={() => setShowHint(s => !s)}
                                                promptKey={`preview-prompt-${previewData?.id || 'local'}`}
                                                hintKeyPrefix={`preview-hint-${previewData?.id || 'local'}`}
                                            />
                                        </Box>
                                        <Tabs value={previewTab} onChange={(_, v) => setPreviewTab(v)} sx={{ mt: 1 }}>
                                            <Tab label={ru.common.schema} sx={{ whiteSpace: 'normal' }} />
                                            <Tab label={ru.common.editor} sx={{ whiteSpace: 'normal' }} />
                                        </Tabs>
                                        {previewTab === 0 && (
                                            <Box sx={{ color: 'text.secondary', fontSize: 14 }}>
                                                <p style={{ margin: 0 }}>{ru.common.schema}</p>
                                                <SchemaPreview sql={String(previewData?.initSql || initSql || '')} />
                                            </Box>
                                        )}
                                        {previewTab === 1 && (
                                            <SqlEditor value={studentSql} onChange={setStudentSql} placeholder={ru.player.sqlPlaceholder} />
                                        )}
                                    </CardContent>
                                </Card>
                                {/* RIGHT: grading panel similar to student view */}
                                <Card variant='outlined'>
                                    <CardHeader title={<Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.player.autoGrader}</Typography>} />
                                    <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                            <Button onClick={runPreviewGrade} disabled={grading || !studentSql.trim() || attemptsLeft <= 0} startIcon={<PlayArrowIcon />} variant='contained' sx={{ whiteSpace: 'normal' }}>{grading ? ru.common.grading : ru.common.run}</Button>
                                            <Button variant='outlined' startIcon={<DoneIcon />} disabled sx={{ whiteSpace: 'normal' }}>{ru.common.submit}</Button>
                                        </Box>
                                        <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.player.previewNotSaved} {ru.player.attemptsMeta(attemptsAllowed, attemptsUsed, attemptsLeft)}</Typography>
                                        <Divider />
                                        <GradeDisplay grade={previewGrade} denom={previewData?.maxPoints ?? maxPoints} />
                                        <Divider />
                                        <RubricBars rubric={rubric} />
                                        <Divider />
                                        <Typography variant='body2' color='text.secondary'>{ru.common.feedback}</Typography>
                                        <FeedbackList feedback={previewFeedback} emptyText={grading ? ru.questions.gradingNow : ru.questions.noFeedbackYet} />
                                    </CardContent>
                                </Card>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setPreviewOpen(false); setPreviewData(null); }} sx={{ whiteSpace: 'normal' }}>{ru.common.close}</Button>
                    </DialogActions>
                </Dialog>

                {/* DATASET CREATE/MANAGE DIALOG */}
                <Dialog open={datasetDlgOpen} onClose={() => setDatasetDlgOpen(false)} fullWidth maxWidth='md'>
                    <DialogTitle sx={{ whiteSpace: 'normal' }}>{ru.questions.createDataset}</DialogTitle>
                    <DialogContent dividers>
                        <Box sx={{ display: 'grid', gap: 2 }}>
                            <TextField variant='outlined' label={ru.questions.datasetName} value={datasetName} onChange={e => setDatasetName(e.target.value)} />
                            <MonospaceArea variant='outlined' label={ru.questions.initSqlShort} value={datasetSql} onChange={e => setDatasetSql(e.target.value)} />
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: 'wrap' }}>
                        <Button onClick={() => setDatasetDlgOpen(false)} sx={{ whiteSpace: 'normal' }}>{ru.common.cancel}</Button>
                        <Button variant='contained' onClick={createDataset} disabled={!datasetName.trim() || !datasetSql.trim() || savingDataset} sx={{ whiteSpace: 'normal' }}>{savingDataset ? ru.common.saving : ru.common.save}</Button>
                    </DialogActions>
                </Dialog>

            </Box>
        </PageCard>
    );
}
