"use client";
import React from 'react';
import { Box, Button, Collapse, Typography } from '@mui/material';
import SafeRichText from '@/components/SafeRichText';
import { m } from '@/i18n';

export default function PromptWithHint({
    prompt,
    hint,
    showHint,
    onToggle,
    promptKey,
    hintKeyPrefix,
}: {
    prompt: string;
    hint?: string | null;
    showHint: boolean;
    onToggle: () => void;
    promptKey?: string;
    hintKeyPrefix?: string;
}) {
    return (
        <Box>
            <SafeRichText
                key={promptKey}
                html={String(prompt || m.common.noPrompt)}
                sx={{ '& p': { my: .5 }, '& ul, & ol': { pl: 3, my: .5 } }}
            />
            {!!hint && (
                <Box sx={{ mt: 1 }}>
                    <Button size='small' variant='text' onClick={onToggle}>{showHint ? m.common.hideHint : m.common.showHint}</Button>
                    <Collapse in={showHint} unmountOnExit>
                        <Box sx={{ mt: .75, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: .5 }}>{m.common.hint}</Typography>
                            <SafeRichText
                                key={`${hintKeyPrefix}-${showHint ? 'open' : 'closed'}`}
                                html={String(hint || '')}
                                sx={{ '& p': { my: .5 }, '& ul, & ol': { pl: 3, my: .5 } }}
                            />
                        </Box>
                    </Collapse>
                </Box>
            )}
        </Box>
    );
}
