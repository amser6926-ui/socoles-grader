'use client';
import React, { useEffect, useState } from 'react';
import PageCard from '@/components/PageCard';
import { Typography, Box, Button } from '@mui/material';
import HeaderActions from '@/components/HeaderActions';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchDashboardMetrics } from './dashboard/metricsApi';
import { DashboardMetrics, emptyMetrics } from './dashboard/types';
import { MetricsRow } from './dashboard/MetricsRow';
import { QuestionDifficultyCard } from './dashboard/QuestionDifficultyCard';
import { AtRiskQuestionsCard } from './dashboard/AtRiskQuestionsCard';
import { RecentActivityCard } from './dashboard/RecentActivityCard';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import WarningIcon from '@mui/icons-material/WarningAmber';
import GroupIcon from '@mui/icons-material/Group';
import { useRosterMap } from '@/lib/useRosterMap';
import { formatNumber, formatPercent, m } from '@/i18n';

export default function InstructorDashboard() {
    const { authFetch } = useAuth();
    const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
    const [loading, setLoading] = useState(true);
    const rosterMap = useRosterMap();
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try { const m = await fetchDashboardMetrics(authFetch); if (!cancelled) setMetrics(m); } finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, [authFetch]);

    const hero = [
        { label: m.dashboard.pendingReviews, value: metrics.pendingReviews, icon: <WarningIcon fontSize='small' />, color: 'warning' },
        { label: m.dashboard.avgGrade, value: loading ? '—' : formatNumber(metrics.avgGrade, 1), icon: <DescriptionIcon fontSize='small' />, color: 'info' },
        { label: m.dashboard.passRate, value: loading ? '—' : formatPercent(metrics.passRate, 0), icon: <TaskAltIcon fontSize='small' />, color: 'success' },
        { label: m.dashboard.avgAttempts, value: loading ? '—' : formatNumber(metrics.avgAttempts, 1), icon: <GroupIcon fontSize='small' />, color: 'secondary' },
    ];

    // Button style extracted into HeaderActionButton component
    const headerActions = (
        <HeaderActions
            actions={[
                {
                    key: 'assignments',
                    label: m.dashboard.assignments,
                    ariaLabel: m.dashboard.assignments,
                    onClick: () => window.dispatchEvent(new CustomEvent('appshell:navigate', { detail: { id: 'i-assignments' } })),
                },
                {
                    key: 'questions',
                    label: m.dashboard.questions,
                    ariaLabel: m.dashboard.questions,
                    onClick: () => window.dispatchEvent(new CustomEvent('appshell:navigate', { detail: { id: 'i-questions' } })),
                },
                {
                    key: 'roster',
                    label: m.dashboard.roster,
                    ariaLabel: m.dashboard.roster,
                    onClick: () => window.dispatchEvent(new CustomEvent('appshell:navigate', { detail: { id: 'i-class' } })),
                },
                {
                    key: 'reviews',
                    label: m.dashboard.reviews,
                    ariaLabel: m.dashboard.reviewRequests,
                    onClick: () => window.dispatchEvent(new CustomEvent('appshell:navigate', { detail: { id: 'i-reviews' } })),
                },
            ]}
        />
    );
    return (
        <PageCard headerTitle={m.dashboard.title} headerProps={{ height: 56 }} headerActions={headerActions} headerActionsVariant='plain'>
            <MetricsRow metrics={hero} />
            <Box sx={{ display: 'grid', gap: 2, mt: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <QuestionDifficultyCard data={metrics.questionDifficulty.slice(0, 20)} />
                <AtRiskQuestionsCard data={metrics.atRisk} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, mt: 2, gridTemplateColumns: { xs: '1fr' } }}>
                <RecentActivityCard data={metrics.recent.slice(0, 3).map(r => ({ ...r, student: rosterMap[r.student] || r.student }))} />
            </Box>
        </PageCard>
    );
}
