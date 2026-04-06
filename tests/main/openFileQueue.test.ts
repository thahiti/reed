import { describe, it, expect } from 'vitest';
import { createOpenFileQueue } from '../../src/main/openFileQueue';

describe('openFileQueue', () => {
  it('should queue file path when no sender is set', () => {
    const queue = createOpenFileQueue();
    queue.enqueue('/test/file.md');
    expect(queue.drain()).toEqual(['/test/file.md']);
  });

  it('should send file path immediately when sender is set', () => {
    const sent: string[] = [];
    const queue = createOpenFileQueue();
    queue.setSender((filePath) => { sent.push(filePath); });
    queue.enqueue('/test/file.md');
    expect(sent).toEqual(['/test/file.md']);
    expect(queue.drain()).toEqual([]);
  });

  it('should drain queued files when sender is set', () => {
    const sent: string[] = [];
    const queue = createOpenFileQueue();
    queue.enqueue('/test/a.md');
    queue.enqueue('/test/b.md');
    queue.setSender((filePath) => { sent.push(filePath); });
    expect(sent).toEqual(['/test/a.md', '/test/b.md']);
    expect(queue.drain()).toEqual([]);
  });

  it('should return empty array when nothing queued', () => {
    const queue = createOpenFileQueue();
    expect(queue.drain()).toEqual([]);
  });
});
