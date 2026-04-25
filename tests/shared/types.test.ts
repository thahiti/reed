import { describe, it, expectTypeOf } from 'vitest';
import type { IpcChannels, HistoryEntry, NavHistoryEntry, Tab, TabState, AppSettings } from '../src/shared/types';

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

  it('should allow Tab with null filePath', () => {
    expectTypeOf<Tab['filePath']>().toEqualTypeOf<string | null>();
    expectTypeOf<Tab>().toHaveProperty('filePath');
  });

  it('TabState should have tabs and activeTabId', () => {
    expectTypeOf<TabState>().toHaveProperty('tabs');
    expectTypeOf<TabState>().toHaveProperty('activeTabId');
  });

  it('should allow AppSettings with bodyFont and codeFont', () => {
    expectTypeOf<AppSettings>().toHaveProperty('bodyFont');
    expectTypeOf<AppSettings>().toHaveProperty('codeFont');
    expectTypeOf<AppSettings['bodyFont']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AppSettings['codeFont']>().toEqualTypeOf<string | undefined>();
  });

  it('should allow AppSettings without bodyFont and codeFont', () => {
    expectTypeOf<AppSettings['bodyFont']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AppSettings['codeFont']>().toEqualTypeOf<string | undefined>();
  });

  it('NavHistoryEntry should have required fields and optional anchorId', () => {
    expectTypeOf<NavHistoryEntry>().toHaveProperty('filePath');
    expectTypeOf<NavHistoryEntry>().toHaveProperty('topLine');
    expectTypeOf<NavHistoryEntry>().toHaveProperty('anchorId');
    expectTypeOf<NavHistoryEntry['filePath']>().toEqualTypeOf<string>();
    expectTypeOf<NavHistoryEntry['topLine']>().toEqualTypeOf<number>();
    expectTypeOf<NavHistoryEntry['anchorId']>().toEqualTypeOf<string | undefined>();
  });

  it('Tab should have history stack and historyIndex', () => {
    expectTypeOf<Tab>().toHaveProperty('history');
    expectTypeOf<Tab>().toHaveProperty('historyIndex');
    expectTypeOf<Tab['history']>().toEqualTypeOf<ReadonlyArray<NavHistoryEntry>>();
    expectTypeOf<Tab['historyIndex']>().toEqualTypeOf<number>();
  });
});
