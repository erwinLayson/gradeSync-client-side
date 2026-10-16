import type { ReactNode } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

/** Right-alignment intent for a column: "num" for figures, "actions" for row buttons. */
export type TableColumnAlign = "left" | "num" | "actions";

export type TableColumns<T> = {
    headers: string,
    accessor: keyof T,
    /** Optional right-alignment (figures / row actions). */
    align?: TableColumnAlign,
    /** Optional fixed column width (any CSS length, e.g. "12rem"). Keeps the
        column from resizing with its content. */
    width?: string,
    /** Optional custom cell renderer (e.g. action buttons). Defaults to the raw cell value. */
    renderCell?: (row: T) => ReactNode,
    /** When true and the table is given `onSortChange`, the head becomes a
        sort button. Defaults to the column's accessor as the sort key. */
    sortable?: boolean,
    /** Sort key reported to `onSortChange`; defaults to `String(accessor)`. */
    sortKey?: string
};


type TableColumnsProps<T> = {
    columns: TableColumns<T>[];
    data: T[];
    /** Optional function returning a stable key per row. Defaults to the row index. */
    rowKey?: (row: T) => string | number;
    /** Optional handler fired when a row is clicked (e.g. to open a detail view). */
    onRowClick?: (row: T) => void;
    /** When given, an empty `data` renders this as a single centred row. */
    emptyMessage?: string;
    /** Active sort key and direction, used to mark the matching head. */
    sortKey?: string;
    sortDir?: "asc" | "desc";
    /** When given, sortable heads call this with the chosen column's key. */
    onSortChange?: (key: string) => void;
};

// Cell intent per accessor: ids and LRNs are monospaced so their digits line up
// between rows, the name is the row's anchor, and the email is secondary.
// The look lives in dataTable.css — no page restates table styling.
const CELL_VARIANTS: Record<string, string> = {
    id: "data-table__td--mono",
    lrn: "data-table__td--mono",
    fullname: "data-table__td--primary",
    email: "data-table__td--muted"
};

export default function Table<T>({
    columns,
    data,
    rowKey,
    onRowClick,
    emptyMessage,
    sortKey,
    sortDir = "asc",
    onSortChange
}: TableColumnsProps<T>) {
    return (
        <div className="data-table__wrap">
            <table className="data-table">
                <colgroup>
                    {columns.map((column, columnIndex) => (
                        <col
                            key={`${String(column.accessor)}-${columnIndex}`}
                            style={column.width ? { width: column.width } : undefined}
                        />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {columns.map((column, columnIndex) => {
                            const key = column.sortKey ?? String(column.accessor);
                            const isSortable = column.sortable && onSortChange;
                            const isActive = sortKey === key;
                            return (
                                <th
                                    key={`${String(column.accessor)}-${columnIndex}`}
                                    scope="col"
                                    aria-sort={
                                        isSortable
                                            ? isActive
                                                ? sortDir === "asc"
                                                    ? "ascending"
                                                    : "descending"
                                                : "none"
                                            : undefined
                                    }
                                    className={`data-table__th${column.align ? ` data-table__th--${column.align}` : ""}${isSortable ? " data-table__th--sortable" : ""}`}
                                >
                                    {isSortable ? (
                                        <button
                                            type="button"
                                            className="data-table__sort"
                                            onClick={() => onSortChange?.(key)}
                                            title={`Sort by ${column.headers}`}
                                        >
                                            <span>{column.headers}</span>
                                            <span className="data-table__sort-icon" aria-hidden="true">
                                                {isActive && sortDir === "desc" ? <FiChevronDown /> : <FiChevronUp />}
                                            </span>
                                        </button>
                                    ) : (
                                        column.headers
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 && emptyMessage ? (
                        <tr>
                            <td className="data-table__empty" colSpan={columns.length}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, index) => (
                            <tr
                                key={rowKey ? rowKey(row) : index}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                className={`data-table__row${onRowClick ? " data-table__row--clickable" : ""}`}
                            >
                                {columns.map((column, columnIndex) => {
                                    const variant = column.renderCell
                                        ? ""
                                        : CELL_VARIANTS[String(column.accessor)] ?? "";
                                    const align = column.align ? ` data-table__td--${column.align}` : "";
                                    return (
                                        <td
                                            key={`${String(column.accessor)}-${columnIndex}`}
                                            className={`data-table__td${variant ? ` ${variant}` : ""}${align}`}
                                        >
                                            {column.renderCell ? column.renderCell(row) : String(row[column.accessor])}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
