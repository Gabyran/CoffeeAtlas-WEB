import { NextRequest, NextResponse } from 'next/server';

import {
  deleteAdminRoasterBean,
  updateAdminRoasterBean,
} from '@/lib/server/admin-catalog';
import { requireAdmin } from '@/lib/server/admin-auth';
import { badRequest, toLegacyError } from '@/lib/server/api-helpers';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      badRequest('Request body must be a JSON object', 'invalid_payload');
    }

    const data = await updateAdminRoasterBean(id, body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return toLegacyError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await deleteAdminRoasterBean(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toLegacyError(error);
  }
}
