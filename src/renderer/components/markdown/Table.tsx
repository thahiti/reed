import type { FC, HTMLAttributes, PropsWithChildren } from 'react';

type TableProps = PropsWithChildren<HTMLAttributes<HTMLTableElement>>;

export const Table: FC<TableProps> = ({ children, ...rest }) => (
  <div className="table-wrapper" {...rest}>
    <table className="table">{children}</table>
  </div>
);

export const TableHead: FC<PropsWithChildren> = ({ children }) => (
  <thead className="table-head">{children}</thead>
);

export const TableBody: FC<PropsWithChildren> = ({ children }) => (
  <tbody className="table-body">{children}</tbody>
);

export const TableRow: FC<PropsWithChildren> = ({ children }) => (
  <tr className="table-row">{children}</tr>
);

type TableCellProps = PropsWithChildren<{
  readonly isHeader?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  readonly className?: string;
}>;

export const TableCell: FC<TableCellProps> = ({ isHeader, align, className, children }) => {
  const Tag = isHeader ? 'th' : 'td';
  return (
    <Tag className={className ?? 'table-cell'} style={align ? { textAlign: align } : undefined}>
      {children}
    </Tag>
  );
};
