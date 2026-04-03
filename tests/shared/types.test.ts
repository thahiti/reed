import { describe, it, expectTypeOf } from 'vitest';
import type { IpcChannels, HistoryEntry, Tab, TabState } from '../src/shared/types';

describe('Shared Types', () => {
  it('IpcChannels should have file:read channel', () => {
    expectTypeOf<IpcChannels['file:read']['args']>().toEqualTypeOf<readonly [filePath: string]>();
    expectTypeOf<IpcChannels['file:read']['return']>().toEqualTypeOf<string>();
  });

  it('HistoryEntry should have required fields', () => {
    expectTypeOf<HistoryEntry>().toHaveProperty('filePath');
    expectTypeOf<HistoryEntry>().toHaveProperty('fileName');
    expectTypeOf<HistoryEntry>().toHaveProperty('openedAt');
  });

  it('Tab should have required fields', () => {
    expectTypeOf<Tab>().toHaveProperty('id');
    expectTypeOf<Tab>().toHaveProperty('filePath');
    expectTypeOf<Tab>().toHaveProperty('fileName');
    expectTypeOf<Tab>().toHaveProperty('content');
  });

  it('TabState should have tabs and activeTabId', () => {
    expectTypeOf<TabState>().toHaveProperty('tabs');
    expectTypeOf<TabState>().toHaveProperty('activeTabId');
  });
});
