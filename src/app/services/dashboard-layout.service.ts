import { Injectable, computed, signal } from '@angular/core';

export type DashboardSectionId =
  | 'connectedExchanges'
  | 'strategies'
  | 'bots'
  | 'mainGrid'
  | 'portfolioPerformance';

export interface DashboardSectionState {
  id: DashboardSectionId;
  visible: boolean;
}

export interface DashboardSectionDefinition {
  id: DashboardSectionId;
  label: string;
  description: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: DashboardSectionDefinition[] = [
  {
    id: 'connectedExchanges',
    label: 'Connected Exchanges',
    description: 'Shows linked exchanges and connection status.',
    visible: true,
  },
  {
    id: 'strategies',
    label: 'Strategies',
    description: 'Shows your configured strategies and controls.',
    visible: true,
  },
  {
    id: 'bots',
    label: 'Bots',
    description: 'Shows your bots table and current states.',
    visible: true,
  },
  {
    id: 'mainGrid',
    label: 'Quick Panels',
    description: 'Quick Actions, Getting Started, and Backend Runner.',
    visible: true,
  },
  {
    id: 'portfolioPerformance',
    label: 'Portfolio Performance',
    description: 'Shows the performance placeholder/summary panel.',
    visible: true,
  },
];

@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly storageKey = 'auto-trader-dashboard-layout';
  private readonly sectionsState = signal<DashboardSectionState[]>(this.readInitialState());

  readonly sections = computed<DashboardSectionDefinition[]>(() => {
    const byId = new Map(DEFAULT_SECTIONS.map((section) => [section.id, section]));
    return this.sectionsState().map((state) => {
      const section = byId.get(state.id);
      return {
        id: state.id,
        label: section?.label ?? state.id,
        description: section?.description ?? '',
        visible: state.visible,
      };
    });
  });

  setSectionVisible(id: DashboardSectionId, visible: boolean) {
    this.sectionsState.update((items) => {
      const next = items.map((item) => (item.id === id ? { ...item, visible } : item));
      return this.normalizeState(next);
    });
    this.persist();
  }

  moveSectionUp(id: DashboardSectionId) {
    this.sectionsState.update((items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index <= 0) return items;
      const next = [...items];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    this.persist();
  }

  moveSectionDown(id: DashboardSectionId) {
    this.sectionsState.update((items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0 || index >= items.length - 1) return items;
      const next = [...items];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    this.persist();
  }

  reorderSection(draggedId: DashboardSectionId, targetId: DashboardSectionId) {
    if (draggedId === targetId) {
      return;
    }

    this.sectionsState.update((items) => {
      const fromIndex = items.findIndex((item) => item.id === draggedId);
      const toIndex = items.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return items;
      }

      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    this.persist();
  }

  isSectionVisible(id: DashboardSectionId): boolean {
    return this.sectionsState().some((item) => item.id === id && item.visible);
  }

  sectionOrder(id: DashboardSectionId): number {
    const index = this.sectionsState().findIndex((item) => item.id === id);
    return index >= 0 ? 10 + index : 999;
  }

  canMoveUp(id: DashboardSectionId): boolean {
    return this.sectionsState().findIndex((item) => item.id === id) > 0;
  }

  canMoveDown(id: DashboardSectionId): boolean {
    const items = this.sectionsState();
    const index = items.findIndex((item) => item.id === id);
    return index >= 0 && index < items.length - 1;
  }

  replaceLayout(layout: DashboardSectionState[]) {
    this.sectionsState.set(this.normalizeState(layout));
    this.persist();
  }

  resetToDefaults() {
    this.sectionsState.set(DEFAULT_SECTIONS.map(({ id, visible }) => ({ id, visible })));
    this.persist();
  }

  private readInitialState(): DashboardSectionState[] {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_SECTIONS.map(({ id, visible }) => ({ id, visible }));
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return DEFAULT_SECTIONS.map(({ id, visible }) => ({ id, visible }));
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return DEFAULT_SECTIONS.map(({ id, visible }) => ({ id, visible }));
      }

      const candidate = parsed
        .filter((item): item is DashboardSectionState => {
          return !!item && typeof item === 'object' && 'id' in item && 'visible' in item;
        })
        .map((item) => ({
          id: item.id as DashboardSectionId,
          visible: Boolean(item.visible),
        }));

      return this.normalizeState(candidate);
    } catch {
      return DEFAULT_SECTIONS.map(({ id, visible }) => ({ id, visible }));
    }
  }

  private normalizeState(candidate: DashboardSectionState[]): DashboardSectionState[] {
    const validIds = new Set(DEFAULT_SECTIONS.map((section) => section.id));
    const normalized: DashboardSectionState[] = [];

    for (const item of candidate) {
      if (!validIds.has(item.id)) continue;
      if (normalized.some((existing) => existing.id === item.id)) continue;
      normalized.push({ id: item.id, visible: item.visible });
    }

    for (const section of DEFAULT_SECTIONS) {
      if (!normalized.some((item) => item.id === section.id)) {
        normalized.push({ id: section.id, visible: section.visible });
      }
    }

    return normalized;
  }

  private persist() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(this.sectionsState()));
  }
}
