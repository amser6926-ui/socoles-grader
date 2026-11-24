"use client";
import React from 'react';
import { Typography } from '@mui/material';
import { m, formatNumber } from '@/i18n';

export default function GradeDisplay({ grade, denom, loadingLabel }: { grade: number | null | undefined; denom: number | string | null | undefined; loadingLabel?: string }) {
    const has = typeof grade === 'number' && isFinite(grade);
    return (
        <>
            <Typography variant='body2' color='text.secondary'>{m.common.grade}</Typography>
            <Typography variant='h4' sx={{ lineHeight: 1 }}>
                {has ? formatNumber(grade as number, 2) : '—'}
                {denom != null && (
                    <Typography component='span' variant='body2' color='text.secondary'> / {denom}</Typography>
                )}
            </Typography>
        </>
    );
}
