import { NextRequest, NextResponse } from 'next/server';
import { initSchema, query, withInstructorContext } from '@/lib/db';
import { parseAuthHeader, verifyJwt } from '@/lib/auth';

let initialized = false;
async function ensureInit() { if (!initialized) { await initSchema(); initialized = true; } }

export async function POST(req: NextRequest) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const payload = verifyJwt(token);
        if (!payload || payload.role !== 'instructor' || !payload.sub) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const sourceId = String(body?.assignmentId || '');
        const targetCourseId = String(body?.targetCourseId || '');
        if (!sourceId || !targetCourseId) return NextResponse.json({ error: 'assignmentId and targetCourseId required' }, { status: 400 });
        const created = await withInstructorContext(payload.sub, async () => {
            const { rows: courses } = await query<{ id: string }>(`SELECT id FROM courses WHERE id=$1 AND owner_id = current_setting('app.current_instructor')::uuid`, [targetCourseId]);
            if (!courses.length) throw new Error('target course not found');
            const { rows: source } = await query<Record<string, unknown>>(
                `SELECT title, difficulty, points, due, tags, attempts_allowed as "attemptsAllowed", draw_count as "drawCount"
                 FROM assignments WHERE id=$1 AND owner_id = current_setting('app.current_instructor')::uuid
                   AND course_id = current_setting('app.current_course', true)::uuid`, [sourceId]);
            if (!source.length) throw new Error('assignment not found');
            const src = source[0];
            const { rows: variants } = await query<{ id: string; label: string; title: string }>(
                `SELECT id, label, title FROM assignment_variants WHERE assignment_id=$1 AND course_id = current_setting('app.current_course', true)::uuid`, [sourceId]);
            const { rows: questions } = await query<Record<string, unknown>>(
                `SELECT aq.position, aq.points_override as "pointsOverride", aq.variant_id as "variantId",
                        q.title, q.difficulty, q.status, q.max_points as "maxPoints", q.dataset, q.prompt,
                        q.model_sql as "modelSql", q.hints, q.model_queries as "modelQueries", q.init_sql as "initSql",
                        q.use_default_grading as "useDefaultGrading", q.grading_options as "gradingOptions"
                 FROM assignment_questions aq JOIN questions q ON q.id = aq.question_id
                 WHERE aq.assignment_id=$1 AND aq.course_id = current_setting('app.current_course', true)::uuid
                 ORDER BY aq.position`, [sourceId]);
            await query(`SELECT set_config('app.current_course', $1, true)`, [targetCourseId]);
            const { rows: inserted } = await query<{ id: string }>(
                `INSERT INTO assignments (title, difficulty, points, due, tags, attempts_allowed, published, draw_count, owner_id)
                 VALUES ($1,$2,$3,$4,$5,$6,false,$7, current_setting('app.current_instructor')::uuid) RETURNING id`,
                [src.title, src.difficulty, src.points, src.due, src.tags, src.attemptsAllowed, src.drawCount]);
            const newId = inserted[0].id;
            const variantMap = new Map<string, string>();
            for (const variant of variants) {
                const { rows: made } = await query<{ id: string }>(
                    `INSERT INTO assignment_variants (assignment_id, label, title, owner_id)
                     VALUES ($1,$2,$3, current_setting('app.current_instructor')::uuid) RETURNING id`,
                    [newId, variant.label, variant.title]);
                variantMap.set(variant.id, made[0].id);
            }
            for (const link of questions) {
                const { rows: copied } = await query<{ id: string }>(
                    `INSERT INTO questions (title, difficulty, status, max_points, dataset, prompt, model_sql, hints, model_queries, init_sql, use_default_grading, grading_options, owner_id)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, current_setting('app.current_instructor')::uuid) RETURNING id`,
                    [link.title, link.difficulty, link.status, link.maxPoints, link.dataset, link.prompt, link.modelSql, link.hints, link.modelQueries || [], link.initSql || '', link.useDefaultGrading !== false, link.gradingOptions ? JSON.stringify(link.gradingOptions) : null]);
                await query(
                    `INSERT INTO assignment_questions (assignment_id, question_id, position, points_override, variant_id, owner_id)
                     VALUES ($1,$2,$3,$4,$5, current_setting('app.current_instructor')::uuid)`,
                    [newId, copied[0].id, link.position, link.pointsOverride, link.variantId ? variantMap.get(String(link.variantId)) ?? null : null]);
            }
            return { id: newId, courseId: targetCourseId };
        });
        return NextResponse.json(created);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'failed';
        return NextResponse.json({ error: message }, { status: message.includes('not found') ? 404 : 500 });
    }
}
