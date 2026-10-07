import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  keyExtractor,
  overscan = 5,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    const offset = start * itemHeight;
    return { startIndex: start, endIndex: end, offsetY: offset };
  }, [scrollTop, itemHeight, height, items.length, overscan]);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      className="w-full rounded-xl border border-slate-200 bg-white"
    >
      <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item)}
              style={{ height: itemHeight }}
              className="box-border"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
