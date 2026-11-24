import React from 'react';
import { Card, CardHeader, CardContent, Typography } from '@mui/material';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { m } from '@/i18n';

export const QuestionDifficultyCard: React.FC<{ data: Array<{ id: string; title: string; attempts: number; best: number }> }> = ({ data }) => {
    const scatter = data.map(d => ({ x: d.attempts, y: d.best }));
    return (
        <Card>
            <CardHeader title={<Typography variant='subtitle1'>{m.dashboard.difficulty}</Typography>} subheader={<Typography variant='caption'>{m.dashboard.difficultyHelp}</Typography>} />
            <CardContent>
                {scatter.length ? (
                    <ScatterChart height={220} series={[{ data: scatter }]} xAxis={[{ label: m.dashboard.attemptsAxis }]} yAxis={[{ label: m.dashboard.bestAxis }]} />
                ) : <Typography variant='caption' color='text.secondary'>{m.dashboard.noData}</Typography>}
            </CardContent>
        </Card>
    );
};
