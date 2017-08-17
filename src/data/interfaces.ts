// Basic placeholder types 
// =======================
export type ColumnType = "text" | "number";
export type ColumnId = string;
export type RowId = string;
export type INumberedIndex<T>  = T[];

export type RowOperationType = "row-create" | "row-destroy" | "row-move";
export type ColOperationType = "col-create" | "col-destroy" | "col-set-type";
export type CellOperationType = "cell-set-string" | "cell-set-number";
export type OperationType = RowOperationType | ColOperationType | CellOperationType;

export const LAST_WRITE_WINS_XFORMS = {
  "row-create": true,
  "row-destroy": true,
  "col-create": true,
  "col-destroy": true,
  "col-set-type": true,
  "cell-set-string": true,
  "cell-set-number": true  
}

// Table data structure
// ====================

export interface ICell {
  value: IVersionedValue<any>;
}

export interface IRow {
  cells: Map<ColumnId, ICell>;
  deleted: IVersionedValue<boolean>;
}

export interface IColumn {  
  columnType: IVersionedValue<ColumnType>;
  deleted: IVersionedValue<boolean>;
}

export interface ITable {
  rows: Map<RowId, IRow>;
  rowIndices: RowId[];
  columns: Map<ColumnId, IColumn>;
}

// Operational Transforms
// ======================

/*
 * Identifies a component of a table -- a cell, a row, or a column -- depending upon
 * the fields that are provided.
 * 
 * For a multi-table / multi-db system, this should be extended to include identifiers
 * for DB and Table.
 */
export interface ITableAddress {
  rowId?: RowId;
  columnId?: ColumnId;
}

export interface ITransform {
  // The client id
  source: string;

  type: OperationType;
  address: ITableAddress;

  // The clock tick associated with this transform
  clock?: IVectorClock;

  // Interpretation of argument type left to the sender/recipient of the message.
  argument?: any;
}

// I've left these in from my CRDT experiments
// ===========================================

export interface IVectorClock {
  set(client: string, version: number);
  increment(client: string);
  entries(): IterableIterator<[string, number]>;
  greaterThan(other:IVectorClock, restrictToClient?: string) : boolean;
  updateWith(other:IVectorClock);
  clock: Map<string, number>;
}

export interface IVersionedValue<T> {
  version: IVectorClock;
  value: T;
  set(value:T, version: IVectorClock);
}







