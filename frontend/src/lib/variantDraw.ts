/** Pure rules for one unstratified draw of N questions. Persistence is in the API. */

export type StoredDraw = {
    variantId: string;
    questionIds: string[];
};

export function drawDistinct(ids: readonly string[], count: number, randomBelow: (exclusiveUpper: number) => number): string[] {
    if (!Number.isInteger(count) || count < 1) throw new Error('invalid draw count');
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new Error('duplicate questions in variant');
    if (unique.length < count) throw new Error('variant has fewer questions than draw count');
    const pool = [...unique];
    for (let i = 0; i < count; i++) {
        const span = pool.length - i;
        const offset = randomBelow(span);
        if (!Number.isInteger(offset) || offset < 0 || offset >= span) throw new Error('random source out of range');
        const j = i + offset;
        const swap = pool[i];
        pool[i] = pool[j];
        pool[j] = swap;
    }
    return pool.slice(0, count);
}

/** A later request never replaces the stored variant or its question ids. */
export function resolveDraw(existing: StoredDraw | null, requested: StoredDraw): { draw: StoredDraw; created: boolean } {
    if (existing) return { draw: existing, created: false };
    if (new Set(requested.questionIds).size !== requested.questionIds.length) throw new Error('draw contains duplicates');
    return { draw: { variantId: requested.variantId, questionIds: [...requested.questionIds] }, created: true };
}

export function selectedPoints(questions: readonly { id: string; points: number }[], selectedIds: readonly string[]): number {
    const allowed = new Set(selectedIds);
    return questions.filter((q) => allowed.has(q.id)).reduce((sum, q) => sum + q.points, 0);
}
