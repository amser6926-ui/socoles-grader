'use client';
import Grid from '@mui/material/Grid';
import { Card, CardHeader, CardContent, Typography, TextField, Alert, LinearProgress, Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { m } from '@/i18n';

export default function StudentProfile() {
    const { user, authFetch } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        // Prefer student session data if available
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('sqlgrader.student') : null;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.name) setFullName(parsed.name);
                if (parsed?.email) setEmail(parsed.email);
            } else {
                setFullName(user?.name || '');
                setEmail(user?.name || '');
            }
        } catch {
            setFullName(user?.name || '');
            setEmail(user?.name || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Grid container spacing={2}>
                <Grid size={12}>
                    <Card>
                        <CardHeader title={m.profile.title} subheader={m.profile.sub} />
                        {busy && <LinearProgress />}
                        <CardContent>
                            {note && <Alert severity="success" sx={{ mb: 2 }}>{note}</Alert>}
                            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField label={m.profile.fullName} size="small" value={fullName} disabled variant="outlined" fullWidth />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField label={m.profile.email} size="small" value={email} disabled variant="outlined" fullWidth />
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

            </Grid>
        </Box>
    );
}
