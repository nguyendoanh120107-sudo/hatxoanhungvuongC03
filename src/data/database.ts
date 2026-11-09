import type { RecordItem, SourceItem } from '../types.ts';
import rawRecords from '../../data/records.json';
import rawSources from '../../data/sources.json';

export const RECORDS: RecordItem[] = rawRecords as RecordItem[];
export const SOURCES: SourceItem[] = rawSources as SourceItem[];

export const SOURCES_MAP = new Map<string, SourceItem>(
  SOURCES.map((s) => [s.id, s])
);

export function getSourceById(id: string): SourceItem | undefined {
  return SOURCES_MAP.get(id);
}

export function exportDataAsJson(data: any, filename: string): void {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
