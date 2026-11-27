"use client";
import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import {
    Box,
    Card,
    CardContent,
    CardActions,
    Typography,
    TextField,
    IconButton,
    Button,
    CircularProgress,
    Tooltip,
    Chip,
    LinearProgress,
    Alert,
    InputAdornment,
    MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { Assignment, AssignmentWithQuestions, Question } from '@/lib/types';
import DifficultyChip from '@/components/DifficultyChip';
import { m as ru, statusLabel, uiError } from '@/i18n';

interface PickerProps {
    assignment: Assignment | AssignmentWithQuestions | null;
    onClose?: () => void;
}

export interface AssignmentQuestionPickerHandle {
    save: () => Promise<void> | void;
}

const AssignmentQuestionPicker = forwardRef<AssignmentQuestionPickerHandle, PickerProps>(function AssignmentQuestionPicker({ assignment, onClose }, ref) {
    const { authFetch, user } = useAuth();
    const [loadingBank, setLoadingBank] = useState(false);
    const [loadingLinks, setLoadingLinks] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [bank, setBank] = useState<Question[]>([]);
    const [linked, setLinked] = useState<any[]>([]); // each has question fields + position + pointsOverride
    const [filter, setFilter] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pointsEdit, setPointsEdit] = useState<Record<string, string>>({});

    const assignId = assignment?.id;

    const filteredBank = useMemo(() => {
        const f = filter.toLowerCase();
        const linkedIds = new Set((linked || []).map((l: any) => l.questionId));
        return bank.filter(q => !linkedIds.has(q.id) && (!f || q.title.toLowerCase().includes(f) || q.difficulty.toLowerCase().includes(f)));
    }, [bank, filter, linked]);
    const totalLinkedPoints = useMemo(() => {
        return linked.reduce((sum, l) => {
            const edit = pointsEdit[l.questionId];
            const val = edit === '' || edit === undefined ? (Number(l.pointsOverride ?? l.maxPoints) || 0) : Number(edit) || 0;
            return sum + val;
        }, 0);
    }, [linked, pointsEdit]);

    async function loadBank() {
        setLoadingBank(true); setError(null);
        try {
            if (!user?.token) return;
            const res = await authFetch('/api/questions');
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed');
            const data = await res.json();
            setBank(data);
        } catch (e: any) { setError(uiError(e, ru.errors.loadQuestions)); } finally { setLoadingBank(false); }
    }
    async function loadLinked() {
        if (!assignId) return;
        setLoadingLinks(true); setError(null);
        try {
            if (!user?.token) return;
            const res = await authFetch(`/api/assignment-questions?assignmentId=${assignId}`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed');
            const data = await res.json();
            setLinked(data);
            setPointsEdit(Object.fromEntries(data.map((r: any) => [r.questionId, r.pointsOverride != null ? String(r.pointsOverride) : ''])));
        } catch (e: any) { setError(uiError(e, ru.errors.generic)); } finally { setLoadingLinks(false); }
    }

    useEffect(() => { loadBank(); }, [user?.token]);
    useEffect(() => { loadLinked(); }, [assignId, user?.token]);

    const [variants, setVariants] = useState<Array<{ id: string; label: string; title: string }>>([]);
    const [variantId, setVariantId] = useState('');
    useEffect(() => {
        if (!assignId || !user?.token) return;
        void authFetch(`/api/assignment-variants?assignmentId=${assignId}`).then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setVariants(list);
            setVariantId((current) => current || list[0]?.id || '');
        }).catch(() => undefined);
    }, [assignId, user?.token, authFetch]);
    async function addQuestion(q: Question) {
        if (!assignId) return;
        try {
            if (!user?.token) throw new Error('Not authenticated');
            const res = await authFetch('/api/assignment-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId: assignId, questionId: q.id, position: linked.length, variantId: variantId || null }) });
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed');
            await loadLinked();
        } catch (e: any) { setError(uiError(e, ru.errors.assignQuestion)); }
    }
    async function removeQuestion(questionId: string) {
        if (!assignId) return;
        try {
            if (!user?.token) throw new Error('Not authenticated');
            const res = await authFetch(`/api/assignment-questions?assignmentId=${assignId}&questionId=${questionId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Failed');
            setLinked(l => l.filter(r => r.questionId !== questionId));
        } catch (e: any) { setError(uiError(e, ru.errors.generic)); }
    }
    function move(questionId: string, dir: -1 | 1) {
        setLinked(prev => {
            const arr = [...prev];
            const idx = arr.findIndex(r => r.questionId === questionId);
            if (idx < 0) return prev;
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= arr.length) return prev;
            const [item] = arr.splice(idx, 1);
            arr.splice(newIdx, 0, item);
            return arr.map((r, i) => ({ ...r, position: i }));
        });
    }
    async function saveOrder() {
        if (!assignId) return;
        setSavingOrder(true); setError(null);
        try {
            const order = linked.map(l => ({ questionId: l.questionId, position: l.position }));
            if (!user?.token) throw new Error('Not authenticated');
            let res = await authFetch('/api/assignment-questions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId: assignId, order }) });
            if (!res.ok) throw new Error(uiError((await res.json().catch(() => ({})))?.error || 'Failed to reorder', ru.errors.reorder));
            for (const l of linked) {
                const po = pointsEdit[l.questionId];
                if (po !== undefined) {
                    res = await authFetch('/api/assignment-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId: assignId, questionId: l.questionId, position: l.position, pointsOverride: po === '' ? null : Number(po) }) });
                    if (!res.ok) throw new Error(uiError((await res.json().catch(() => ({})))?.error || 'Failed to set points', ru.errors.points));
                }
            }
            await loadLinked();
        } catch (e: any) { setError(uiError(e, ru.errors.reorder)); } finally { setSavingOrder(false); }
    }

    const bankIds = useMemo(() => new Set(linked.map(l => l.questionId)), [linked]);

    useImperativeHandle(ref, () => ({ save: saveOrder }), [linked, pointsEdit, assignId]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 520, maxHeight: '82vh' }}>
            <Box sx={{ flex: 1, display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr 1fr', xs: '1fr' }, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
                {/* BANK */}
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: { md: 420, xs: '100%' } }}>
                    <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', mb: 1, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.picker.bank}</Typography>
                            <Chip size='small' label={`${filteredBank.length}/${bank.length}`} />
                        </Box>
                        <Tooltip title={ru.picker.refresh}><span><IconButton onClick={loadBank} disabled={loadingBank} aria-label={ru.picker.refresh}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                        <TextField size="small" variant="outlined" placeholder={ru.common.filter} value={filter} onChange={e => setFilter(e.target.value)} fullWidth />
                        {variants.length > 0 && (
                            <TextField select size='small' label={ru.variants.placeIn} value={variantId} onChange={(e) => setVariantId(e.target.value)} sx={{ minWidth: 200 }}>
                                {variants.map((v) => <MenuItem key={v.id} value={v.id}>{v.title || v.label}</MenuItem>)}
                            </TextField>
                        )}
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            '& > *': { flexShrink: 0 }
                        }}
                    >
                        {loadingBank && (
                            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                                <CircularProgress size={20} />
                            </Box>
                        )}
                        {!loadingBank && filteredBank.map(q => {
                            const isLinked = bankIds.has(q.id);
                            return (
                                <Card key={q.id} variant="outlined" sx={{ borderColor: isLinked ? 'primary.main' : 'divider', opacity: isLinked ? 0.95 : 1 }}>
                                    <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                            <Typography variant='body2' fontWeight={600} title={q.title} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{q.title}</Typography>
                                            {isLinked && <Chip label={ru.picker.linkedChip} size='small' color='primary' variant='outlined' sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />}
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: .75, flexWrap: 'wrap' }}>
                                            <DifficultyChip value={q.difficulty} />
                                            <Chip size='small' label={statusLabel(q.status)} color={q.status === 'Published' ? 'primary' : 'default'} variant={q.status === 'Published' ? 'outlined' : 'filled'} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                            <Chip size='small' label={ru.picker.maxPts(q.maxPoints)} variant='outlined' sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                        </Box>
                                    </CardContent>
                                    <CardActions sx={{ pt: 0, pb: 1, pr: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        <Tooltip title={isLinked ? ru.picker.already : ru.picker.add}>
                                            <span>
                                                <IconButton size='small' disabled={isLinked || !assignId} onClick={() => addQuestion(q)} aria-label={ru.picker.addTitle(q.title)}>
                                                    <AddIcon fontSize='inherit' />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </CardActions>
                                </Card>
                            );
                        })}
                        {!loadingBank && !filteredBank.length && (
                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.picker.noMatch}</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* LINKED */}
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: { md: 420, xs: '100%' }, position: 'relative' }}>
                    <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', mb: 1, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.picker.linked}</Typography>
                            <Chip size='small' label={`${linked.length}`} />
                            <Chip size='small' color='primary' variant='outlined' label={ru.picker.total(totalLinkedPoints)} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            position: 'relative',
                            '& > *': { flexShrink: 0 }
                        }}
                    >
                        {loadingLinks && (
                            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                                <CircularProgress size={20} />
                            </Box>
                        )}
                        {!loadingLinks && linked.sort((a, b) => a.position - b.position).map((l, idx) => (
                            <Card key={l.questionId} variant='outlined'>
                                <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                            <Chip size='small' label={ru.picker.position(idx + 1)} sx={{ fontWeight: 600 }} />
                                            <Typography variant='body2' fontWeight={600} title={l.title} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{l.title}</Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: .75, flexWrap: 'wrap' }}>
                                        <DifficultyChip value={l.difficulty} />
                                        <Chip size='small' label={statusLabel(l.status)} color={l.status === 'Published' ? 'primary' : 'default'} variant={l.status === 'Published' ? 'outlined' : 'filled'} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                        <Chip size='small' label={ru.picker.defaultPts(l.maxPoints)} variant='outlined' sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        <TextField
                                            size='small'
                                            variant='outlined'
                                            type='number'
                                            value={pointsEdit[l.questionId] ?? ''}
                                            label={ru.picker.override}
                                            placeholder='—'
                                            aria-label={ru.picker.overrideFor(l.title)}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v === '') { setPointsEdit(p => ({ ...p, [l.questionId]: '' })); return; }
                                                if (!/^\d+$/.test(v)) return; // numeric only
                                                const num = Number(v);
                                                if (num < 1) { setPointsEdit(p => ({ ...p, [l.questionId]: '1' })); return; }
                                                setPointsEdit(p => ({ ...p, [l.questionId]: String(num) }));
                                            }}
                                            onBlur={e => {
                                                const v = e.target.value;
                                                if (v === '') return;
                                                const num = Number(v);
                                                if (isNaN(num) || num < 1) setPointsEdit(p => ({ ...p, [l.questionId]: '1' }));
                                            }}
                                            InputProps={{ endAdornment: <InputAdornment position="end">{ru.picker.pts}</InputAdornment> }}
                                            inputProps={{ min: 1, step: 1, style: { paddingTop: 6, paddingBottom: 6 } }}
                                            sx={{ width: 180, maxWidth: '100%' }}
                                        />
                                        <Box sx={{ display: 'flex', gap: .5, ml: 'auto' }}>
                                            <Tooltip title={ru.picker.up}><span><IconButton size='small' disabled={idx === 0} onClick={() => move(l.questionId, -1)} aria-label={ru.picker.up}><ArrowUpwardIcon fontSize='inherit' /></IconButton></span></Tooltip>
                                            <Tooltip title={ru.picker.down}><span><IconButton size='small' disabled={idx === linked.length - 1} onClick={() => move(l.questionId, 1)} aria-label={ru.picker.down}><ArrowDownwardIcon fontSize='inherit' /></IconButton></span></Tooltip>
                                            <Tooltip title={ru.picker.remove}><IconButton size='small' onClick={() => removeQuestion(l.questionId)} aria-label={ru.picker.remove}><DeleteIcon fontSize='inherit' /></IconButton></Tooltip>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                        {!loadingLinks && !linked.length && (
                            <Box sx={{ py: 2, textAlign: 'center' }}>
                                <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.picker.empty}</Typography>
                            </Box>
                        )}
                        {savingOrder && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
                    </Box>
                </Box>
            </Box>
            {!!error && <Alert severity='error' sx={{ mx: 2, mb: 1 }}>{error}</Alert>}
            <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal', flex: '1 1 240px' }}>{ru.picker.unsaved}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size='small' variant='outlined' onClick={() => { loadBank(); loadLinked(); }} sx={{ whiteSpace: 'normal' }}>{ru.picker.reload}</Button>
                    {onClose && <Button size='small' onClick={onClose} sx={{ whiteSpace: 'normal' }}>{ru.picker.done}</Button>}
                </Box>
            </CardActions>
        </Box>
    );
});

export default AssignmentQuestionPicker;
