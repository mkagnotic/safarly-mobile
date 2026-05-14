import { useCallback, useState } from "react";

export function usePullToRefresh(onRefresh?: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
      }
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  return { refreshing, onRefresh: handleRefresh };
}
