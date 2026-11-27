import { NextResponse } from 'next/server';
import { initSchema, withCourseContext, withInstructorContext, query } from '@/lib/db';
import { parseAuthHeader, verifyJwt } from '@/lib/auth';
import type { Assignment, AssignmentPatch, NewAssignmentPayload } from '@/lib/types';

let initialized = false;
async function ensureInit() { if (!initialized) { await initSchema(); initialized = true; } }

export async function GET(req: Request) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const payload = verifyJwt(token);
        if (!payload) return NextResponse.json({ error: 'invalid token' }, { status: 401 });
        const includeQuestions = new URL(req.url).searchParams.get('include') === 'questions';
        const instructorId = payload.role === 'student' ? (payload.instructorId as string) : payload.sub;
        const courseId = payload.role === 'student' ? (payload.courseId as string | undefined) : undefined;
        const withContext = <T>(fn: () => Promise<T>) => courseId
            ? withCourseContext(instructorId, courseId, fn)
            : withInstructorContext(instructorId, fn);
        let rosterActive = true;
        if (payload.role === 'student') {
            // Validate that roster row still exists and is Active; deny access otherwise
            // NOTE: For student tokens we encode the roster id in `sub` (see signStudentJwt).
            const rosterId = payload.sub; // roster id
            if (!rosterId) return NextResponse.json({ error: 'invalid student token' }, { status: 401 });
            const { rows: rosterRows } = await withContext(() => query<{ status: string }>(`SELECT status FROM roster WHERE id=$1 AND owner_id = current_setting('app.current_instructor')::uuid LIMIT 1`, [rosterId]));
            if (!rosterRows.length || rosterRows[0].status !== 'Active') {
                rosterActive = false;
            }
        }
        if (!rosterActive) return NextResponse.json({ error: 'access revoked' }, { status: 403 });
        const baseSql = `SELECT a.id, a.title, c.name as course, a.difficulty, a.points, a.due, a.tags, a.attempts_allowed as "attemptsAllowed", a.published, a.draw_count as "drawCount"
                        FROM assignments a
                        JOIN courses c ON c.id = a.course_id
                        WHERE a.owner_id = current_setting('app.current_instructor')::uuid
                            AND a.course_id = current_setting('app.current_course', true)::uuid`;
        const sql = payload.role === 'student'
            ? `${baseSql} AND a.published = true ORDER BY a.created_at DESC LIMIT 500`
            : `${baseSql} ORDER BY a.created_at DESC LIMIT 500`;
        const { rows: assignments } = await withContext(() =>
            query<Assignment>(sql)
        );
        if (!includeQuestions) return NextResponse.json(assignments);

        // fetch question links for these assignments
        const ids = assignments.map(a => a.id);
        if (!ids.length) return NextResponse.json([]);
        interface LinkRow { assignmentId: string; questionId: string; position: number; pointsOverride: number | null; title: string; difficulty: string; status: string; attempts: number; maxPoints: number; variantId: string | null }
        const { rows: links } = await withContext(() => query<LinkRow>(`SELECT aq.assignment_id as "assignmentId", aq.question_id as "questionId", aq.position, aq.points_override as "pointsOverride", aq.variant_id as "variantId",
            q.title, q.difficulty, q.status, q.attempts, q.max_points as "maxPoints"
            FROM assignment_questions aq JOIN questions q ON q.id = aq.question_id
                        WHERE aq.assignment_id = ANY($1)
                            AND aq.owner_id = current_setting('app.current_instructor')::uuid
                            AND aq.course_id = current_setting('app.current_course', true)::uuid
                            AND q.course_id = current_setting('app.current_course', true)::uuid
            ORDER BY aq.position ASC, q.created_at DESC`, [ids]));
        const byAssign: Record<string, LinkRow[]> = {};
        for (const l of links) { (byAssign[l.assignmentId] ||= []).push(l); }
        const { rows: variantRows } = await withContext(() => query<{ assignmentId: string; id: string; label: string; title: string }>(
            `SELECT assignment_id as "assignmentId", id, label, title FROM assignment_variants
             WHERE assignment_id = ANY($1) AND owner_id = current_setting('app.current_instructor')::uuid
               AND course_id = current_setting('app.current_course', true)::uuid ORDER BY label`, [ids]));
        const variantsBy: Record<string, { id: string; label: string; title: string }[]> = {};
        for (const v of variantRows) (variantsBy[v.assignmentId] ||= []).push({ id: v.id, label: v.label, title: v.title });
        const studentEmail = payload.role === 'student' ? String(payload.email || '') : '';
        const { rows: drawRows } = studentEmail ? await withContext(() => query<{ assignmentId: string; variantId: string; questionIds: string[] }>(
            `SELECT assignment_id as "assignmentId", variant_id as "variantId", question_ids as "questionIds"
             FROM assignment_draws WHERE assignment_id = ANY($1) AND student = $2
               AND owner_id = current_setting('app.current_instructor')::uuid
               AND course_id = current_setting('app.current_course', true)::uuid`, [ids, studentEmail])) : { rows: [] as { assignmentId: string; variantId: string; questionIds: string[] }[] };
        const drawBy = new Map(drawRows.map((d) => [d.assignmentId, d]));
        const { rows: startedRows } = studentEmail ? await withContext(() => query<{ assignmentId: string }>(
            `SELECT DISTINCT assignment_id as "assignmentId" FROM submissions
             WHERE assignment_id = ANY($1) AND student = $2
               AND owner_id = current_setting('app.current_instructor')::uuid
               AND course_id = current_setting('app.current_course', true)::uuid`, [ids, studentEmail])) : { rows: [] as { assignmentId: string }[] };
        const started = new Set(startedRows.map((r) => r.assignmentId));
        const enriched = assignments.map((a) => {
            const all = byAssign[a.id] || [];
            const drawCount = (a as Assignment & { drawCount?: number | null }).drawCount ?? null;
            const asQuestion = (q: LinkRow, position: number) => ({
                id: q.questionId, title: q.title, difficulty: q.difficulty, status: q.status, attempts: q.attempts,
                maxPoints: q.maxPoints, position, pointsOverride: q.pointsOverride, variantId: q.variantId,
            });
            if (payload.role !== 'student' || drawCount == null) {
                return { ...a, variants: variantsBy[a.id] || [], questions: all.map((q) => asQuestion(q, q.position)) };
            }
            const draw = drawBy.get(a.id);
            if (!draw && !started.has(a.id)) {
                return { ...a, needsVariant: true, variants: variantsBy[a.id] || [], questions: [], selectedPoints: null };
            }
            if (!draw) {
                return { ...a, needsVariant: false, variants: variantsBy[a.id] || [], questions: all.map((q) => asQuestion(q, q.position)) };
            }
            const order = new Map(draw.questionIds.map((id, index) => [id, index]));
            const selected = all.filter((q) => order.has(q.questionId)).sort((x, y) => (order.get(x.questionId) ?? 0) - (order.get(y.questionId) ?? 0));
            const selectedPoints = selected.reduce((sum, q) => sum + (q.pointsOverride ?? q.maxPoints ?? 0), 0);
            return {
                ...a,
                needsVariant: false,
                variantId: draw.variantId,
                variants: (variantsBy[a.id] || []).filter((v) => v.id === draw.variantId),
                questions: selected.map((q, i) => asQuestion(q, i)),
                selectedPoints,
            };
        });
        return NextResponse.json(enriched);
    } catch (e) {
        console.error('[assignments.GET] error', e);
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}

// Create new assignment
export async function POST(req: Request) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) { console.error('[assignments.POST] missing token'); return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }
        const payload = verifyJwt(token);
        if (!payload) { console.error('[assignments.POST] invalid token'); return NextResponse.json({ error: 'invalid token' }, { status: 401 }); }
        const body: NewAssignmentPayload & { attemptsAllowed?: number } = await req.json();
        const { title, difficulty, points, due, tags, attemptsAllowed, published } = body;
        if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
        const minAttempts = (attemptsAllowed === undefined || attemptsAllowed === null)
            ? 3
            : Math.max(1, Math.floor(Number(attemptsAllowed)));
        const { rows } = await withInstructorContext(payload.sub, () => query<Assignment>(
            `WITH ins AS (
                INSERT INTO assignments (title, difficulty, points, due, tags, attempts_allowed, published, owner_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,current_setting('app.current_instructor')::uuid)
                RETURNING *
             )
             SELECT ins.id, ins.title, c.name as course, ins.difficulty, ins.points, ins.due, ins.tags,
                    ins.attempts_allowed as "attemptsAllowed", ins.published
               FROM ins
               JOIN courses c ON c.id = ins.course_id`,
            [title, difficulty || 'Beginner', points || 0, due || '', Array.isArray(tags) ? tags : [], minAttempts, published === true]
        ));
        return NextResponse.json(rows[0]);
    } catch (e) {
        console.error('[assignments.POST] error', e);
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) { console.error('[assignments.PATCH] missing token'); return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }
        const payload = verifyJwt(token);
        if (!payload) { console.error('[assignments.PATCH] invalid token'); return NextResponse.json({ error: 'invalid token' }, { status: 401 }); }
        const body: Partial<AssignmentPatch> & { drawCount?: number | null } = await req.json();
        const { id, title, difficulty, points, due, tags, attemptsAllowed, published } = body || {};
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        const nextTitle = title === undefined ? null : title;
        const nextDifficulty = difficulty === undefined ? null : difficulty;
        const nextPoints = points === undefined || points === null ? null : Number(points);
        const nextDue = due === undefined ? null : due;
        const nextTags = tags === undefined ? null : (Array.isArray(tags) ? tags : []);
        const nextAttemptsAllowed = (attemptsAllowed === undefined || attemptsAllowed === null)
            ? null
            : Math.max(1, Math.floor(Number(attemptsAllowed)));
        const nextPublished = published === undefined ? null : !!published;
        const hasDraw = !!body && Object.prototype.hasOwnProperty.call(body, 'drawCount');
        const nextDraw = !hasDraw || body.drawCount == null ? null : Math.max(1, Math.floor(Number(body.drawCount)));
        const { rows } = await withInstructorContext(payload.sub, () => query<Assignment>(
            `WITH upd AS (
                UPDATE assignments SET
                    title=COALESCE($2, title),
                    difficulty=COALESCE($3, difficulty),
                    points=COALESCE($4, points),
                    due=COALESCE($5, due),
                    tags=COALESCE($6, tags),
                    attempts_allowed=COALESCE($7, attempts_allowed),
                    published=COALESCE($8, published),
                    draw_count=CASE WHEN $9::boolean THEN $10::int ELSE draw_count END
                WHERE id=$1
                  AND owner_id = current_setting('app.current_instructor')::uuid
                  AND course_id = current_setting('app.current_course', true)::uuid
                RETURNING *
             )
             SELECT upd.id, upd.title, c.name as course, upd.difficulty, upd.points, upd.due, upd.tags,
                    upd.attempts_allowed as "attemptsAllowed", upd.published, upd.draw_count as "drawCount"
               FROM upd
               JOIN courses c ON c.id = upd.course_id`,
            [id, nextTitle, nextDifficulty, nextPoints, nextDue, nextTags, nextAttemptsAllowed, nextPublished, hasDraw, nextDraw]
        ));
        if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(rows[0]);
    } catch (e) {
        console.error('[assignments.PATCH] error', e);
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) { console.error('[assignments.DELETE] missing token'); return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); }
        const payload = verifyJwt(token);
        if (!payload) { console.error('[assignments.DELETE] invalid token'); return NextResponse.json({ error: 'invalid token' }, { status: 401 }); }
        const url = new URL(req.url);
        let id = url.searchParams.get('id');
        if (!id) {
            try { const body = await req.json(); id = body?.id; } catch { /* ignore body parse */ }
        }
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        await withInstructorContext(payload.sub, () => query(`DELETE FROM assignments WHERE id=$1 AND owner_id = current_setting('app.current_instructor')::uuid AND course_id = current_setting('app.current_course', true)::uuid`, [id]));
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[assignments.DELETE] error', e);
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}
