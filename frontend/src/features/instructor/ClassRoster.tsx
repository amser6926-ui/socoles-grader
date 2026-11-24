'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Box, Button, Chip, Snackbar, Alert, Table, TableBody, TableCell, TableHead, TableRow, TextField, Stack, IconButton, Tooltip, Typography, Switch, FormControlLabel } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import Papa from 'papaparse';
import PageCard from '@/components/PageCard';
import HeaderActions from '@/components/HeaderActions';
import { useAuth } from '@/features/auth/AuthProvider';
import type { RosterEntry, InviteResponse, Assignment, Submission } from '@/lib/types';
import { m as ru, uiError, statusLabel, formatDateTimeDDMMYYYYHHmm, formatNumber } from '@/i18n';

export default function ClassRoster() {
    const { authFetch, user } = useAuth();
    const [rows, setRows] = useState<RosterEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string>('');
    const [err, setErr] = useState<string>('');

    // manual add form
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    // hidden file input ref for import CSV
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [search, setSearch] = useState('');
    const [showRemoved, setShowRemoved] = useState(false);
    // Map rosterId -> latest invite (to surface expiry state)
    const [invitesByRoster, setInvitesByRoster] = useState<Record<string, InviteResponse>>({});
    const [exportingCsv, setExportingCsv] = useState(false);

    const rowsToShow = useMemo(() => {
        const q = search.trim().toLowerCase();
        // Optionally include Removed entries based on toggle
        const base = showRemoved ? rows : rows.filter(r => r.status !== 'Removed');
        if (!q) return base;
        return base.filter(r => (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q));
    }, [rows, search, showRemoved]);

    async function load() {
        try {
            setBusy(true);
            const res = await authFetch('/api/roster');
            const data = await res.json();
            if (Array.isArray(data)) {
                // Filter out Removed so they don't block re-adds
                setRows(data);
            }
            // Also fetch latest invites for instructor/TA to mark expired
            if (isInstructor || isTA) {
                try {
                    const ir = await authFetch('/api/invites');
                    const invites = await ir.json();
                    if (Array.isArray(invites)) {
                        const map: Record<string, InviteResponse> = {};
                        for (const inv of invites) {
                            const existing = map[inv.rosterId];
                            // Keep the most recent (assume array sorted newest first from API)
                            if (!existing) map[inv.rosterId] = inv;
                        }
                        setInvitesByRoster(map);
                    }
                } catch (e: any) {
                    // Non-fatal; just skip marking expiry
                }
            }
        } catch (e: any) { setErr(uiError(e, ru.errors.loadRoster)); } finally { setBusy(false); }
    }
    // Initial load
    useEffect(() => { load(); }, []);

    // Polling & focus/visibility-based refresh
    const pollRef = useRef<number | null>(null);
    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    const startPolling = () => {
        stopPolling();
        // Poll every 20s while component is mounted & tab visible
        pollRef.current = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                load();
            }
        }, 20000);
    };
    useEffect(() => {
        startPolling();
        function onVisibility() { if (document.visibilityState === 'visible') load(); }
        function onFocus() { load(); }
        window.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);
        return () => {
            stopPolling();
            window.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function addOne() {
        if (!name.trim() || !email.trim()) { setErr(ru.roster.nameEmailRequired); return; }
        // Prevent adding duplicate emails (case-insensitive)
        const emailNorm = email.trim().toLowerCase();
        // Ignore Removed entries when checking duplicates; re-add will revive them
        const exists = rows.some(r => r.status !== 'Removed' && (r.email || '').toLowerCase() === emailNorm);
        if (exists) { setErr(ru.roster.emailExists); return; }
        try {
            setBusy(true);
            // New manual additions start as Pending; they become Invited only after creating an invite
            const res = await authFetch('/api/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), status: 'Pending' }) });
            const data = await res.json();
            if (Array.isArray(data) && data.length) setRows((r) => [...data, ...r]); else if (data?.id) setRows((r) => [data, ...r]);
            setName(''); setEmail(''); setNote(ru.roster.added);
        } catch (e: any) { setErr(uiError(e, ru.errors.addRoster)); } finally { setBusy(false); }
    }

    async function remove(id: string) {
        try {
            setBusy(true);
            const res = await authFetch(`/api/roster?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (res.ok) setRows((r) => r.filter((x) => x.id !== id)); else setErr(uiError('Delete failed', ru.errors.deleteRoster));
        } catch (e: any) { setErr(uiError(e, ru.errors.deleteRoster)); } finally { setBusy(false); }
    }

    async function onCsv(evt: React.ChangeEvent<HTMLInputElement>) {
        const file = evt.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setErr('');
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results: { data: Array<Record<string, unknown>> }) => {
                try {
                    const parsed = (results.data || [])
                        .map((r) => ({ name: String((r as any).name || (r as any).Name || '').trim(), email: String((r as any).email || (r as any).Email || '').trim().toLowerCase() }))
                        .filter((r) => r.name && r.email);
                    if (!parsed.length) { setErr(ru.roster.noValidRows); return; }
                    // Skip duplicates that already exist in roster (case-insensitive) and within the CSV itself
                    // Exclude Removed entries from duplicate detection
                    const existing = new Set(rows.filter(x => x.status !== 'Removed').map(x => (x.email || '').toLowerCase()));
                    const seen = new Set<string>();
                    const toImport: { name: string; email: string }[] = [];
                    let skipped = 0;
                    for (const rec of parsed) {
                        const e = (rec.email || '').toLowerCase();
                        if (!e || existing.has(e) || seen.has(e)) { skipped++; continue; }
                        seen.add(e);
                        toImport.push({ name: rec.name, email: e });
                    }
                    if (!toImport.length) {
                        setErr(skipped > 0 ? ru.roster.allExist(skipped) : ru.roster.noValidRows);
                        return;
                    }
                    const res = await authFetch('/api/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: toImport }) });
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setRows((r) => [...data, ...r]);
                        setNote(ru.roster.imported(data.length));
                        if (skipped > 0) setErr(ru.roster.skipped(skipped));
                    } else {
                        setErr(uiError((data as { error?: string })?.error, ru.roster.importFailed));
                    }
                } catch (err: unknown) {
                    setErr(uiError(err, ru.roster.importFailed));
                } finally {
                    setBusy(false);
                    evt.target.value = '';
                }
            },
            error: (error: { message?: string }) => { setErr(uiError(error.message, ru.roster.parseError)); setBusy(false); },
        });
    }


    async function createInvite(row: RosterEntry) {
        try {
            setBusy(true);
            const res = await authFetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rosterId: row.id, email: row.email, name: row.name }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to create invite');
            const link = data?.link as string;
            // Optimistically mark as Invited
            setRows(r => r.map(x => x.id === row.id ? { ...x, status: 'Invited' } as RosterEntry : x));
            // Try to copy to clipboard; provide a manual fallback
            try {
                await navigator.clipboard.writeText(link);
            } catch {
                // Fallback: show a prompt so user can copy manually
                try { window.prompt(ru.roster.copyPrompt, link); } catch { /* ignore */ }
            }
            if (data?.emailSent) {
                setNote(ru.roster.sentCopied);
            } else {
                setNote(ru.roster.copiedNoEmail);
            }
        } catch (e: any) {
            setErr(uiError(e, ru.errors.invite));
        } finally {
            setBusy(false);
        }
    }

    async function cancelInvite(row: RosterEntry) {
        try {
            setBusy(true);
            const res = await authFetch('/api/invites/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rosterId: row.id }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to cancel invite');
            setRows(r => r.map(x => x.id === row.id ? { ...x, status: 'Pending' } as RosterEntry : x));
            setNote(ru.roster.canceled);
        } catch (e: any) {
            setErr(uiError(e, ru.errors.cancelInvite));
        } finally {
            setBusy(false);
        }
    }

    async function copyInviteLink(row: RosterEntry) {
        try {
            setBusy(true);
            const res = await authFetch(`/api/invites?rosterId=${encodeURIComponent(row.id)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(uiError(data?.error || 'Failed to fetch invite', ru.errors.fetchInvite));
            const invite = Array.isArray(data) ? data[0] : data;
            const link = invite?.link as string | undefined;
            if (!link) {
                // Attempt a refresh to pick up latest status and links
                await load();
                setErr(ru.roster.linkUnavailable);
                return;
            }
            try {
                await navigator.clipboard.writeText(link);
            } catch {
                try { window.prompt(ru.roster.copyPrompt, link); } catch { /* ignore */ }
            }
            setNote(ru.roster.copied);
        } catch (e: any) {
            setErr(uiError(e, ru.roster.copyFailed));
        } finally {
            setBusy(false);
        }
    }

    async function exportRosterCsv() {
        if (exportingCsv) return;
        if (!user?.token) { setErr(uiError('You are not authenticated.', ru.errors.generic)); return; }
        try {
            setExportingCsv(true);
            setErr('');
            const [assignmentsRes, submissionsRes] = await Promise.all([
                authFetch('/api/assignments'),
                authFetch('/api/submissions')
            ]);
            if (!assignmentsRes.ok) throw new Error(uiError('Failed to load assignments', ru.errors.loadAssignments));
            if (!submissionsRes.ok) throw new Error(uiError('Failed to load submissions', ru.errors.loadSubmissions));
            const assignmentsJson: unknown = await assignmentsRes.json();
            const submissionsJson: unknown = await submissionsRes.json();
            const assignmentsList = (Array.isArray(assignmentsJson) ? assignmentsJson : []) as Assignment[];
            const publishedAssignments = assignmentsList.filter((a) => a && a.id && a.published !== false);
            const activeAssignments = publishedAssignments.length ? publishedAssignments : assignmentsList.filter((a) => a && a.id);
            const assignmentLookup = new Map<string, Assignment>();
            activeAssignments.forEach((assignment) => { if (assignment?.id) assignmentLookup.set(String(assignment.id), assignment); });
            const assignmentIds = Array.from(assignmentLookup.keys());
            const submissionsList = (Array.isArray(submissionsJson) ? submissionsJson : []) as Submission[];
            const attemptedByStudent = new Map<string, Set<string>>();
            const completedByStudent = new Map<string, Set<string>>();
            submissionsList.forEach((submission) => {
                const studentKey = typeof submission?.student === 'string' ? submission.student.trim().toLowerCase() : '';
                const assignmentId = submission?.assignmentId ? String(submission.assignmentId) : '';
                if (!studentKey || !assignmentId || !assignmentLookup.has(assignmentId)) return;
                if (!attemptedByStudent.has(studentKey)) attemptedByStudent.set(studentKey, new Set());
                attemptedByStudent.get(studentKey)!.add(assignmentId);
                const hasGrade = typeof submission?.grade === 'number' && Number.isFinite(submission.grade);
                if (hasGrade) {
                    if (!completedByStudent.has(studentKey)) completedByStudent.set(studentKey, new Set());
                    completedByStudent.get(studentKey)!.add(assignmentId);
                }
            });

            const totalAssignments = assignmentIds.length;
            const dataset = rows.map((entry) => {
                const studentKey = (entry.email || '').trim().toLowerCase();
                const attemptedSet = attemptedByStudent.get(studentKey) || new Set<string>();
                const completedSet = completedByStudent.get(studentKey) || new Set<string>();
                const attemptedIds = Array.from(attemptedSet);
                const completedIds = Array.from(completedSet);
                const completedTitles = completedIds.map((id) => assignmentLookup.get(id)?.title || id);
                const attemptedInProgressTitles = attemptedIds
                    .filter((id) => !completedSet.has(id))
                    .map((id) => assignmentLookup.get(id)?.title || id);
                const missingAssignments = totalAssignments
                    ? assignmentIds.filter((id) => !completedSet.has(id))
                    : [];
                const missingTitles = missingAssignments.map((id) => assignmentLookup.get(id)?.title || id);
                const completionRate = totalAssignments ? formatNumber((completedSet.size / totalAssignments) * 100, 1) : ru.roster.na;
                const missingCount = totalAssignments ? totalAssignments - completedSet.size : 0;
                const overallStatus = totalAssignments === 0
                    ? ru.roster.noAssignments
                    : completedSet.size === totalAssignments
                        ? ru.roster.complete
                        : completedSet.size > 0
                            ? ru.roster.partial
                            : ru.roster.noSubmissions;
                return {
                    [ru.roster.name]: entry.name || '',
                    [ru.roster.email]: entry.email || '',
                    [ru.roster.csv.rosterStatus]: statusLabel(entry.status) || ru.roster.unknown,
                    [ru.roster.csv.published]: totalAssignments,
                    [ru.roster.csv.attempted]: attemptedSet.size,
                    [ru.roster.csv.completed]: completedSet.size,
                    [ru.roster.csv.missing]: missingCount,
                    [ru.roster.csv.rate]: completionRate,
                    [ru.roster.csv.progress]: overallStatus,
                    [ru.roster.csv.completedList]: completedTitles.join('; '),
                    [ru.roster.csv.inProgress]: attemptedInProgressTitles.join('; '),
                    [ru.roster.csv.missingList]: missingTitles.join('; '),
                };
            });

            if (!dataset.length) {
                setErr(ru.roster.exportEmpty);
                return;
            }

            const csv = Papa.unparse(dataset);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateLabel = new Date().toISOString().split('T')[0];
            link.href = url;
            link.setAttribute('download', `roster-progress-${dateLabel}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setNote(ru.roster.exported);
        } catch (e: any) {
            setErr(uiError(e, ru.roster.exportFailed));
        } finally {
            setExportingCsv(false);
        }
    }

    const isInstructor = user?.role === 'instructor';
    const isTA = user?.role === 'student' && !!user?.evaluator;
    const headerActions = (
        <>
            <HeaderActions
                actions={[
                    // Instructors and TAs can import
                    ...((isInstructor || isTA) ? [{
                        key: 'import',
                        label: ru.roster.import,
                        ariaLabel: ru.roster.import,
                        icon: <UploadFileIcon fontSize='small' />,
                        onClick: () => { /* trigger hidden input */ inputRef.current?.click(); },
                    }] : []),
                    ...(isInstructor ? [{
                        key: 'export',
                        label: exportingCsv ? ru.roster.exporting : ru.roster.export,
                        ariaLabel: ru.roster.exportTip,
                        icon: <FileDownloadIcon fontSize='small' />,
                        onClick: () => exportRosterCsv(),
                        disabled: busy || exportingCsv || rows.length === 0,
                    }] : []),
                    {
                        key: 'refresh',
                        ariaLabel: ru.roster.refresh,
                        label: ru.common.refresh,
                        icon: <RefreshIcon fontSize='small' />,
                        onClick: () => load(),
                        disabled: busy || exportingCsv,
                    }
                ]}
            />
            {(isInstructor || isTA) && <input ref={inputRef} hidden accept='.csv' type='file' onChange={onCsv} />}
        </>
    );

    return (
        <PageCard headerTitle={ru.roster.title} headerProps={{ height: 56 }} headerActions={headerActions} headerActionsVariant='plain' loadingProgress={busy || exportingCsv}>
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                {(isInstructor || isTA) && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-end' }} sx={{ mb: 2 }}>
                        <TextField size="small" label={ru.roster.fullName} value={name} onChange={(e) => setName(e.target.value)} sx={{ flex: 1, '& .MuiInputLabel-root': { whiteSpace: 'normal' } }} />
                        <TextField size="small" label={ru.roster.email} value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: 1 }} />
                        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={addOne} disabled={busy} sx={{ whiteSpace: 'normal' }}>{ru.roster.add}</Button>
                    </Stack>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 1 }}>
                    <TextField
                        size="small"
                        label={ru.roster.search}
                        type="search"
                        placeholder={ru.roster.searchPh}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            endAdornment: search ? (
                                <IconButton aria-label={ru.roster.clear} size="small" onClick={() => setSearch('')}>
                                    <CancelIcon fontSize="small" />
                                </IconButton>
                            ) : undefined,
                        }}
                        sx={{ width: { xs: '100%', sm: 300 } }}
                    />
                    {user?.role === 'instructor' && (
                        <FormControlLabel
                            control={<Switch size="small" checked={showRemoved} onChange={(_, checked) => setShowRemoved(checked)} />}
                            label={ru.roster.showRemoved}
                            sx={{ whiteSpace: 'normal', mr: 0 }}
                        />
                    )}
                </Stack>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell width={56}>#</TableCell>
                            <TableCell sx={{ whiteSpace: 'normal' }}>{ru.roster.name}</TableCell>
                            <TableCell sx={{ whiteSpace: 'normal' }}>{ru.roster.email}</TableCell>
                            <TableCell sx={{ whiteSpace: 'normal' }}>{ru.roster.status}</TableCell>
                            {user?.role === 'instructor' && <TableCell sx={{ whiteSpace: 'normal' }}>{ru.roster.privileges}</TableCell>}
                            <TableCell align="right" sx={{ whiteSpace: 'normal' }}>{ru.roster.actions}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rowsToShow.map((r, idx) => (
                            <TableRow key={r.id} hover>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{r.name}</TableCell>
                                <TableCell>{r.email}</TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={(() => {
                                            if (r.status === 'Invited') {
                                                const inv = invitesByRoster[r.id];
                                                if (inv?.expiresAt && !inv.usedAt) {
                                                    const exp = new Date(inv.expiresAt).getTime();
                                                    if (Date.now() > exp) return ru.roster.expired;
                                                }
                                            }
                                            return statusLabel(r.status);
                                        })()}
                                        sx={{ height: 'auto', maxWidth: 160, '& .MuiChip-label': { whiteSpace: 'normal' } }}
                                        color={(() => {
                                            const inv = invitesByRoster[r.id];
                                            if (r.status === 'Invited' && inv?.expiresAt && !inv.usedAt) {
                                                const exp = new Date(inv.expiresAt).getTime();
                                                if (Date.now() > exp) return 'error';
                                            }
                                            return r.status === 'Active' ? 'success' : r.status === 'Invited' ? 'primary' : r.status === 'Pending' ? 'warning' : 'default';
                                        })()}
                                        variant={r.status === 'Invited' || r.status === 'Pending' ? 'outlined' : 'filled'}
                                        title={(() => {
                                            const inv = invitesByRoster[r.id];
                                            if (inv?.expiresAt) {
                                                const expDate = new Date(inv.expiresAt);
                                                const expired = Date.now() > expDate.getTime();
                                                const when = formatDateTimeDDMMYYYYHHmm(inv.expiresAt);
                                                return expired ? ru.roster.inviteExpired(when) : ru.roster.inviteExpires(when);
                                            }
                                            return undefined;
                                        })()}
                                    />
                                </TableCell>
                                {user?.role === 'instructor' && <TableCell>
                                    {r.status !== 'Removed' ? (
                                        <Tooltip title={ru.roster.taLong} arrow>
                                            <FormControlLabel
                                                sx={{ ml: 0, whiteSpace: 'normal' }}
                                                control={<Switch size="small" checked={!!r.evaluator} onChange={async (_, checked) => {
                                                    try {
                                                        setBusy(true);
                                                        const res = await authFetch('/api/roster', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, evaluator: checked }) });
                                                        const data = await res.json();
                                                        if (!res.ok) throw new Error(data?.error || 'Failed to update');
                                                        setRows(rows => rows.map(x => x.id === r.id ? { ...x, evaluator: data.evaluator } : x));
                                                        setNote(checked ? ru.roster.grantTa : ru.roster.revokeTa);
                                                    } catch (e: any) {
                                                        setErr(uiError(e, ru.errors.updateRoster));
                                                    } finally {
                                                        setBusy(false);
                                                    }
                                                }} />}
                                                label={ru.roster.ta}
                                            />
                                        </Tooltip>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">—</Typography>
                                    )}
                                </TableCell>}
                                <TableCell align="right">
                                    {(isInstructor || isTA) ? (
                                        <>
                                            {r.status === 'Pending' && (
                                                <Tooltip title={ru.roster.createInvite}>
                                                    <span>
                                                        <IconButton size="small" color="primary" onClick={() => createInvite(r)} disabled={busy}><LinkIcon fontSize="small" /></IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                            {r.status === 'Invited' && (
                                                <Tooltip title={ru.roster.copyInvite}>
                                                    <span>
                                                        <IconButton size="small" color="secondary" onClick={() => copyInviteLink(r)} disabled={busy}><LinkIcon fontSize="small" /></IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                            {isInstructor && r.status === 'Invited' && (
                                                <Tooltip title={ru.roster.cancelInvite}>
                                                    <span>
                                                        <IconButton size="small" color="warning" onClick={() => cancelInvite(r)} disabled={busy}><CancelIcon fontSize="small" /></IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                            {isInstructor && r.status !== 'Removed' && (
                                                <Tooltip title={ru.common.delete}>
                                                    <span>
                                                        <IconButton size="small" color="error" aria-label={ru.common.delete} onClick={() => remove(r.id)} disabled={busy}><DeleteIcon fontSize="small" /></IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                        {rowsToShow.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={isInstructor ? 6 : 5} sx={{ whiteSpace: 'normal' }}>
                                    {rows.length === 0 ? ru.roster.empty : ru.roster.noMatches}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Box>
            <Snackbar open={!!note} autoHideDuration={3000} onClose={() => setNote('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setNote('')} severity="success" sx={{ width: '100%' }}>{note}</Alert>
            </Snackbar>
            <Snackbar open={!!err} autoHideDuration={5000} onClose={() => setErr('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setErr('')} severity="error" sx={{ width: '100%' }}>{err}</Alert>
            </Snackbar>
        </PageCard>
    );
}