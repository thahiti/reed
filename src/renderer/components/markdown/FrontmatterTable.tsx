import type { FC, ReactNode } from 'react';

type FrontmatterTableProps = {
  readonly data: string;
};

const renderValue = (value: unknown): ReactNode => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return (
      <span>
        {value.map((item, i) => (
          <span key={i} className="frontmatter-badge">
            {String(item)}
          </span>
        ))}
      </span>
    );
  }
  if (typeof value === 'object') {
    const stringified = JSON.stringify(value as Record<string, unknown>);
    return stringified;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

const parseFrontmatter = (data: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const FrontmatterTable: FC<FrontmatterTableProps> = ({ data }) => {
  const parsed = parseFrontmatter(data);
  if (parsed === null) return null;

  const entries = Object.entries(parsed);
  if (entries.length === 0) return null;

  return (
    <div className="frontmatter-table">
      <table>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="frontmatter-key">{key}</td>
              <td className="frontmatter-value">{renderValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
