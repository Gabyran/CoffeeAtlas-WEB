import { toSnapshotPrice, toSnapshotText, validateSnapshotId } from './validation.js';

export interface BeanFavoriteSnapshot {
  id: string;
  name: string;
  roasterName: string;
  imageUrl: string | null;
  originCountry: string;
  process: string;
  variety: string;
  price: number;
}

export interface BeanFavoriteSnapshotInput {
  id: string;
  name: string;
  roasterName: string;
  imageUrl: string | null;
  originCountry: string;
  process: string;
  variety?: string | null;
  price: number;
}

export interface RoasterFavoriteSnapshot {
  id: string;
  name: string;
  city: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  taobaoUrl?: string | null;
  xiaohongshuUrl?: string | null;
  websiteUrl?: string | null;
  beanCount?: number;
}

export interface RoasterFavoriteSnapshotInput {
  id: string;
  name: string;
  city: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  taobaoUrl?: string | null;
  xiaohongshuUrl?: string | null;
  websiteUrl?: string | null;
  beanCount?: number;
}

function normalizeSnapshotId(id: string): string {
  return validateSnapshotId(id) ? id.trim() : '';
}

export function toBeanFavoriteSnapshot<T extends BeanFavoriteSnapshotInput>(
  bean: T
): BeanFavoriteSnapshot {
  return {
    id: normalizeSnapshotId(bean.id),
    name: bean.name,
    roasterName: bean.roasterName,
    imageUrl: bean.imageUrl,
    originCountry: bean.originCountry,
    process: bean.process,
    variety: toSnapshotText(bean.variety) ?? '',
    price: toSnapshotPrice(bean.price),
  };
}

export function toRoasterFavoriteSnapshot<T extends RoasterFavoriteSnapshotInput>(
  roaster: T
): RoasterFavoriteSnapshot {
  return {
    id: normalizeSnapshotId(roaster.id),
    name: roaster.name,
    city: roaster.city,
    description: toSnapshotText(roaster.description),
    logoUrl: toSnapshotText(roaster.logoUrl),
    coverImageUrl: toSnapshotText(roaster.coverImageUrl),
    taobaoUrl: toSnapshotText(roaster.taobaoUrl),
    xiaohongshuUrl: toSnapshotText(roaster.xiaohongshuUrl),
    websiteUrl: toSnapshotText(roaster.websiteUrl),
    beanCount: roaster.beanCount,
  };
}
