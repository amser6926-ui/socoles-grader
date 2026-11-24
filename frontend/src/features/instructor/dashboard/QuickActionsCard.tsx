import React from 'react';
import { Card, CardHeader, CardContent, Button, Stack, Typography } from '@mui/material';
import { m } from '@/i18n';

export const QuickActionsCard: React.FC = () => {
    const nav = (id: string) => window.dispatchEvent(new CustomEvent('appshell:navigate', { detail: { id } }));
    return (
        <Card>
            <CardHeader title={<Typography variant='subtitle1'>{m.dashboard.quick}</Typography>} />
            <CardContent>
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                    <Button size='small' variant='contained' onClick={() => nav('i-assignments')}>{m.dashboard.newAssignment}</Button>
                    <Button size='small' variant='outlined' onClick={() => nav('i-questions')}>{m.dashboard.addQuestion}</Button>
                    <Button size='small' variant='outlined' onClick={() => nav('i-class')}>{m.dashboard.importRoster}</Button>
                </Stack>
            </CardContent>
        </Card>
    );
};
