import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import { useDidShow, useReachBottom } from '@tarojs/taro';

import AtlasPageHero from '../../components/AtlasPageHero';
import BeanCard from '../../components/BeanCard';
import EmptyState from '../../components/EmptyState';
import NewArrivalFilterBar from '../../components/NewArrivalFilterBar';
import SearchBar from '../../components/SearchBar';
import { getBeans, getNewArrivalFilters } from '../../services/api';
import type { CoffeeBean, NewArrivalFiltersPayload } from '../../types/index.ts';
import {
  getBeanFavorites,
  getRoasterFavorites,
} from '../../utils/storage.ts';
import {
  buildNewArrivalFiltersRequest,
  resolveNewArrivalFiltersPayload,
} from '../all-beans/new-arrival-filters.ts';
import {
  buildHomeNewArrivalBeanParams,
  getHomeNewArrivalEmptyStateMessage,
  hasActiveHomeNewArrivalFilters,
  HOME_NEW_ARRIVAL_PAGE_SIZE,
  HOME_NEW_ARRIVAL_SEARCH_DEBOUNCE_MS,
} from './new-arrivals-page.ts';
import { showToast } from '../../utils/miniprogram-api.ts';
import './index.scss';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '加载失败';
}

export default function Index() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoasterId, setSelectedRoasterId] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('');
  const [selectedOriginCountry, setSelectedOriginCountry] = useState('');
  const [remoteFilterPayload, setRemoteFilterPayload] = useState<NewArrivalFiltersPayload | null>(null);

  const [beans, setBeans] = useState<CoffeeBean[]>([]);
  const [filterSeedBeans, setFilterSeedBeans] = useState<CoffeeBean[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizedQuery = searchQuery.trim();
  const hasActiveFilters = hasActiveHomeNewArrivalFilters({
    searchQuery,
    selectedRoasterId,
    selectedProcess,
    selectedOriginCountry,
  });

  const loadingRef = useRef(false);
  const listRequestVersionRef = useRef(0);
  const filterRequestVersionRef = useRef(0);

  const filterPayload = useMemo(
    () => resolveNewArrivalFiltersPayload(remoteFilterPayload, filterSeedBeans),
    [filterSeedBeans, remoteFilterPayload]
  );

  const setLoadingState = (value: boolean) => {
    loadingRef.current = value;
    setLoading(value);
  };

  const loadFilterPayload = async (): Promise<void> => {
    const requestVersion = filterRequestVersionRef.current + 1;
    filterRequestVersionRef.current = requestVersion;

    try {
      const response = await getNewArrivalFilters(
        buildNewArrivalFiltersRequest(getBeanFavorites(), getRoasterFavorites())
      );

      if (requestVersion !== filterRequestVersionRef.current) return;
      setRemoteFilterPayload(response);
    } catch {
      if (requestVersion !== filterRequestVersionRef.current) return;
      setRemoteFilterPayload(null);
    }
  };

  const loadBeanPage = async (
    currentPage: number,
    options?: {
      reset?: boolean;
      ignoreLoading?: boolean;
    }
  ): Promise<void> => {
    if (loadingRef.current && !options?.ignoreLoading) return;

    const requestVersion = listRequestVersionRef.current + 1;
    listRequestVersionRef.current = requestVersion;
    setLoadingState(true);
    setErrorMessage('');

    try {
      const response = await getBeans(
        buildHomeNewArrivalBeanParams({
          searchQuery,
          selectedRoasterId,
          selectedProcess,
          selectedOriginCountry,
          page: currentPage,
          pageSize: HOME_NEW_ARRIVAL_PAGE_SIZE,
        })
      );

      if (requestVersion !== listRequestVersionRef.current) return;

      const nextBeans = response.items ?? [];
      setBeans((prev) => (currentPage === 1 || options?.reset ? nextBeans : [...prev, ...nextBeans]));
      setTotal(response.pageInfo.total);
      setPage(currentPage + 1);
      setHasMore(response.pageInfo.hasNextPage);

      if (!hasActiveFilters && currentPage === 1) {
        setFilterSeedBeans(nextBeans);
      }
    } catch (error) {
      if (requestVersion !== listRequestVersionRef.current) return;
      setErrorMessage(getErrorMessage(error));
      showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (requestVersion === listRequestVersionRef.current) {
        setLoadingState(false);
      }
    }
  };

  const reloadBeanResults = (): void => {
    listRequestVersionRef.current += 1;
    setBeans([]);
    setPage(1);
    setHasMore(true);
    setTotal(null);
    void loadBeanPage(1, { reset: true, ignoreLoading: true });
  };

  useEffect(() => {
    void loadFilterPayload();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      reloadBeanResults();
    }, HOME_NEW_ARRIVAL_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [normalizedQuery, selectedOriginCountry, selectedProcess, selectedRoasterId]);

  useDidShow(() => {
    void loadFilterPayload();
  });

  useReachBottom(() => {
    if (loadingRef.current || !hasMore) return;
    void loadBeanPage(page);
  });

  return (
    <View className="index-page">
      <AtlasPageHero />

      <SearchBar
        value={searchQuery}
        placeholder="按烘焙商、产地、处理法或豆种搜索..."
        onInput={setSearchQuery}
      />

      <View className="index-page__content">
        <NewArrivalFilterBar
          mode={filterPayload.mode}
          roasterOptions={filterPayload.roasterOptions}
          processOptions={filterPayload.processOptions}
          originOptions={filterPayload.originOptions}
          selectedRoasterId={selectedRoasterId}
          selectedProcess={selectedProcess}
          selectedOriginCountry={selectedOriginCountry}
          onRoasterChange={setSelectedRoasterId}
          onProcessChange={setSelectedProcess}
          onOriginChange={setSelectedOriginCountry}
        />

        {normalizedQuery ? (
          <View className="index-page__query-bar">
            <Text className="index-page__query-text">{`搜索 “${normalizedQuery}”`}</Text>
            <Text className="index-page__query-clear" onClick={() => setSearchQuery('')}>
              清除
            </Text>
          </View>
        ) : null}

        <View className="index-page__summary">
          <Text className="index-page__summary-label">当前结果</Text>
          <Text className="index-page__summary-value">
            {total === null ? '正在加载...' : `${total} 款新品`}
          </Text>
        </View>

        <View className="index-page__list">
          {errorMessage ? (
            <EmptyState message={errorMessage} />
          ) : loading && beans.length === 0 ? (
            <EmptyState message="加载中..." />
          ) : beans.length === 0 ? (
            <EmptyState message={getHomeNewArrivalEmptyStateMessage(hasActiveFilters)} />
          ) : (
            beans.map((bean, index) => <BeanCard key={bean.id} bean={bean} index={index} />)
          )}

          {loading && beans.length > 0 ? (
            <View className="index-page__loading">
              <Text className="index-page__loading-text">加载中...</Text>
            </View>
          ) : null}

          {!hasMore && beans.length > 0 ? (
            <View className="index-page__end">
              <Text className="index-page__end-text">- 已加载全部新品 -</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
