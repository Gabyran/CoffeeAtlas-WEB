import type {
  LocalFavoriteBeanPreference,
  LocalFavoriteRoasterPreference,
  UserFavorite,
} from '@coffee-atlas/shared-types';

import { getCatalogBeansByIds, getCatalogBeansPage } from '@/lib/catalog';
import { getLatestSyncedNewArrivalBeanIds } from '@/lib/new-arrivals';

import {
  buildNewArrivalFiltersPayload,
  type FavoriteBeanPreference,
  type FavoriteRoasterPreference,
  type NewArrivalBeanSeed,
} from './new-arrival-filters-helpers';
import { getFavorites } from './favorites-api';

function mapFavoriteBeans(favorites: UserFavorite[]): FavoriteBeanPreference[] {
  return favorites
    .filter((favorite): favorite is Extract<UserFavorite, { target_type: 'bean' }> => favorite.target_type === 'bean')
    .map((favorite) => ({
      process: favorite.bean?.process ?? undefined,
      originCountry: favorite.bean?.originCountry ?? undefined,
    }));
}

function mapFavoriteRoasters(favorites: UserFavorite[]): FavoriteRoasterPreference[] {
  return favorites
    .filter(
      (favorite): favorite is Extract<UserFavorite, { target_type: 'roaster' }> => favorite.target_type === 'roaster'
    )
    .map((favorite) => ({
      id: favorite.roaster?.id ?? '',
      name: favorite.roaster?.name ?? '',
    }));
}

function mapFallbackBeanSeeds(
  beans: Array<{
    roasterId: string;
    roasterName: string;
    process: string;
    originCountry: string;
  }>
): NewArrivalBeanSeed[] {
  return beans.map((bean) => ({
    roasterId: bean.roasterId,
    roasterName: bean.roasterName,
    process: bean.process,
    originCountry: bean.originCountry,
  }));
}

async function loadFallbackBeanSeeds(): Promise<NewArrivalBeanSeed[]> {
  const ids = await getLatestSyncedNewArrivalBeanIds();
  if (ids && ids.length > 0) {
    return mapFallbackBeanSeeds(await getCatalogBeansByIds(ids));
  }

    return mapFallbackBeanSeeds(
      await getCatalogBeansPage({
        limit: 120,
        offset: 0,
      })
    );
}

async function resolveCloudFavorites(userId: string): Promise<{
  favoriteBeans: FavoriteBeanPreference[];
  favoriteRoasters: FavoriteRoasterPreference[];
}> {
  const favorites = await getFavorites(userId);
  return {
    favoriteBeans: mapFavoriteBeans(favorites),
    favoriteRoasters: mapFavoriteRoasters(favorites),
  };
}

export async function getNewArrivalFiltersV1({
  userId,
  localBeanFavorites = [],
  localRoasterFavorites = [],
}: {
  userId?: string;
  localBeanFavorites?: LocalFavoriteBeanPreference[];
  localRoasterFavorites?: LocalFavoriteRoasterPreference[];
}) {
  const fallbackBeans = await loadFallbackBeanSeeds();

  let favoriteBeans = localBeanFavorites;
  let favoriteRoasters = localRoasterFavorites;

  if (userId) {
    const cloudFavorites = await resolveCloudFavorites(userId);
    if (cloudFavorites.favoriteBeans.length > 0) {
      favoriteBeans = cloudFavorites.favoriteBeans;
    }
    if (cloudFavorites.favoriteRoasters.length > 0) {
      favoriteRoasters = cloudFavorites.favoriteRoasters;
    }
  }

  return buildNewArrivalFiltersPayload({
    favoriteBeans,
    favoriteRoasters,
    fallbackBeans,
  });
}
