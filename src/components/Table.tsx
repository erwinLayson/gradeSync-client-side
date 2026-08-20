import type { ReactNode } from "react";

export type TableColumns<T> = {
    headers: string,
    accessor: keyof T,
    /** Optional custom cell renderer (e.g. action buttons). Defaults to the raw cell value. */
    renderCell?: (row: T) => ReactNode
};


type TableColumnsProps<T> = {
    columns: TableColumns<T>[];
    data: T[];
    /** Optional function returning a stable key per row. Defaults to the row index. */
    rowKey?: (row: T) => string | number;
    /** Optional handler fired when a row is clicked (e.g. to open a detail view). */
    onRowClick?: (row: T) => void;
};

// Maps a column accessor to a cell styling variant from adminStudent.css.
// Falls back to the default cell style for columns without a variant.
const CELL_VARIANTS: Record<string, string> = {
    id: "students__cell--id",
    lrn: "students__cell--lrn",
    fullname: "students__cell--name",
    email: "students__cell--email"
};

export default function Table<T>({columns, data, rowKey, onRowClick }: TableColumnsProps<T>) {
    return (
        <div className="students__table-wrap overflow-x-auto">
            <table className="students__table w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                    <tr>
                        {columns.map((column, columnIndex) => (
                            <th key={`${String(column.accessor)}-${columnIndex}`} scope="col" className="px-6 py-3">
                                {column.headers}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr
                            key={rowKey ? rowKey(row) : index}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            className={onRowClick ? "cursor-pointer" : ""}
                        >
                            {columns.map((column, columnIndex) => (
                                <td key={`${String(column.accessor)}-${columnIndex}`} className={`${column.renderCell ? "" : (CELL_VARIANTS[String(column.accessor)] ?? "")} px-6 py-3.5`}>
                                    {column.renderCell ? column.renderCell(row) : String(row[column.accessor])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}