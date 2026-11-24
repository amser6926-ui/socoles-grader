'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    Snackbar,
    TextField,
    Alert,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import GradingOptions from '@/features/instructor/GradingOptions';
import type { GradingOptions as GradingOptionsType } from '@/lib/types';
import { DEFAULT_GRADING_OPTIONS } from '@/lib/api';
import PageCard from '@/components/PageCard';
import HeaderActions from '@/components/HeaderActions';
import HeaderOverflowMenu from '@/components/HeaderOverflowMenu';
import { useAuth } from '@/features/auth/AuthProvider';
import { m as ru, uiError } from '@/i18n';

type Settings = {
    courseName: string;
    enrollmentCode: string;
    attempts: number;
    latePenalty: number;     // % per day
    passThreshold: number;   // % overall
    gradingDefaults: GradingOptionsType;
};

type Course = {
    id: string;
    name: string;
    enrollmentCode: string;
    isDefault: boolean;
};

const DEFAULTS: Settings = {
    courseName: 'DB101 - Intermediate SQL',
    enrollmentCode: 'DB101-SA10',
    attempts: 3,
    latePenalty: 10,
    passThreshold: 0.60,
    gradingDefaults: { ...DEFAULT_GRADING_OPTIONS },
};

export default function InstructorSettings() {
    const { user, setUser, authFetch } = useAuth();
    // State for settings
    const [s, setS] = useState<Settings>(DEFAULTS);
    // Track loading state for settings fetch
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [accountEmail, setAccountEmail] = useState<string>('');
    const [accountName, setAccountName] = useState<string>('');
    const [nameDirty, setNameDirty] = useState(false);
    // Fetch instructor settings from backend on mount
    useEffect(() => {
        (async () => {
            setLoadingSettings(true);
            try {
                const res = await authFetch('/api/instructor/settings', { method: 'GET' });
                if (res.ok) {
                    const data = await res.json();
                    setS({
                        courseName: data.course_name || DEFAULTS.courseName,
                        enrollmentCode: data.enrollment_code || DEFAULTS.enrollmentCode,
                        attempts: data.attempts ?? DEFAULTS.attempts,
                        latePenalty: data.late_penalty ?? DEFAULTS.latePenalty,
                        passThreshold: data.pass_threshold ?? DEFAULTS.passThreshold,
                        gradingDefaults: data.grading_defaults || { ...DEFAULT_GRADING_OPTIONS },
                    });
                }
            } catch {
                // fallback: do nothing, keep defaults
            } finally {
                setLoadingSettings(false);
            }
        })();
        // Prefer user.email, fallback to localStorage
        if (user?.email) {
            setAccountEmail(user.email);
        } else {
            try {
                const raw = localStorage.getItem('auth.current');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.email) setAccountEmail(parsed.email);
                    if (parsed?.name) setAccountName(parsed.name);
                }
            } catch { /* ignore */ }
        }
    }, [authFetch, user]);

    function saveAccountName() {
        try {
            const raw = localStorage.getItem('auth.current');
            const parsed = raw ? JSON.parse(raw) : {};
            const next = { ...parsed, name: accountName };
            localStorage.setItem('auth.current', JSON.stringify(next));
            if (user) setUser({ ...user, name: accountName });
            setNote({ type: 'success', msg: ru.settings.nameUpdated });
            setNameDirty(false);
        } catch (e) {
            setNote({ type: 'error', msg: uiError(e, ru.settings.nameFailed) });
        }
    }
    const [note, setNote] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
    const [purgeOpen, setPurgeOpen] = useState(false);
    const [purging, setPurging] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const [courses, setCourses] = useState<Course[]>([]);
    const [defaultCourseId, setDefaultCourseId] = useState<string>('');
    const [newCourseName, setNewCourseName] = useState<string>('');
    const [newEnrollmentCode, setNewEnrollmentCode] = useState<string>('');
    const [creatingCourse, setCreatingCourse] = useState(false);

    const refreshCourses = useCallback(async () => {
        try {
            const res = await authFetch('/api/instructor/courses', { method: 'GET' });
            if (!res.ok) return;
            const data = await res.json();
            const list = (data.courses || []) as Course[];
            setCourses(list);
            const def = String(data.defaultCourseId || list.find((c) => c.isDefault)?.id || '');
            setDefaultCourseId(def);
        } catch {
            // ignore
        }
    }, [authFetch]);

    const setDefaultCourse = useCallback(async (courseId: string) => {
        try {
            const res = await authFetch('/api/instructor/courses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId })
            });
            if (res.ok) {
                setNote({ type: 'success', msg: ru.settings.courseUpdated });
                await refreshCourses();
                // Refresh settings so the course header updates immediately.
                const sRes = await authFetch('/api/instructor/settings', { method: 'GET' });
                if (sRes.ok) {
                    const data = await sRes.json();
                    setS({
                        courseName: data.course_name || DEFAULTS.courseName,
                        enrollmentCode: data.enrollment_code || DEFAULTS.enrollmentCode,
                        attempts: data.attempts ?? DEFAULTS.attempts,
                        latePenalty: data.late_penalty ?? DEFAULTS.latePenalty,
                        passThreshold: data.pass_threshold ?? DEFAULTS.passThreshold,
                        gradingDefaults: data.grading_defaults || { ...DEFAULT_GRADING_OPTIONS },
                    });
                }
            } else {
                setNote({ type: 'error', msg: uiError('Failed to update default course.', ru.settings.courseUpdateFailed) });
            }
        } catch (e) {
            setNote({ type: 'error', msg: uiError(e, ru.settings.courseUpdateFailed) });
        }
    }, [authFetch, refreshCourses]);

    const createCourse = useCallback(async () => {
        const name = newCourseName.trim();
        if (!name) {
            setNote({ type: 'error', msg: ru.settings.courseNameRequired });
            return;
        }
        setCreatingCourse(true);
        try {
            const res = await authFetch('/api/instructor/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, enrollmentCode: newEnrollmentCode.trim(), makeDefault: true })
            });
            if (res.ok) {
                setNewCourseName('');
                setNewEnrollmentCode('');
                setNote({ type: 'success', msg: ru.settings.courseCreated });
                await refreshCourses();
            } else {
                const err = await res.json().catch(() => ({}));
                setNote({ type: 'error', msg: uiError(err.error, ru.settings.courseCreateFailed) });
            }
        } catch (e) {
            setNote({ type: 'error', msg: uiError(e, ru.settings.courseCreateFailed) });
        } finally {
            setCreatingCourse(false);
        }
    }, [authFetch, newCourseName, newEnrollmentCode, refreshCourses]);

    useEffect(() => {
        void refreshCourses();
    }, [refreshCourses]);

    // Save settings to backend
    const save = useCallback(async () => {
        try {
            setNote(null);
            const res = await authFetch('/api/instructor/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(s),
            });
            if (res.ok) {
                setNote({ type: 'success', msg: ru.settings.saved });
            } else {
                const err = await res.json().catch(() => ({}));
                setNote({ type: 'error', msg: uiError(err.error, ru.settings.saveFailed) });
            }
        } catch (e) {
            setNote({ type: 'error', msg: uiError(e, ru.settings.saveFailed) });
        }
    }, [s, authFetch]);
    // Reset settings to defaults and sync to backend
    const reset = useCallback(async () => {
        setS(DEFAULTS);
        try {
            const res = await authFetch('/api/instructor/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(DEFAULTS),
            });
            if (res.ok) {
                setNote({ type: 'info', msg: ru.settings.resetDone });
            } else {
                setNote({ type: 'error', msg: uiError('Failed to reset settings.', ru.settings.resetFailed) });
            }
        } catch (e) {
            setNote({ type: 'error', msg: uiError(e, ru.settings.resetFailed) });
        }
    }, [authFetch]);


    function downloadStudentsTemplate() {
        const headers = ['Org Defined ID', 'Attempt #', 'Q #', 'Answer', 'Out Of'];
        const csv = headers.join(',') + '\n' + 's12345,1,1,"SELECT * FROM Book;",10\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'students_template.csv'; a.click(); URL.revokeObjectURL(url);
    }
    function downloadRefsTemplate() {
        const csv = 'SELECT title FROM Book WHERE author = \'Pratchett\';\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'references_template.csv'; a.click(); URL.revokeObjectURL(url);
    }

    function purgeAll() {
        if (purging) return;
        setPurging(true);
        (async () => {
            try {
                const res = await authFetch('/api/instructor/purge', { method: 'DELETE' });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || 'Failed');
                }
                // Clear local storage and trigger full sign-out (app + NextAuth + IdP)
                try { localStorage.clear(); sessionStorage.clear(); } catch { }
                setNote({ type: 'success', msg: ru.settings.deleted });
                // Redirect to IdP logout endpoint which will clear local session then IdP SSO
                window.location.href = '/api/auth/idp-logout?redirect=/';
            } catch (e: any) {
                setNote({ type: 'error', msg: uiError(e, ru.settings.deleteFailed) });
            } finally {
                setPurging(false); setPurgeOpen(false);
            }
        })();
    }


    const headerActions = (
        <>
            <HeaderActions
                actions={[
                    { key: 'save-all', label: ru.settings.saveAll, ariaLabel: ru.settings.saveAllTip, icon: <SaveIcon fontSize='small' />, onClick: save },
                    { key: 'reset', label: ru.settings.reset, ariaLabel: ru.settings.resetTip, icon: <RestartAltIcon fontSize='small' />, onClick: reset },
                ]}
            />
            <HeaderOverflowMenu
                actions={[
                    {
                        key: 'delete-account',
                        label: ru.settings.deleteAccount,
                        icon: <DeleteForeverIcon color="error" fontSize="small" />,
                        onClick: () => setPurgeOpen(true),
                    },
                ]}
            />
        </>
    );

    return (
        <>
            {loadingSettings && (
                <Snackbar open anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                    <Alert severity="info">{ru.settings.loading}</Alert>
                </Snackbar>
            )}
            <PageCard headerTitle={ru.settings.title} headerProps={{ height: 56 }} headerActions={headerActions} headerActionsVariant='plain'>
                <Box sx={{ mb: 2 }}>
                    <Grid container spacing={2}>
                        {/* Account */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardHeader title={ru.settings.account} subheader={ru.settings.accountHelp} titleTypographyProps={{ sx: { whiteSpace: 'normal' } }} subheaderTypographyProps={{ sx: { whiteSpace: 'normal' } }} />
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                label={ru.settings.names}
                                                value={user?.name || accountName}
                                                fullWidth
                                                variant='outlined'
                                                size='small'
                                                inputProps={{ maxLength: 60 }}
                                                disabled
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField label={ru.settings.email} value={accountEmail || ''} fullWidth variant='outlined' size='small' InputProps={{ readOnly: true }} disabled />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Course Settings */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardHeader title={ru.settings.courseSettings} subheader={ru.settings.courseHelp} titleTypographyProps={{ sx: { whiteSpace: 'normal' } }} subheaderTypographyProps={{ sx: { whiteSpace: 'normal' } }} />
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid size={12}>
                                            <TextField
                                                label={ru.settings.courseName}
                                                value={s.courseName}
                                                onChange={(e) => setS({ ...s, courseName: e.target.value })}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                label={ru.settings.enrollment}
                                                value={s.enrollmentCode}
                                                onChange={(e) => setS({ ...s, enrollmentCode: e.target.value })}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <TextField
                                                label={ru.settings.attempts}
                                                sx={{ '& .MuiInputLabel-root': { whiteSpace: 'normal' } }}
                                                type="number"
                                                inputProps={{ min: 1, max: 20 }}
                                                value={s.attempts}
                                                onChange={(e) => setS({ ...s, attempts: Math.max(1, Math.min(20, Number(e.target.value || 1))) })}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <TextField
                                                label={ru.settings.pass}
                                                sx={{ '& .MuiInputLabel-root': { whiteSpace: 'normal' } }}
                                                type="number"
                                                inputProps={{ min: 0, max: 100 }}
                                                value={s.passThreshold}
                                                onChange={(e) => setS({ ...s, passThreshold: Math.max(0, Math.min(100, Number(e.target.value || 0))) })}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 6, md: 3 }}>
                                            <TextField
                                                label={ru.settings.late}
                                                sx={{ '& .MuiInputLabel-root': { whiteSpace: 'normal' } }}
                                                type="number"
                                                inputProps={{ min: 0, max: 50 }}
                                                value={s.latePenalty}
                                                onChange={(e) => setS({ ...s, latePenalty: Math.max(0, Math.min(50, Number(e.target.value || 0))) })}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                                    {nameDirty && (
                                        <Button startIcon={<SaveIcon />} color='secondary' variant='outlined' onClick={saveAccountName} disabled={!accountName.trim()} sx={{ whiteSpace: 'normal' }}>{ru.settings.saveName}</Button>
                                    )}
                                    <Button startIcon={<SaveIcon />} variant="contained" onClick={save} sx={{ whiteSpace: 'normal' }}>{ru.settings.saveCourse}</Button>
                                </CardActions>
                            </Card>
                        </Grid>

                        {/* Courses */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardHeader title={ru.settings.courses} subheader={ru.settings.coursesHelp} titleTypographyProps={{ sx: { whiteSpace: 'normal' } }} subheaderTypographyProps={{ sx: { whiteSpace: 'normal' } }} />
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid size={12}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="default-course-label" sx={{ whiteSpace: 'normal' }}>{ru.settings.defaultCourse}</InputLabel>
                                                <Select
                                                    labelId="default-course-label"
                                                    label={ru.settings.defaultCourse}
                                                    value={defaultCourseId || ''}
                                                    onChange={(e) => {
                                                        const next = String(e.target.value || '');
                                                        setDefaultCourseId(next);
                                                        if (next) void setDefaultCourse(next);
                                                    }}
                                                >
                                                    {courses.map((c) => (
                                                        <MenuItem key={c.id} value={c.id} sx={{ whiteSpace: 'normal' }}>{c.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid size={12}>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ whiteSpace: 'normal' }}>{ru.settings.addNew}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 7 }}>
                                            <TextField
                                                label={ru.settings.courseName}
                                                placeholder={ru.settings.coursePh}
                                                value={newCourseName}
                                                onChange={(e) => setNewCourseName(e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 5 }}>
                                            <TextField
                                                label={ru.settings.enrollment}
                                                placeholder={ru.settings.codePh}
                                                value={newEnrollmentCode}
                                                onChange={(e) => setNewEnrollmentCode(e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                    </Grid>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end' }}>
                                    <Button variant="contained" onClick={createCourse} disabled={creatingCourse || !newCourseName.trim()} sx={{ whiteSpace: 'normal' }}>
                                        {ru.settings.addCourse}
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>

                        {/* Grading Defaults */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardHeader title={ru.settings.grading} subheader={ru.settings.gradingHelp} titleTypographyProps={{ sx: { whiteSpace: 'normal' } }} subheaderTypographyProps={{ sx: { whiteSpace: 'normal' } }} />
                                <CardContent>
                                    <GradingOptions
                                        options={s.gradingDefaults}
                                        onChange={(key, value) => setS((prev) => ({ ...prev, gradingDefaults: { ...prev.gradingDefaults, [key]: value } }))}
                                    />
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end' }}>
                                    <Button startIcon={<SaveIcon />} variant="contained" onClick={save} sx={{ whiteSpace: 'normal' }}>{ru.settings.save}</Button>
                                </CardActions>
                            </Card>
                        </Grid>

                        {/* CSV Templates */}
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card>
                                <CardHeader title={ru.settings.templates} subheader={ru.settings.templatesHelp} titleTypographyProps={{ sx: { whiteSpace: 'normal' } }} subheaderTypographyProps={{ sx: { whiteSpace: 'normal' } }} />
                                <CardContent>
                                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadStudentsTemplate} sx={{ whiteSpace: 'normal' }}>
                                            {ru.settings.studentsTemplate}
                                        </Button>
                                        <Button startIcon={<DownloadIcon />} variant="outlined" onClick={downloadRefsTemplate} sx={{ whiteSpace: 'normal' }}>
                                            {ru.settings.refsTemplate}
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                    </Grid>
                </Box>
            </PageCard>

            <Snackbar
                open={!!note}
                autoHideDuration={3200}
                onClose={() => setNote(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {note ? <Alert onClose={() => setNote(null)} severity={note.type} sx={{ width: '100%' }}>{note.msg}</Alert> : undefined}
            </Snackbar>

            <Dialog open={purgeOpen} onClose={() => (!purging && setPurgeOpen(false))} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ whiteSpace: 'normal' }}>{ru.settings.deleteAll}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ whiteSpace: 'normal' }}>
                        {ru.settings.deleteHelp}
                    </DialogContentText>
                    <DialogContentText sx={{ mt: 2, fontWeight: 600, whiteSpace: 'normal' }}>
                        {ru.settings.typeDelete}
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder="DELETE"
                        onChange={(e) => setConfirmText(e.target.value)}
                        value={confirmText}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between' }}>
                    <Button onClick={() => setPurgeOpen(false)} disabled={purging}>{ru.settings.cancel}</Button>
                    <Button color="error" variant="contained" onClick={purgeAll} disabled={purging || confirmText !== 'DELETE'} sx={{ whiteSpace: 'normal' }}>
                        {purging ? ru.settings.deleting : ru.settings.deleteEverything}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
