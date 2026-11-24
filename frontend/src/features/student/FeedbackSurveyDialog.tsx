import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Slider, TextField, Box, Stack } from '@mui/material';
import { useState, useEffect } from 'react';
import { formatNumber, m } from '@/i18n';

interface Props {
    open: boolean;
    assignmentId: string | null;
    assignmentTitle?: string | null;
    onClose: () => void;
    authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function FeedbackSurveyDialog({ open, assignmentId, assignmentTitle, onClose, authFetch }: Props) {
    const [helpedFix, setHelpedFix] = useState<number | null>(null);
    const [improvedUnderstanding, setImprovedUnderstanding] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [improvement, setImprovement] = useState<number | null>(null);
    const [firstScore, setFirstScore] = useState<number | null>(null);
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const disabled = submitting || !assignmentId;

    useEffect(() => {
        if (!open || !assignmentId) return;
        (async () => {
            try {
                const res = await authFetch(`/api/feedback?assignmentId=${encodeURIComponent(assignmentId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        if ((data as any).notEligible) { onClose(); return; }
                        setHelpedFix(data.helpedFix || null);
                        setImprovedUnderstanding(data.improvedUnderstanding || null);
                        setComment(data.comment || '');
                        setImprovement(data.improvement ?? null);
                        setFirstScore(data.firstScore ?? null);
                        setFinalScore(data.finalScore ?? null);
                    } else {
                        setHelpedFix(null); setImprovedUnderstanding(null); setComment(''); setImprovement(null); setFirstScore(null); setFinalScore(null);
                    }
                }
            } catch {/* ignore */ }
        })();
    }, [open, assignmentId, authFetch]);

    async function handleSubmit() {
        if (!assignmentId || helpedFix == null || improvedUnderstanding == null) return;
        setSubmitting(true);
        try {
            const res = await authFetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId, helpedFix, improvedUnderstanding, comment })
            });
            if (res.ok) {
                onClose();
            }
        } finally {
            setSubmitting(false);
        }
    }

    function sliderMarks() { return [1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) })); }

    return (
        <Dialog open={open} onClose={() => { }} fullWidth maxWidth="sm">
            <DialogTitle>{m.survey.title} {assignmentTitle ? <Typography component="span" variant="subtitle2" sx={{ ml: 1, fontWeight: 400, color: 'text.secondary' }}>• {assignmentTitle}</Typography> : null}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
                <Typography variant="body2" color="text.secondary">{m.survey.required}</Typography>
                {improvement != null && (
                    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}>{m.survey.yourImprovement}</Typography>
                        {(() => {
                            const a = typeof firstScore === 'number' ? firstScore : null;
                            const b = typeof finalScore === 'number' ? finalScore : null;
                            const isPercentScale = Math.max(a ?? 0, b ?? 0) <= 1;
                            const fmt = (v: number | null) => v == null ? '—' : (isPercentScale ? `${formatNumber(v * 100, 1)}%` : `${formatNumber(v, 2)}/10`);
                            const delta = (a != null && b != null) ? (b - a) : null;
                            const deltaText = delta == null ? '—' : (isPercentScale ? `${formatNumber(delta * 100, 1)} п.п.` : `${formatNumber(delta, 2)}`);
                            const deltaColor = !delta ? 'text.secondary' : (delta > 0 ? 'success.main' : (delta < 0 ? 'error.main' : 'text.secondary'));
                            return (
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
                                    <Box sx={{ p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">{m.survey.first}</Typography>
                                        <Typography variant="subtitle2">{fmt(a)}</Typography>
                                    </Box>
                                    <Box sx={{ p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">{m.survey.final}</Typography>
                                        <Typography variant="subtitle2">{fmt(b)}</Typography>
                                    </Box>
                                    <Box sx={{ p: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">{m.survey.change}</Typography>
                                        <Typography variant="subtitle2" sx={{ color: deltaColor }}>{deltaText}</Typography>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </Box>
                )}
                <Box>
                    <Typography variant="subtitle2" gutterBottom>{m.survey.helped}</Typography>
                    <Slider value={helpedFix ?? 0} min={1} max={5} step={1} marks={sliderMarks()} onChange={(_, v) => setHelpedFix(v as number)} />
                </Box>
                <Box>
                    <Typography variant="subtitle2" gutterBottom>{m.survey.understood}</Typography>
                    <Slider value={improvedUnderstanding ?? 0} min={1} max={5} step={1} marks={sliderMarks()} onChange={(_, v) => setImprovedUnderstanding(v as number)} />
                </Box>
                <TextField label={m.survey.comments} value={comment} onChange={e => setComment(e.target.value)} multiline minRows={2} />
            </DialogContent>
            <DialogActions>
                <Button disabled={disabled || helpedFix == null || improvedUnderstanding == null} variant="contained" onClick={handleSubmit}>{m.survey.submit}</Button>
            </DialogActions>
        </Dialog>
    );
}
