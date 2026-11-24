import React from 'react';
import { Card, CardHeader, CardContent, Typography, Table, TableHead, TableRow, TableCell, TableBody, Tooltip } from '@mui/material';
import { formatNumber, m } from '@/i18n';

export const AtRiskQuestionsCard: React.FC<{ data: Array<{ id: string; title: string; assignmentId?: string; assignmentTitle?: string; attempts: number; best: number }> }> = ({ data }) => {
    // Group by assignmentId for numbering within assignment
    const numbering: Record<string, number> = {};
    return (
        <Card>
            <CardHeader title={<Typography variant='subtitle1'>{m.dashboard.atRisk}</Typography>} subheader={<Typography variant='caption'>{m.dashboard.atRiskHelp}</Typography>} />
            <CardContent>
                {data.length ? (
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>{m.dashboard.assignment}</TableCell>
                                <TableCell>{m.dashboard.qnum}</TableCell>
                                <TableCell>{m.dashboard.attempts}</TableCell>
                                <TableCell>{m.dashboard.best}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((q) => {
                                const aid = q.assignmentTitle || q.assignmentId || '—';
                                numbering[aid] = (numbering[aid] || 0) + 1;
                                const qNum = numbering[aid];
                                return (
                                    <TableRow key={q.id}>
                                        <TableCell sx={{ maxWidth: 220, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{aid}</TableCell>
                                        <TableCell>
                                            <Tooltip title={q.title} placement='right'>
                                                <span>{qNum}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{q.attempts}</TableCell>
                                        <TableCell>{formatNumber(q.best, 2)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : <Typography variant='caption' color='text.secondary'>{m.dashboard.none}</Typography>}
            </CardContent>
        </Card>
    );
};
