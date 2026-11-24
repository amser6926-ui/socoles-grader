'use client';
import { ChangeEvent } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, TextField, SelectChangeEvent, Typography, Stack } from '@mui/material';
import type { GradingOptions } from '@/lib/types';
import { m, protocolLabel } from '@/i18n';

export default function GradingOptions({ options, onChange, questionNumbers, selectedQuestionNumber, onChangeQuestionNumber, showHeader = true }: { options: GradingOptions; onChange: (key: keyof GradingOptions, value: any) => void; questionNumbers?: string[]; selectedQuestionNumber?: string; onChangeQuestionNumber?: (value: string) => void; showHeader?: boolean; }) {
    const handleSelect = (key: keyof GradingOptions) => (e: SelectChangeEvent<string>) => onChange(key, e.target.value);
    const handleText = (key: keyof GradingOptions) => (e: ChangeEvent<HTMLInputElement>) => onChange(key, e.target.value);

    return (
        <Box sx={{ mt: 2 }}>
            {showHeader && (
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{m.grading.title}</Typography>
            )}
            <Stack spacing={2}>
                {/* Question Number Selector */}
                {!!(questionNumbers && questionNumbers.length) && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <FormControl sx={{ flex: 1, minWidth: 280 }} size="small">
                            <InputLabel id="question-number-label">{m.grading.questionNumber}</InputLabel>
                            <Select
                                labelId="question-number-label"
                                id="question-number"
                                value={selectedQuestionNumber || ''}
                                label={m.grading.questionNumber}
                                onChange={(e) => onChangeQuestionNumber && onChangeQuestionNumber(e.target.value)}
                            >
                                <MenuItem value="">{m.common.select}</MenuItem>
                                {questionNumbers.map((q) => (
                                    <MenuItem key={q} value={q}>{q}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ flex: 1, minWidth: 280 }} size="small">
                        <InputLabel id="syntax-sensitivity-label">{m.grading.syntax}</InputLabel>
                        <Select labelId="syntax-sensitivity-label" id="syntax-sensitivity" value={options.syntaxSensitivity} label={m.grading.syntax} onChange={handleSelect('syntaxSensitivity')}>
                            <MenuItem value="">{m.common.select}</MenuItem>
                            <MenuItem value="0 Absent">{protocolLabel('0 Absent')}</MenuItem>
                            <MenuItem value="2 Levels">{protocolLabel('2 Levels')}</MenuItem>
                            <MenuItem value="3 Levels">{protocolLabel('3 Levels')}</MenuItem>
                            <MenuItem value="8 Levels">{protocolLabel('8 Levels')}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ flex: 1, minWidth: 280 }} size="small">
                        <InputLabel id="semantics-sensitivity-label">{m.grading.semantics}</InputLabel>
                        <Select labelId="semantics-sensitivity-label" id="semantics-sensitivity" value={options.semanticsSensitivity} label={m.grading.semantics} onChange={handleSelect('semanticsSensitivity')}>
                            <MenuItem value="">{m.common.select}</MenuItem>
                            <MenuItem value="0 Absent">{protocolLabel('0 Absent')}</MenuItem>
                            <MenuItem value="2 Levels">{protocolLabel('2 Levels')}</MenuItem>
                            <MenuItem value="3 Levels">{protocolLabel('3 Levels')}</MenuItem>
                            <MenuItem value="8 Levels">{protocolLabel('8 Levels')}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ flex: 1, minWidth: 280 }} size="small">
                        <InputLabel id="results-sensitivity-label">{m.grading.results}</InputLabel>
                        <Select labelId="results-sensitivity-label" id="results-sensitivity" value={options.resultsSensitivity} label={m.grading.results} onChange={handleSelect('resultsSensitivity')}>
                            <MenuItem value="">{m.common.select}</MenuItem>
                            <MenuItem value="0 Absent">{protocolLabel('0 Absent')}</MenuItem>
                            <MenuItem value="2 Levels">{protocolLabel('2 Levels')}</MenuItem>
                            <MenuItem value="3 Levels">{protocolLabel('3 Levels')}</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ flex: 1, minWidth: 280 }} size="small">
                        <InputLabel id="evaluation-priority-label">{m.grading.priority}</InputLabel>
                        <Select labelId="evaluation-priority-label" id="evaluation-priority" value={options.evaluationPriority} label={m.grading.priority} onChange={handleSelect('evaluationPriority')}>
                            <MenuItem value="">{m.common.select}</MenuItem>
                            <MenuItem value="1 - Syntax, Semantics, Results">{protocolLabel('1 - Syntax, Semantics, Results')}</MenuItem>
                            <MenuItem value="2 - Semantics, Syntax, Results">{protocolLabel('2 - Semantics, Syntax, Results')}</MenuItem>
                            <MenuItem value="3 - Results, Semantics, Syntax">{protocolLabel('3 - Results, Semantics, Syntax')}</MenuItem>
                            <MenuItem value="4 - Syntax, Results, Semantics">{protocolLabel('4 - Syntax, Results, Semantics')}</MenuItem>
                            <MenuItem value="5 - Semantics, Results, Syntax">{protocolLabel('5 - Semantics, Results, Syntax')}</MenuItem>
                            <MenuItem value="6 - Results, Syntax, Semantics">{protocolLabel('6 - Results, Syntax, Semantics')}</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField label={m.grading.textDistance} type="number" inputProps={{ min: 0 }} sx={{ flex: 1, minWidth: 280 }} value={options.textEditDistance} onChange={handleText('textEditDistance')} variant="outlined" size="small" />
                    <TextField label={m.grading.treeDistance} type="number" inputProps={{ min: 0 }} sx={{ flex: 1, minWidth: 280 }} value={options.treeEditDistance} onChange={handleText('treeEditDistance')} variant="outlined" size="small" />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel control={<Switch checked={options.checkOrder} onChange={(_, v) => onChange('checkOrder', v)} color="primary" />} label={m.grading.checkOrder} />
                    <FormControlLabel control={<Switch checked={options.use_postgresql} onChange={(_, v) => onChange('use_postgresql', v)} color="primary" />} label={m.grading.usePg} />
                    <FormControlLabel control={<Switch checked={options.autoDB} onChange={(_, v) => onChange('autoDB', v)} color="primary" />} label={m.grading.autoDb} />
                </Box>

                {options.autoDB && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField label={m.grading.dbName} sx={{ flex: 1, minWidth: 280 }} value={options.dbName} onChange={handleText('dbName')} variant="outlined" size="small" />
                        <TextField label={m.grading.dbCount} type="number" inputProps={{ min: 1 }} sx={{ flex: 1, minWidth: 280 }} value={options.numberOfDBs} onChange={handleText('numberOfDBs')} variant="outlined" size="small" />
                    </Box>
                )}
            </Stack>
        </Box>
    );
}
