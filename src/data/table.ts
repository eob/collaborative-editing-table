// Interfaces
import {IVectorClock, ITable, IRow, ICell, IColumn, ITransform, INumberedIndex, RowId, ColumnId, ColumnType} from "../data/interfaces";

// Libraries
import {VersionedValue} from "./versioned_value";
import {VectorClock} from "./vector_clock";

import * as debug from 'debug';
const Log = debug('synctable:table');
const LogError = debug('synctable:table:error');

export class Row implements IRow {
  deleted: VersionedValue<boolean>
  cells: Map<ColumnId, ICell>;

  constructor() {
    this.deleted = new VersionedValue(false);
    this.cells = new Map<ColumnId, ICell>();
  }
}

/* 
 */
export class Table {
  data : ITable;
  vectorClock: IVectorClock;
  id: string;

  constructor(id: string, table?: ITable, vectorClock?: IVectorClock) {
    this.id = id;

    if (table) {
      this.data = table;
    } else {
      // Initialize a new table.
      this.data = {
        rows: new Map<RowId, IRow>(),
        rowIndices: [],
        columns: new Map<ColumnId, IColumn>()
      }
    }

    this.vectorClock = vectorClock || new VectorClock();
    if (!this.vectorClock.clock.has(this.id)) {
      this.vectorClock.set(this.id, 1);
    }
  }

  getVersion() : IVectorClock {
    return new VectorClock(this.vectorClock.entries());
  }

  incrementVersion() : IVectorClock {
    this.vectorClock.increment(this.id);
    let toReturn = new VectorClock(this.vectorClock.entries());
    return toReturn;
  }

  applyTransform(transform: ITransform) : IVectorClock {
    Log(`[${this.id}] Performing operation ${transform.type}`)

    if (transform.clock) {
      this.vectorClock.updateWith(transform.clock);
    }

    switch (transform.type) {
      case 'row-create':
        let clock = this.createRow(transform.address.rowId);
        return clock;
      case 'row-destroy':
        return this.destroyRow(transform.address.rowId);
      case 'row-move':
        return this.moveRow(transform.address.rowId, transform.argument);
      case 'col-create':
        return this.createColumn(transform.address.columnId, transform.argument);
      case 'col-destroy':
        return this.destroyColumn(transform.address.columnId);
      case 'col-set-type':
        return this.updateColumnType(transform.address.columnId, transform.argument);      
      case 'cell-set-string':
        return this.updateTextCellValue(transform.address.rowId, transform.address.columnId, transform.argument);              
      case 'cell-set-number':
        return this.updateNumberCellValue(transform.address.rowId, transform.address.columnId, transform.argument);              
      default:
        LogError(`[${this.id}] Unknown transform type ${transform.type}`)
        throw new Error("Unknown transform type: " + transform.type);
    }
  }

  getRowIdsAndIndices() : INumberedIndex<RowId> {
    return this.data.rowIndices;
  }

  getRowIdAtIndex(index: number) : RowId {
    if ((index >= 0) && (index < this.data.rowIndices.length)) {
      return this.data.rowIndices[index];
    }
    return undefined;
  }

  getIndexForRowId(rowId: RowId) : number {
    return this.data.rowIndices.indexOf(rowId);
  }

  getRowById(rowId: RowId) : IRow {
    let row = this.data.rows.get(rowId);
    if (row && (row.deleted.value === false)) {
      return row;
    }
  }

  /*
   * If the rowId doesn't exist, adds a new row.
   * If the rowId does exist, updates 
   */
  createRow(rowId: RowId) : IVectorClock {
    let row = this.data.rows.get(rowId);
    if (row) {
      if (row.deleted.value === true) {
        // Undelete the row, incrementing the table's version
        let newVersion = this.incrementVersion();
        row.deleted.set(false, newVersion);
        Log(`[${this.id}] Undeleted row ${rowId}`)
        this.data.rowIndices.push(rowId);
        return new VectorClock(newVersion.entries());
      } else {
        return new VectorClock(row.deleted.version.entries());
      }
    } else {
      // Create a new row, incrementing the table's version
      let newVersion = this.incrementVersion();
      let newRow : IRow = {
        deleted: new VersionedValue<boolean>(false, newVersion),
        cells: new Map<ColumnId, ICell>()
      }      
      this.data.rows.set(rowId, newRow);
      this.data.rowIndices.push(rowId);
      Log(`[${this.id}] Created new row ${rowId}`) 
      return new VectorClock(newVersion.entries());      
    }
  }
  
  destroyRow(rowId: RowId) : IVectorClock {
    let row = this.data.rows.get(rowId);
    if (row) {
      if (row.deleted.value === false) {
        let newVersion = this.incrementVersion();
        row.deleted.set(true, newVersion);

        let idx = this.data.rowIndices.indexOf(rowId);
        if (idx == -1) {
          LogError(`[${this.id}] Row to delete not found in index ${rowId}`);
        }
        this.data.rowIndices.splice(idx, 1);
        Log(`[${this.id}] Deleted row ${rowId}`);
        return new VectorClock(newVersion.entries());        
      } else {
        LogError(`[${this.id}] Not deleting - row already deleted ${rowId}`)
        return new VectorClock(row.deleted.version.entries());
      }
    } else {
      LogError(`[${this.id}] Not deleting - row not present ${rowId}`)
      throw new Error(`[${this.id}] Not deleting - row not present ${rowId}`)
    }
  }

  moveRow(rowId: RowId, targetIndex: number) : IVectorClock {
    let idx = this.data.rowIndices.indexOf(rowId);
    if (idx == -1) {
      LogError(`[${this.id}] Can't move row: not found ${rowId}`);
      throw new Error(`[${this.id}] Can't move row: not found ${rowId}`);
    }

    let a = Array.from(this.data.rowIndices);
    
    // Remove the old index
    a.splice(idx, 1);

    // Insert it back in
    a.splice(targetIndex, 0, rowId);

    this.data.rowIndices = a;
    Log(`[${this.id}] Moved row ${rowId} to index ${targetIndex}`);

    // This incremented version will get stamped to the transform.
    return this.incrementVersion();    
  }

  getColumn(columnId: ColumnId) : IColumn {
    return this.data.columns.get(columnId);
  }

  createColumn(columnId: ColumnId, columnType: ColumnType) : IVectorClock {
    if ((columnType != 'text') && (columnType != 'number')) {
      LogError(`[${this.id}] Not creating column with invalid type ${columnType}`);
      throw new Error(`[${this.id}] Not creating column with invalid type ${columnType}`);
    }
    let col = this.data.columns.get(columnId);
    if (col) {
      if (col.deleted.value === true) {
        // Undelete the row, incrementing the table's version
        let newVersion = this.incrementVersion();
        col.deleted.set(false, newVersion);
        col.columnType.set(columnType, newVersion);        
        Log(`[${this.id}] Created column via undelete ${columnId} : ${columnType}`)
        return new VectorClock(newVersion.entries());        
      } else {
        let newVersion = this.incrementVersion();
        col.columnType.set(columnType, newVersion);
        LogError(`[${this.id}] Updating column, but col already existed ${columnId}`)
        return new VectorClock(newVersion.entries());        
      }
    } else {
      // Create a new row, incrementing the table's version
      let newVersion = this.incrementVersion();      
      let newCol : IColumn = {
        deleted: new VersionedValue<boolean>(false, newVersion),
        columnType: new VersionedValue<ColumnType>(columnType, newVersion)
      }    
      this.data.columns.set(columnId, newCol);
      Log(`[${this.id}] Created column ${columnId} : ${columnType}`)
      return new VectorClock(newVersion.entries());      
    }
  }

  destroyColumn(columnId: ColumnId) : IVectorClock {
    let col = this.data.columns.get(columnId);
    if (col) {
      if (col.deleted.value === false) {
        // Undelete the row, incrementing the table's version
        let newVersion = this.incrementVersion();
        col.deleted.set(true, newVersion);
        Log(`[${this.id}] Deleted col ${columnId}`) 
        return new VectorClock(newVersion.entries());        
      } else {
        LogError(`[${this.id}] Not deleting - col already deleted ${columnId}`)
        return this.getVersion();
      }
    } else {
      LogError(`[${this.id}] Not deleting - col not present ${columnId}`)
      throw new Error(`[${this.id}] Not deleting - col not present ${columnId}`)
    }
  }

  updateColumnType(columnId: ColumnId, columnType: ColumnType) : IVectorClock {
    if ((columnType != 'text') && (columnType != 'number')) {
      LogError(`[${this.id}] Not updating column with invalid type ${columnType}`);
      throw new Error(`[${this.id}] Not updating column with invalid type ${columnType}`);
    }
    let col = this.data.columns.get(columnId);
    if (col) {
      if (col.deleted.value === false) {
        let newVersion = this.incrementVersion();
        col.columnType.set(columnType, newVersion);
        return new VectorClock(newVersion.entries());        
      }
      return this.getVersion();
    } else {
      throw new Error(`[${this.id}] Can not update column that does not exist ${columnId}`);      
    }    
  }

  getCell(rowId: RowId, columnId: ColumnId) : ICell {
    let row = this.data.rows.get(rowId);
    if (row) {
      let cell = row.cells.get(columnId);
      if (cell) {
        return cell;
      } else {
        // Explicitly return undefined in the event of a bad address.
        return undefined;
      }
    } else {
      // Explicitly return undefined in the event of a bad address.
      return undefined;
    }
  }

  getCellValue(rowId: RowId, columnId: ColumnId) : any {
    let row = this.data.rows.get(rowId);
    let col = this.data.columns.get(columnId);
    if (!col) {
      // There is no column defined for this cell.
      return undefined;
    }

    if (row) {
      let cell = row.cells.get(columnId);
      if (cell) {
        switch (col.columnType.value) {
          case 'text':
            return ''+cell.value.value;
          case 'number':
            try {
              let f = parseFloat(cell.value.value);
              if (isNaN(f)) return undefined;
              return f;
            } catch(ex) {
              // The value couldn't be coerced into a float.
              return undefined;
            }
          default:
            // Under normal operation this line should never be executed.
            return undefined;
        }        
      } else {
        // Explicitly return undefined in the event of a bad address.
        return undefined;
      }
    } else {
      // Explicitly return undefined in the event of a bad address.
      return undefined;
    }
  }

  updateTextCellValue(rowId: RowId, columnId: ColumnId, cellValue: string) : IVectorClock {
    let row = this.data.rows.get(rowId);
    if (row) {
      let cell = row.cells.get(columnId);
      let newVersion = this.incrementVersion();
      if (cell) {
        cell.value.set(cellValue, newVersion);        
      } else {
        row.cells.set(columnId, {
          value: new VersionedValue<any>(cellValue, newVersion)
        });
      }
      return new VectorClock(newVersion.entries());      
    } else {
      LogError(`[${this.id}] Not updating - cell not present ${rowId}, ${columnId}`)
      throw new Error(`[${this.id}] Not updating - cell not present ${rowId}, ${columnId}`)
    }
  }

  updateNumberCellValue(rowId: RowId, columnId: ColumnId, cellValue: number) : IVectorClock {
    let row = this.data.rows.get(rowId);
    if (row) {
      let cell = row.cells.get(columnId);
      let newVersion = this.incrementVersion();
      if (cell) {
        cell.value.set(cellValue, newVersion);        
      } else {
        row.cells.set(columnId, {
          value: new VersionedValue<any>(cellValue, newVersion)
        });
      }
      return new VectorClock(newVersion.entries());            
    } else {
      LogError(`[${this.id}] Not updating - cell not present ${rowId}, ${columnId}`)
      throw new Error(`[${this.id}] Not updating - cell not present ${rowId}, ${columnId}`)
    }
  }

  // For testing
  // -----------
  rowCount(): number {
    let cnt = 0;
    for (let row of Array.from(this.data.rows.values())) {
      if (row.deleted.value === false) {
        cnt++;
      }
    }
    return cnt;
  }

  columnCount(): number {
    let cnt = 0;
    for (let col of Array.from(this.data.columns.values())) {
      if (col.deleted.value === false) {
        cnt++;
      }
    }
    return cnt;
  }
}