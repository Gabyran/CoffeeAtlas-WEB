'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

type RoasterBeanItem = {
  id: string;
  roasterId: string;
  roasterName: string;
  beanId: string;
  beanName: string;
  originCountry: string | null;
  originRegion: string | null;
  processMethod: string | null;
  variety: string | null;
  displayName: string;
  roastLevel: string | null;
  priceAmount: number | null;
  priceCurrency: string;
  weightGrams: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  sourceItemId: string | null;
  sourceSkuId: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isInStock: boolean;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  ok: boolean;
  data?: {
    items: RoasterBeanItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: { message?: string };
};

type AdminErrorResponse = {
  ok?: boolean;
  error?: string | { message?: string };
};

type RoasterOption = { id: string; name: string };

type EditForm = {
  displayName: string;
  roastLevel: string;
  priceAmount: string;
  weightGrams: string;
  productUrl: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isInStock: boolean;
};

const statusLabels: Record<string, string> = {
  DRAFT: '草稿',
  ACTIVE: '上架',
  ARCHIVED: '归档',
};

const statusColors: Record<string, string> = {
  DRAFT: '#b45309',
  ACTIVE: '#15803d',
  ARCHIVED: '#6b7280',
};

function getHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function getErrorMessage(payload: AdminErrorResponse, fallback: string) {
  if (typeof payload.error === 'string') return payload.error;
  return payload.error?.message ?? fallback;
}

function createEditForm(item: RoasterBeanItem): EditForm {
  return {
    displayName: item.displayName,
    roastLevel: item.roastLevel ?? '',
    priceAmount: item.priceAmount == null ? '' : String(item.priceAmount),
    weightGrams: item.weightGrams == null ? '' : String(item.weightGrams),
    productUrl: item.productUrl ?? '',
    status: item.status,
    isInStock: item.isInStock,
  };
}

export default function RoasterBeansAdminPage() {
  const [token, setToken] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');
  const [items, setItems] = useState<RoasterBeanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roasterFilter, setRoasterFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [roasters, setRoasters] = useState<RoasterOption[]>([]);
  const [editing, setEditing] = useState<{ item: RoasterBeanItem; form: EditForm } | null>(null);
  const [deleting, setDeleting] = useState<RoasterBeanItem | null>(null);

  const storedKey = 'ca_admin_token';

  useEffect(() => {
    const saved = localStorage.getItem(storedKey);
    if (saved) setTokenDraft(saved);
  }, []);

  const saveToken = (value: string) => {
    const normalized = value.trim();
    setToken(normalized);
    setTokenDraft(normalized);
    if (normalized) {
      localStorage.setItem(storedKey, normalized);
    } else {
      localStorage.removeItem(storedKey);
    }
  };

  const clearToken = () => {
    setToken('');
    setTokenDraft('');
    localStorage.removeItem(storedKey);
    setItems([]);
    setTotal(0);
    setMessage('');
  };

  const handleTokenSubmit = () => {
    const normalized = tokenDraft.trim();
    if (!normalized) {
      setMessage('请输入 Admin Token');
      return;
    }
    saveToken(normalized);
  };

  const loadRoasters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/roasters?limit=100', { headers: getHeaders(token) });
      const payload = (await res.json()) as { ok?: boolean; data?: RoasterOption[] };
      if (payload.ok && payload.data) {
        setRoasters(payload.data);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (statusFilter) params.set('status', statusFilter);
      if (roasterFilter) params.set('roasterId', roasterFilter);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/admin/roaster-beans?${params.toString()}`, {
        headers: getHeaders(token),
      });
      const payload = (await res.json()) as ListResponse;
      if (!res.ok || !payload.ok || !payload.data) {
        throw new Error(getErrorMessage(payload, '加载失败'));
      }
      setItems(payload.data.items);
      setTotal(payload.data.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, page, pageSize, statusFilter, roasterFilter, q]);

  useEffect(() => {
    if (token) {
      loadRoasters();
      loadItems();
    }
  }, [token, loadItems, loadRoasters]);

  const updateEditingForm = (patch: Partial<EditForm>) => {
    setEditing((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      const patch = {
        displayName: editing.form.displayName,
        roastLevel: editing.form.roastLevel,
        priceAmount: editing.form.priceAmount,
        weightGrams: editing.form.weightGrams,
        productUrl: editing.form.productUrl,
        status: editing.form.status,
        isInStock: editing.form.isInStock,
      };
      const res = await fetch(`/api/admin/roaster-beans/${editing.item.id}`, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(patch),
      });
      const payload = (await res.json()) as AdminErrorResponse;
      if (!res.ok || !payload.ok) {
        throw new Error(getErrorMessage(payload, '更新失败'));
      }
      setMessage('已更新');
      setEditing(null);
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/roaster-beans/${deleting.id}`, {
        method: 'DELETE',
        headers: getHeaders(token),
      });
      const payload = (await res.json()) as AdminErrorResponse;
      if (!res.ok || !payload.ok) {
        throw new Error(getErrorMessage(payload, '删除失败'));
      }
      setMessage('已删除');
      setDeleting(null);
      await loadItems();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>烘焙商商品管理后台</h1>
          <p style={styles.subtitle}>请先输入 Admin Token 进行认证</p>
          {message ? <div style={styles.flash}>{message}</div> : null}
          <form
            style={styles.loginForm}
            onSubmit={(event) => {
              event.preventDefault();
              handleTokenSubmit();
            }}
          >
            <label style={styles.fieldLabel}>
              Admin Token
              <input
                style={styles.input}
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="输入 Bearer Token"
              />
            </label>
            <button style={styles.primaryButton} type="submit">
              进入后台
            </button>
          </form>
        </section>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>CoffeeAtlas Admin</p>
          <h1 style={styles.title}>烘焙商商品管理</h1>
          <p style={styles.subtitle}>审核、编辑、上架或归档同步进来的商品。DRAFT 状态的商品不会出现在小程序中。</p>
        </div>
        <div style={styles.toolbar}>
          <label style={styles.fieldLabel}>
            Admin Token
            <input
              style={styles.input}
              type="password"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
            />
          </label>
          <button style={styles.secondaryButton} onClick={clearToken}>
            更换 Token
          </button>
        </div>
      </section>

      {message ? <div style={styles.flash}>{message}</div> : null}

      <section style={styles.filterBar}>
        <label style={styles.fieldLabel}>
          状态
          <select style={styles.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">全部</option>
            <option value="DRAFT">草稿</option>
            <option value="ACTIVE">上架</option>
            <option value="ARCHIVED">归档</option>
          </select>
        </label>
        <label style={styles.fieldLabel}>
          店铺
          <select style={styles.select} value={roasterFilter} onChange={(e) => { setRoasterFilter(e.target.value); setPage(1); }}>
            <option value="">全部</option>
            {roasters.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label style={styles.fieldLabel}>
          搜索
          <input
            style={styles.input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="商品名 / sourceItemId"
          />
        </label>
        <button style={styles.primaryButton} onClick={loadItems} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </button>
      </section>

      <section style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>图片</th>
              <th style={styles.th}>店铺</th>
              <th style={styles.th}>商品名</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>价格</th>
              <th style={styles.th}>库存</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={styles.tr}>
                <td style={styles.td}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" style={styles.thumb} />
                  ) : (
                    <div style={styles.noThumb}>无图</div>
                  )}
                </td>
                <td style={styles.td}>{item.roasterName}</td>
                <td style={styles.td}>
                  <div style={styles.nameCell}>
                    <span>{item.displayName}</span>
                    {item.beanName && item.beanName !== item.displayName ? (
                      <span style={styles.meta}>Bean: {item.beanName}</span>
                    ) : null}
                    {item.sourceItemId ? (
                      <span style={styles.meta}>Item: {item.sourceItemId}</span>
                    ) : null}
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: statusColors[item.status] }}>
                    {statusLabels[item.status]}
                  </span>
                </td>
                <td style={styles.td}>
                  {item.priceAmount != null ? `¥${item.priceAmount}` : '—'}
                </td>
                <td style={styles.td}>{item.isInStock ? '有' : '无'}</td>
                <td style={styles.td}>
                  <div style={styles.actions}>
                    <button style={styles.smallButton} onClick={() => setEditing({ item, form: createEditForm(item) })}>编辑</button>
                    <button style={{ ...styles.smallButton, background: '#8a2d1d' }} onClick={() => setDeleting(item)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={styles.emptyTd}>暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={styles.pagination}>
        <button style={styles.secondaryButton} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
          上一页
        </button>
        <span style={styles.pageInfo}>第 {page} / {totalPages} 页（共 {total} 条）</span>
        <button style={styles.secondaryButton} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
          下一页
        </button>
      </section>

      {editing ? (
        <div style={styles.overlay} onClick={() => setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>编辑商品</h2>
            <div style={styles.modalBody}>
              <label style={styles.fieldLabel}>
                商品名
                <input
                  style={styles.input}
                  value={editing.form.displayName}
                  onChange={(event) => updateEditingForm({ displayName: event.target.value })}
                />
              </label>
              <label style={styles.fieldLabel}>
                烘焙度
                <input
                  style={styles.input}
                  value={editing.form.roastLevel}
                  onChange={(event) => updateEditingForm({ roastLevel: event.target.value })}
                />
              </label>
              <label style={styles.fieldLabel}>
                价格
                <input
                  style={styles.input}
                  type="number"
                  value={editing.form.priceAmount}
                  onChange={(event) => updateEditingForm({ priceAmount: event.target.value })}
                />
              </label>
              <label style={styles.fieldLabel}>
                克重
                <input
                  style={styles.input}
                  type="number"
                  value={editing.form.weightGrams}
                  onChange={(event) => updateEditingForm({ weightGrams: event.target.value })}
                />
              </label>
              <label style={styles.fieldLabel}>
                商品链接
                <input
                  style={styles.input}
                  value={editing.form.productUrl}
                  onChange={(event) => updateEditingForm({ productUrl: event.target.value })}
                />
              </label>
              <label style={styles.fieldLabel}>
                状态
                <select
                  style={styles.select}
                  value={editing.form.status}
                  onChange={(event) => updateEditingForm({ status: event.target.value as EditForm['status'] })}
                >
                  <option value="DRAFT">草稿</option>
                  <option value="ACTIVE">上架</option>
                  <option value="ARCHIVED">归档</option>
                </select>
              </label>
              <label style={styles.fieldLabel}>
                <input
                  type="checkbox"
                  checked={editing.form.isInStock}
                  onChange={(event) => updateEditingForm({ isInStock: event.target.checked })}
                  style={{ marginRight: 8 }}
                />
                有库存
              </label>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={() => setEditing(null)}>取消</button>
              <button
                style={styles.primaryButton}
                onClick={handleUpdate}
                disabled={loading}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div style={styles.overlay} onClick={() => setDeleting(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>确认删除</h2>
            <p style={styles.modalBody}>确定要删除 <strong>{deleting.displayName}</strong> 吗？此操作不可恢复。</p>
            <div style={styles.modalActions}>
              <button style={styles.secondaryButton} onClick={() => setDeleting(null)}>取消</button>
              <button style={{ ...styles.primaryButton, background: '#8a2d1d' }} onClick={handleDelete} disabled={loading}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1320,
    margin: '0 auto',
    padding: '48px 24px 96px',
    fontFamily: '"SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif',
    color: '#2f2419',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
    gap: 24,
    padding: 28,
    borderRadius: 20,
    border: '1px solid rgba(72,51,31,0.12)',
    background: 'rgba(255,252,247,0.84)',
    marginBottom: 24,
  },
  eyebrow: { margin: 0, fontSize: 13, color: '#6c5b4d', textTransform: 'uppercase', letterSpacing: '0.08em' },
  title: { margin: '10px 0 0', fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.03em' },
  subtitle: { margin: '12px 0 0', color: '#6c5b4d', lineHeight: 1.7 },
  toolbar: { display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' },
  loginForm: { display: 'grid', gap: 16, marginTop: 20 },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#6c5b4d' },
  input: { width: '100%', border: '1px solid rgba(72,51,31,0.16)', background: '#fffdf9', borderRadius: 12, padding: '10px 12px', color: '#2f2419', fontSize: 14 },
  select: { width: '100%', border: '1px solid rgba(72,51,31,0.16)', background: '#fffdf9', borderRadius: 12, padding: '10px 12px', color: '#2f2419', fontSize: 14 },
  primaryButton: { border: 0, borderRadius: 999, background: '#2f2419', color: '#fff', padding: '12px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  secondaryButton: { border: '1px solid rgba(72,51,31,0.2)', borderRadius: 999, background: '#fffdf9', color: '#2f2419', padding: '10px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  smallButton: { border: 0, borderRadius: 999, background: '#2f2419', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  flash: { padding: 14, borderRadius: 16, background: '#edf6e9', color: '#2d5b2f', marginBottom: 16, fontSize: 14 },
  filterBar: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20, alignItems: 'end' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '1px solid rgba(72,51,31,0.12)', color: '#6c5b4d', fontWeight: 600, whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid rgba(72,51,31,0.06)' },
  td: { padding: '10px', verticalAlign: 'top' },
  thumb: { width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: '#f1e7dc' },
  noThumb: { width: 56, height: 56, borderRadius: 12, background: '#f1e7dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6c5b4d' },
  nameCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  meta: { fontSize: 12, color: '#6c5b4d' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'white' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  emptyTd: { padding: 32, textAlign: 'center', color: '#6c5b4d' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 },
  pageInfo: { fontSize: 14, color: '#6c5b4d' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 },
  modal: { background: '#fffdf9', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { margin: '0 0 16px', fontSize: 22 },
  modalBody: { display: 'grid', gap: 12 },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 },
  card: { padding: 28, borderRadius: 20, border: '1px solid rgba(72,51,31,0.12)', background: 'rgba(255,252,247,0.84)' },
};
