'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Box, Card, CardContent, Typography, Chip, Button, TextField, MenuItem, Select, FormControl, InputLabel, Tooltip, Divider } from '@mui/material';
import PageCard from '@/components/PageCard';
import { useAuth } from '@/features/auth/AuthProvider';
import HeaderActions from '@/components/HeaderActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InstructorSubmissionPlayer from '@/features/instructor/InstructorSubmissionPlayer';
import { m as ru, statusLabel, formatDateTimeDDMMYYYYHHmm } from '@/i18n';

interface ReviewReq { id: string; assignmentId: string; questionId: string; submissionId: string; student: string; comment: string; status: string; createdAt: string; updatedAt: string; instructorReply?: string | null; replyAt?: string | null; }
interface AssignmentLite { id: string; title: string; }
interface QuestionLite { id: string; title: string; assignmentId?: string; }

export default function InstructorReviewRequests() {
    const { authFetch } = useAuth();
    const [requests, setRequests] = useState<ReviewReq[]>([]);
    const [loading, setLoading] = useState(false);
    const [assignments, setAssignments] = useState<AssignmentLite[]>([]);
    const [questions, setQuestions] = useState<QuestionLite[]>([]);
    const [filterAssignment, setFilterAssignment] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('Pending');
    const [search, setSearch] = useState('');
    // Inline viewer state
    const [activeRequest, setActiveRequest] = useState<ReviewReq | null>(null);
    const [activeSubmission, setActiveSubmission] = useState<any | null>(null);
    const [fetchingSubmission, setFetchingSubmission] = useState(false);
    // Thread messages
    const [messages, setMessages] = useState<any[]>([]);
    const [msgDraft, setMsgDraft] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const [manualGrade, setManualGrade] = useState<string>('');
    const [manualFeedback, setManualFeedback] = useState<string>('');
    const [savingManual, setSavingManual] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    // polling refs
    const msgPollRef = useRef<any>(null);
    const listPollRef = useRef<any>(null);

    async function load() {
        setLoading(true);
        try {
            const [aRes, rRes] = await Promise.all([
                authFetch('/api/assignments?include=questions'),
                authFetch('/api/review-requests')
            ]);
            let aData: any[] = []; if (aRes.ok) aData = await aRes.json();
            let rData: any[] = []; if (rRes.ok) rData = await rRes.json();
            const as: AssignmentLite[] = aData.map(a => ({ id: a.id, title: a.title }));
            const qs: QuestionLite[] = aData.flatMap(a => (a.questions || []).map((q: any) => ({ id: q.id, title: q.title, assignmentId: a.id })));
            setAssignments(as); setQuestions(qs);
            setRequests(rData || []);
        } finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);
    // Poll list while there are pending requests or an activeRequest is open
    useEffect(() => {
        const shouldPoll = !activeRequest && (requests.some(r => r.status === 'Pending') || filterStatus === 'Pending');
        if (!shouldPoll) { if (listPollRef.current) { clearInterval(listPollRef.current); listPollRef.current = null; } return; }
        if (listPollRef.current) return;
        listPollRef.current = setInterval(() => { load(); }, 10000); // every 10s
        return () => { if (listPollRef.current) { clearInterval(listPollRef.current); listPollRef.current = null; } };
    }, [requests, filterStatus, activeRequest]);

    async function updateStatus(id: string, status: string) {
        const res = await authFetch('/api/review-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
        if (res.ok) {
            const upd = await res.json();
            setRequests(r => r.map(rr => rr.id === id ? upd : rr));
            if (activeRequest && activeRequest.id === id) setActiveRequest(upd); // reflect change inline
        }
    }

    async function loadMessages(requestId: string) {
        try {
            const res = await authFetch(`/api/review-request-messages?requestId=${requestId}`);
            if (res.ok) {
                const arr = await res.json();
                setMessages(Array.isArray(arr) ? arr : []);
            }
        } catch { /* ignore */ }
    }

    async function sendMessage() {
        if (!activeRequest || !msgDraft.trim()) return;
        setSendingMsg(true);
        try {
            const res = await authFetch('/api/review-request-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: activeRequest.id, message: msgDraft.trim() }) });
            if (res.ok) {
                const created = await res.json();
                setMessages(m => [...m, created]);
                setMsgDraft('');
            }
        } finally { setSendingMsg(false); }
    }

    async function saveManualRegrade() {
        if (!activeRequest || !activeSubmission) return;
        const q = (activeSubmission.questions || []).find((q: any) => q.questionId === activeRequest.questionId);
        if (!q?.id) return;
        const gradeNum = manualGrade.trim() === '' ? null : Number(manualGrade);
        setSavingManual(true);
        try {
            const res = await authFetch('/api/question-submissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id, grade: gradeNum, feedback: manualFeedback.split(/\n+/).map(f => f.trim()).filter(Boolean), status: 'Manual', incrementAttempt: true }) });
            if (res.ok) {
                // refresh question submissions for submission so player sees latest
                const qsRes = await authFetch(`/api/question-submissions?submissionId=${activeRequest.submissionId}`);
                if (qsRes.ok) {
                    const qs = await qsRes.json();
                    setActiveSubmission((s: any) => s ? { ...s, questions: qs } : s);
                }
                // Clear inputs
                setManualFeedback('');
                // keep grade to maybe apply again
                // Show success feedback and temporarily disable button
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2500);
            }
        } finally { setSavingManual(false); }
    }

    async function openRequest(r: ReviewReq) {
        setActiveRequest(r); setActiveSubmission(null); setFetchingSubmission(true);
        setMessages([]); setMsgDraft('');
        try {
            // fetch submission
            const subRes = await authFetch(`/api/submissions?id=${encodeURIComponent(r.submissionId)}`);
            let submission: any = null;
            if (subRes.ok) {
                const data = await subRes.json();
                submission = Array.isArray(data) ? data.find((s: any) => s.id === r.submissionId) : data;
            }
            // fetch question submissions for that submission
            if (submission) {
                const qsRes = await authFetch(`/api/question-submissions?submissionId=${r.submissionId}`);
                if (qsRes.ok) {
                    const qs = await qsRes.json();
                    submission = { ...submission, questions: qs };
                }
            }
            setActiveSubmission(submission);
        } finally { setFetchingSubmission(false); }
        // load messages after base data
        void loadMessages(r.id);
    }
    // Poll messages of active pending request
    useEffect(() => {
        if (!activeRequest || activeRequest.status !== 'Pending') { if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; } return; }
        if (msgPollRef.current) return;
        msgPollRef.current = setInterval(() => { loadMessages(activeRequest.id); }, 5000);
        return () => { if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; } };
    }, [activeRequest?.id, activeRequest?.status]);

    const filtered = useMemo(() => {
        return requests.filter(r => (
            (!filterAssignment || r.assignmentId === filterAssignment) &&
            (!filterStatus || r.status === filterStatus) &&
            (!search || r.comment.toLowerCase().includes(search.toLowerCase()) || r.student.toLowerCase().includes(search.toLowerCase()))
        ));
    }, [requests, filterAssignment, filterStatus, search]);

    const assignmentTitle = (id: string) => assignments.find(a => a.id === id)?.title || '—';
    const questionTitle = (id: string) => questions.find(q => q.id === id)?.title || '—';

    const headerActions = activeRequest ? (
        <HeaderActions actions={[
            { key: 'back', label: ru.reviews.back, ariaLabel: ru.reviews.backTip, onClick: () => { setActiveRequest(null); setActiveSubmission(null); }, icon: <ArrowBackIcon fontSize='small' /> }
        ]} />
    ) : (
        <HeaderActions actions={[
            { key: 'refresh', label: ru.reviews.refresh, ariaLabel: ru.reviews.refresh, onClick: () => load(), icon: <RefreshIcon fontSize='small' /> }
        ]} />
    );

    return (
        <PageCard headerTitle={activeRequest ? ru.reviews.viewer : ru.reviews.list(filtered.length, filterStatus ? statusLabel(filterStatus) : '')} headerProps={{ height: 56 }} headerActions={headerActions} headerActionsVariant='plain'>
            <CardContent sx={{ display: 'grid', gap: 2 }}>
                {!activeRequest && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size='small' sx={{ minWidth: 180 }}>
                            <InputLabel sx={{ whiteSpace: 'normal' }}>{ru.reviews.assignment}</InputLabel>
                            <Select label={ru.reviews.assignment} value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}>
                                <MenuItem value=''><em>{ru.reviews.all}</em></MenuItem>
                                {assignments.map(a => <MenuItem key={a.id} value={a.id} sx={{ whiteSpace: 'normal' }}>{a.title}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size='small' sx={{ minWidth: 160 }}>
                            <InputLabel>{ru.reviews.status}</InputLabel>
                            <Select label={ru.reviews.status} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <MenuItem value=''><em>{ru.reviews.all}</em></MenuItem>
                                <MenuItem value='Pending'>{statusLabel('Pending')}</MenuItem>
                                <MenuItem value='Resolved'>{statusLabel('Resolved')}</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField size='small' placeholder={ru.reviews.search} value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 240 }, flex: '1 1 220px' }} />
                    </Box>
                )}
                {!activeRequest && (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                        {filtered.map(r => (
                            <Card key={r.id} variant='outlined' sx={{ p: 1.25, display: 'grid', gap: .5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography variant='subtitle2' sx={{ fontWeight: 600, whiteSpace: 'normal' }}>{assignmentTitle(r.assignmentId)}</Typography>
                                    <Chip size='small' color={r.status === 'Pending' ? 'warning' : r.status === 'Resolved' ? 'success' : 'default'} label={statusLabel(r.status)} sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                                </Box>
                                <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{questionTitle(r.questionId)}</Typography>
                                <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{r.comment}</Typography>
                                <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{`${ru.reviews.studentLine(r.student)} · ${ru.reviews.submitted(formatDateTimeDDMMYYYYHHmm(r.createdAt))}`}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {r.status === 'Pending' && <Button size='small' variant='contained' color='success' startIcon={<CheckCircleIcon fontSize='inherit' />} onClick={() => updateStatus(r.id, 'Resolved')} sx={{ whiteSpace: 'normal' }}>{ru.reviews.resolve}</Button>}
                                    {r.status === 'Resolved' && <Button size='small' variant='outlined' color='error' startIcon={<CloseIcon fontSize='inherit' />} onClick={() => updateStatus(r.id, 'Pending')} sx={{ whiteSpace: 'normal' }}>{ru.reviews.reopen}</Button>}
                                    <Tooltip title={ru.reviews.viewTip}>
                                        <Button size='small' variant='text' startIcon={<VisibilityIcon fontSize='inherit' />} onClick={() => openRequest(r)}>{ru.reviews.view}</Button>
                                    </Tooltip>
                                </Box>
                            </Card>
                        ))}
                        {!filtered.length && !loading && (
                            <Typography variant='body2' color='text.secondary'>{ru.reviews.none}</Typography>
                        )}
                        {loading && (
                            <Typography variant='body2' color='text.secondary'>{ru.reviews.loading}</Typography>
                        )}
                    </Box>
                )}
                {activeRequest && (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Card variant='outlined' sx={{ p: 1.25, display: 'grid', gap: .75 }}>
                            <Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{assignmentTitle(activeRequest.assignmentId)}</Typography>
                            <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{questionTitle(activeRequest.questionId)}</Typography>
                            <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{activeRequest.comment}</Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {activeRequest.status === 'Pending' && <Button size='small' variant='contained' color='success' onClick={() => updateStatus(activeRequest.id, 'Resolved')} sx={{ whiteSpace: 'normal' }}>{ru.reviews.resolve}</Button>}
                                {activeRequest.status === 'Resolved' && <Button size='small' variant='outlined' color='error' onClick={() => updateStatus(activeRequest.id, 'Pending')} sx={{ whiteSpace: 'normal' }}>{ru.reviews.reopen}</Button>}
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>{ru.reviews.thread}</Typography>
                            <Box sx={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: .75, mt: .5, pr: .5 }}>
                                {messages.map(m => (
                                    <Box key={m.id} sx={{ alignSelf: m.senderRole === 'instructor' ? 'flex-end' : 'flex-start', maxWidth: '80%', p: .75, borderRadius: 1, bgcolor: m.senderRole === 'instructor' ? 'secondary.light' : 'grey.100', border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant='caption' sx={{ display: 'block', fontWeight: 600, whiteSpace: 'normal' }}>
                                            {m.senderRole === 'instructor' ? ru.reviews.instructor : ru.reviews.student}{m.sender ? ` · ${m.sender}` : ''}
                                        </Typography>
                                        <Typography variant='caption' sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>{m.message}</Typography>
                                    </Box>
                                ))}
                                {!messages.length && <Typography variant='caption' color='text.secondary'>{ru.reviews.noMessages}</Typography>}
                            </Box>
                            {activeRequest.status === 'Pending' && (
                                <Box sx={{ mt: 1, display: 'grid', gap: .75 }}>
                                    <TextField multiline minRows={2} size='small' placeholder={ru.reviews.reply} value={msgDraft} onChange={e => setMsgDraft(e.target.value)} />
                                    <Button size='small' variant='outlined' disabled={sendingMsg || !msgDraft.trim()} onClick={sendMessage} sx={{ whiteSpace: 'normal', justifyContent: 'flex-start' }}>{sendingMsg ? ru.reviews.sending : ru.reviews.send}</Button>
                                </Box>
                            )}
                        </Card>
                        {fetchingSubmission && <Typography variant='body2' color='text.secondary'>{ru.reviews.loadingSubmission}</Typography>}
                        {activeSubmission && (
                            <InstructorSubmissionPlayer
                                assignmentId={activeRequest.assignmentId}
                                submission={activeSubmission}
                                initialQuestionId={activeRequest.questionId}
                                onClose={() => { setActiveRequest(null); setActiveSubmission(null); }}
                            />
                        )}
                        {activeSubmission && (
                            <Card variant='outlined' sx={{ p: 1.25, display: 'grid', gap: .75 }}>
                                <Typography variant='subtitle2' sx={{ whiteSpace: 'normal' }}>{ru.reviews.manual}</Typography>
                                <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'normal' }}>{ru.reviews.manualHelp}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <TextField label={ru.reviews.grade} size='small' value={manualGrade} onChange={e => setManualGrade(e.target.value)} sx={{ width: 140 }} />
                                </Box>
                                <TextField multiline minRows={3} size='small' label={ru.reviews.feedbackLines} value={manualFeedback} onChange={e => setManualFeedback(e.target.value)} sx={{ '& .MuiInputLabel-root': { whiteSpace: 'normal' } }} />
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Button size='small' variant='contained' disabled={savingManual || saveSuccess} onClick={saveManualRegrade} startIcon={saveSuccess ? <DoneIcon fontSize='inherit' /> : undefined} sx={{ whiteSpace: 'normal' }}>
                                        {savingManual ? ru.reviews.saving : saveSuccess ? ru.reviews.saved : ru.reviews.saveManual}
                                    </Button>
                                    {saveSuccess && (
                                        <Typography variant='caption' color='success.main' sx={{ whiteSpace: 'normal' }}>{ru.reviews.savedNote}</Typography>
                                    )}
                                </Box>
                            </Card>
                        )}
                        {!fetchingSubmission && !activeSubmission && <Typography variant='caption' color='text.secondary'>{ru.reviews.notFound}</Typography>}
                    </Box>
                )}
            </CardContent>
        </PageCard>
    );
}
