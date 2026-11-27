import { NextRequest, NextResponse } from 'next/server';
import { initSchema, query, withInstructorContext } from '@/lib/db';
import { parseAuthHeader, verifyJwt } from '@/lib/auth';

let initialized = false;
async function ensureInit() { if (!initialized) { await initSchema(); initialized = true; } }

export async function GET(req: NextRequest) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const payload = verifyJwt(token);
        if (!payload || payload.role !== 'instructor') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        const assignmentId = new URL(req.url).searchParams.get('assignmentId');
        if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
        const rows = await withInstructorContext(payload.sub, async () => (await query(
            `SELECT id, assignment_id as "assignmentId", label, title FROM assignment_variants
             WHERE assignment_id = $1 AND owner_id = current_setting('app.current_instructor')::uuid
               AND course_id = current_setting('app.current_course', true)::uuid ORDER BY label`,
            [assignmentId])).rows);
        return NextResponse.json(rows);
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await ensureInit();
        const token = parseAuthHeader(req.headers.get('authorization') || undefined);
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        const payload = verifyJwt(token);
        if (!payload || payload.role !== 'instructor') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        const body = await req.json().catch(() => ({}));
        const assignmentId = String(body?.assignmentId || '');
        const label = String(body?.label || '').trim();
        const title = String(body?.title || label).trim();
        if (!assignmentId || !label) return NextResponse.json({ error: 'assignmentId and label required' }, { status: 400 });
        const row = await withInstructorContext(payload.sub, async () => (await query(
            `INSERT INTO assignment_variants (assignment_id, label, title, owner_id)
             VALUES ($1,$2,$3, current_setting('app.current_instructor')::uuid)
             ON CONFLICT (assignment_id, label) DO UPDATE SET title = EXCLUDED.title
             RETURNING id, assignment_id as "assignmentId", label, title`,
            [assignmentId, label, title])).rows[0]);
        return NextResponse.json(row);
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 500 });
    }
}
