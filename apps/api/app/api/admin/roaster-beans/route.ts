import { NextRequest, NextResponse } from 'next/server';

import {
  createAdminBean,
  listAdminRoasterBeans,
} from '@/lib/server/admin-catalog';
import { requireAdmin } from '@/lib/server/admin-auth';
import { badRequest, parsePaginationParams, toLegacyError } from '@/lib/server/api-helpers';

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

type AdminStatus = (typeof VALID_STATUSES)[number];

function parseStatus(value: string | null): AdminStatus | undefined {
  if (!value) return undefined;
  if (VALID_STATUSES.includes(value as AdminStatus)) {
    return value as AdminStatus;
  }
  badRequest('status must be one of DRAFT, ACTIVE, ARCHIVED', 'invalid_status');
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { page, pageSize } = parsePaginationParams(request.nextUrl.searchParams);
    const status = parseStatus(request.nextUrl.searchParams.get('status'));
    const roasterId = request.nextUrl.searchParams.get('roasterId') ?? undefined;
    const q = request.nextUrl.searchParams.get('q') ?? undefined;

    const data = await listAdminRoasterBeans({
      status,
      roasterId,
      q,
      page,
      pageSize,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toLegacyError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      badRequest('Request body must be a JSON object', 'invalid_payload');
    }

    const data = await createAdminBean(body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toLegacyError(error);
  }
}
