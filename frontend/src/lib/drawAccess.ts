import { randomInt } from 'node:crypto';
import { query } from '@/lib/db';
import { drawDistinct, resolveDraw, type StoredDraw } from '@/lib/variantDraw';

export type DrawRow = StoredDraw & { id: string };

export async function readDraw(assignmentId: string, student: string): Promise<DrawRow | null> {
    const { rows } = await query<{ id: string; variantId: string; questionIds: string[] }>(
        `SELECT id, variant_id as "variantId", question_ids as "questionIds"
         FROM assignment_draws
         WHERE assignment_id = $1 AND student = $2
           AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid
         LIMIT 1`,
        [assignmentId, student]
    );
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, variantId: row.variantId, questionIds: row.questionIds || [] };
}

export async function ensureDraw(assignmentId: string, student: string, variantId: string): Promise<DrawRow> {
    const existing = await readDraw(assignmentId, student);
    if (existing) {
        const kept = resolveDraw(existing, { variantId, questionIds: existing.questionIds });
        return { id: existing.id, ...kept.draw };
    }
    const { rows: meta } = await query<{ drawCount: number | null }>(
        `SELECT draw_count as "drawCount" FROM assignments
         WHERE id = $1 AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid`,
        [assignmentId]
    );
    const drawCount = meta[0]?.drawCount ?? null;
    if (drawCount == null) throw new Error('assignment does not use variants');
    const { rows: variantRows } = await query<{ id: string }>(
        `SELECT id FROM assignment_variants
         WHERE id = $1 AND assignment_id = $2
           AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid`,
        [variantId, assignmentId]
    );
    if (!variantRows.length) throw new Error('invalid variant');
    const { rows: questions } = await query<{ questionId: string }>(
        `SELECT question_id as "questionId" FROM assignment_questions
         WHERE assignment_id = $1 AND variant_id = $2
           AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid
         ORDER BY position ASC, question_id ASC`,
        [assignmentId, variantId]
    );
    const picked = drawDistinct(questions.map((q) => q.questionId), drawCount, (span) => randomInt(span));
    const decided = resolveDraw(null, { variantId, questionIds: picked });
    const inserted = await query<{ id: string; variantId: string; questionIds: string[] }>(
        `INSERT INTO assignment_draws (assignment_id, student, variant_id, question_ids, owner_id)
         VALUES ($1, $2, $3, $4::uuid[], current_setting('app.current_instructor')::uuid)
         ON CONFLICT (assignment_id, student, owner_id) DO NOTHING
         RETURNING id, variant_id as "variantId", question_ids as "questionIds"`,
        [assignmentId, student, decided.draw.variantId, decided.draw.questionIds]
    );
    if (inserted.rows[0]) {
        return { id: inserted.rows[0].id, variantId: inserted.rows[0].variantId, questionIds: inserted.rows[0].questionIds };
    }
    const winner = await readDraw(assignmentId, student);
    if (!winner) throw new Error('draw was not stored');
    return winner;
}

export async function studentMayUseQuestion(studentEmail: string, questionId: string): Promise<boolean> {
    const { rows } = await query(
        `SELECT 1
         WHERE EXISTS (
            SELECT 1 FROM assignment_questions aq
            JOIN assignments a ON a.id = aq.assignment_id
            WHERE aq.question_id = $1 AND a.draw_count IS NULL
              AND a.owner_id = current_setting('app.current_instructor')::uuid
              AND a.course_id = current_setting('app.current_course', true)::uuid
         ) OR EXISTS (
            SELECT 1 FROM assignment_draws d
            WHERE d.student = $2 AND $1 = ANY(d.question_ids)
              AND d.owner_id = current_setting('app.current_instructor')::uuid
              AND d.course_id = current_setting('app.current_course', true)::uuid
         )`,
        [questionId, studentEmail]
    );
    return rows.length > 0;
}

/** null means the assignment is not a draw (grade every linked question). */
export async function questionIdsForGrading(assignmentId: string, student: string): Promise<string[] | null> {
    const draw = await readDraw(assignmentId, student);
    if (draw) return draw.questionIds;
    const { rows: meta } = await query<{ drawCount: number | null }>(
        `SELECT draw_count as "drawCount" FROM assignments WHERE id = $1
           AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid`,
        [assignmentId]
    );
    if (meta[0]?.drawCount == null) return null;
    const { rows } = await query<{ questionId: string }>(
        `SELECT DISTINCT question_id as "questionId" FROM question_submissions
         WHERE assignment_id = $1 AND student = $2
           AND owner_id = current_setting('app.current_instructor')::uuid
           AND course_id = current_setting('app.current_course', true)::uuid`,
        [assignmentId, student]
    );
    return rows.map((r) => r.questionId);
}
