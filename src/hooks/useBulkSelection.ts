import { useState, useCallback, useMemo } from 'react';

export interface BulkSelectionState<T extends { id: string }> {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (items: T[]) => void;
  clearSelection: () => void;
  isAllSelected: (items: T[]) => boolean;
  selectedCount: number;
  getSelectedItems: (items: T[]) => T[];
}

export function useBulkSelection<T extends { id: string }>(): BulkSelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map(item => item.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (items: T[]) => items.length > 0 && items.every(item => selectedIds.has(item.id)),
    [selectedIds]
  );

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  const getSelectedItems = useCallback(
    (items: T[]) => items.filter(item => selectedIds.has(item.id)),
    [selectedIds]
  );

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    isAllSelected,
    selectedCount,
    getSelectedItems,
  };
}
