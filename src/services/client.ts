// Interfaces
import {IConnection, IClient, ITableService} from "./interfaces"
import {ITable} from "../data/interfaces"
import {IVectorClock, ICell, ITransform, RowId, ColumnId, ColumnType, LAST_WRITE_WINS_XFORMS} from "../data/interfaces";

// Libraries
import {Table} from "../data/table"
import {VectorClock} from "../data/vector_clock";

import debug = require('debug');
const Debug = debug('synctable:client:log');
const Error = debug('synctable:client:error');
const Trace = debug('synctable:client:trace');

export class Client implements IClient {
  name : string;
  table : Table;
  connection : IConnection;
  vectorClock : IVectorClock;

  constructor(name: string, connection: IConnection) {
    this.name = name;
    this.table = new Table(name);
    this.connection = connection;
    this.connection.setClient(this);
  }

  getVersion(): IVectorClock {
    let v = this.table.getVersion();
    Trace(`${this.name} returning version ${v.toString()}`)
    return v;
  }
  
  /*
   * Comments
   * --------
   * 
   * I've chosen to place all the "smarts" of the OT logic inside the 
   * Client so as to not bottleneck the server. This allows the server 
   * to simply focus on applying transforms as they are received, while
   * the burden is on clients to keep up and repair any conflicts that arise
   * from concurrent updates.
   *
   * Assumptions
   * ------------
   *   For transforms i, j in the provided argument,
   *   i < j ==> transform[i].clock < transform[j].clock
   * 
   */
  onTransformsAvailable(transforms : ITransform[], serverClock: IVectorClock) {  
    let lastWriteWinsResolved = new Set<string>();
    let transformsToApply = [];
    let rowsDeleted = new Map<string, boolean>();

    /* 
     * Stage 1: Conflicts whose resolution is simply "Last Write Wins"
     * 
     * For pieces of state with strictly "Last Write Wins" semantics,
     * filter the incoming transforms so that our notion of "last write" is
     * consistent with the server's notion.
     */
    for (let i = transforms.length - 1; i >= 0; i--) {
      if (LAST_WRITE_WINS_XFORMS[transforms[i].type] === true) {
        let transformTypeAndId = this._transformTypeAndAddress(transforms[i]);
        if (lastWriteWinsResolved.has(transformTypeAndId)) {
          // We can simply skip this transform. It's been overcome by a later transform.
          // NOOP Intended.
        } else {          
          lastWriteWinsResolved.add(transformTypeAndId);
          if (transforms[i].source != this.name) {
            // We mark the transform either way, but we only apply if it's not ours
            // Note: Inefficiently implementing this for clarity of overall algorithm.
            transformsToApply = [transforms[i], ...transformsToApply];
          }
        }
      } else {
        // For now, we will simply append if it's not our.
        if (transforms[i].source != this.name) {
          transformsToApply = [transforms[i], ...transformsToApply];
        }
      } 
      
      // Keep track of the final delete/undelete status
      if (transforms[i].type == 'row-destroy') {
        if (! rowsDeleted.has(transforms[i].address.rowId)) {
          rowsDeleted.set(transforms[i].address.rowId, true);
        }
      }
      if (transforms[i].type == 'row-create') {
        if (! rowsDeleted.has(transforms[i].address.rowId)) {
          rowsDeleted.set(transforms[i].address.rowId, false);
        }
      }
    }

    /*
     * Stage 2: Conflicts whose resolution requires patching up history. 
     * 
     * Now we have to amend the transaction log to resolve divergences between server state
     * and our own. In this toy implementation, these divergences are entirely issues of row
     * index.
     * 
     * A divergence occurs if this client locally issued an index-affecting trasform after
     * some other transform we're only just now learning about.
     * 
     */

    let weInserted = {};
    let weMoved = {};
    let remotelyDestroyedIndices = new Set<number>();

    /*
     * Working backwards, for every local creation or deletion in the server's eyes
     * (which already happened locally) add its index.
     * 
     * Then for every operation which impacts its ordering, that happened remotely
     * we need to nudge the index to align our ordering with the server's ordering.
     */
    for (let i = transforms.length - 1; i >= 0; i--) {
      if (transforms[i].source == this.name) {
        // This was ours. Log it.
        if (transforms[i].type == 'row-create') {
          let rowId = transforms[i].address.rowId;
          let rowIndex = this.table.getIndexForRowId(rowId);
          // We need to offset it by how many rows were destroyed.          
          weInserted[rowId] = rowIndex;                    
          Trace(`My Create ${transforms[i].clock.toString()}`);
        } else if (transforms[i].type == 'row-move') {
          let rowId = transforms[i].address.rowId;
          weMoved[rowId] = transforms[i].argument;
        }                
      } else {
        // This was from another client. If it impacts the inserts, we'll need to move.
        if (transforms[i].type == 'row-create') {
          // We are going to need to post-hoc bump the index of these rows up
          for (var rowId in weInserted) {
            weInserted[rowId] = weInserted[rowId] + 1;
          }
          Trace(`Other Create ${JSON.stringify(transforms[i])}`);
        } else if (transforms[i].type == 'row-destroy') {
          let detsroyedIndex = this.table.getIndexForRowId(transforms[i].address.rowId);
          remotelyDestroyedIndices.add(detsroyedIndex);
          Trace(`Other Destroy ${detsroyedIndex} ${JSON.stringify(transforms[i])}`);
        } else if (transforms[i].type == 'row-move') {
          let fromIndex = this.table.getIndexForRowId(rowId);
          let toIndex = transforms[i].argument;          
          for (var rowId in weMoved) {
            if (toIndex < weMoved[rowId]) {
              transforms[i].argument -= 1; // Nudge the transform left.
            } else if (toIndex > weMoved[rowId]) {
              transforms[i].argument += 1; // Nudge the transform right
            }
          }
        }
      } 
    }

    for (let rowId in weInserted) {
      // Only issue a corrective transform here if this row was not eventually deleted.
      if (!(rowsDeleted.get(rowId) == true)) {
        let correctiveTransform = {
          source: this.name,
          type: 'row-move',
          address: {rowId: rowId},
          argument: weInserted[rowId]
        }
        Debug(`[${this.name}] Created corrective transform ${JSON.stringify(correctiveTransform)}`);
        transformsToApply.push(correctiveTransform);
      }
    }

    for (let rowId in weMoved) {
      // Only issue a corrective transform here if this row was not eventually deleted.
      if (!(rowsDeleted.get(rowId) == true)) {
        let correctiveTransform = {
          source: this.name,
          type: 'row-move',
          address: {rowId: rowId},
          argument: weMoved[rowId]
        }
        Debug(`[${this.name}] Created corrective transform ${JSON.stringify(correctiveTransform)}`);
        transformsToApply.push(correctiveTransform);
      }
    }
    
    Debug(`[${this.name}] Applying ${transformsToApply.length} of ${transforms.length} received updates.`)

    for (let transform of transformsToApply) {
      Trace(JSON.stringify(transform));
      this.applyTransform(transform);
    }

    // Finally we update our own clock to reflect
    this.table.vectorClock.updateWith(serverClock);
    Debug(`[${this.name}] Clock updated to ${this.table.vectorClock.toString()}.`)
    
  }

  applyTransform(transform: ITransform) : IVectorClock {
    return this.table.applyTransform(transform);
  }

  applyLocalTransform(transform: ITransform) : IVectorClock {
    let clock = this.applyTransform(transform);
    transform.clock = clock; 
    this.connection.sendToServer([transform]);
    return clock;
  }

  getRowIdsAndIndices() {
    return this.table.getRowIdsAndIndices();
  }

  getRowIdAtIndex(index: number) {
    return this.table.getRowIdAtIndex(index);
  }

  getRowById(rowId: RowId) {
    return this.table.getRowById(rowId);
  }

  rowCount() : number {
    return this.table.rowCount();
  }

  createRow(rowId: RowId) {
    return this.applyLocalTransform({source: this.name, type: 'row-create', address: {rowId: rowId}})
  }

  destroyRow(rowId: RowId) {
    return this.applyLocalTransform({source: this.name, type: 'row-destroy', address: {rowId: rowId}})
  }

  moveRow(rowId: RowId, targetIndex: number) {
    return this.applyLocalTransform({source: this.name, type: 'row-move', address: {rowId: rowId}, argument: targetIndex})
  }
  
  getColumn(columnId: ColumnId) {
    return this.table.getColumn(columnId);
  }

  columnCount() : number {
    return this.table.columnCount();
  }

  createColumn(columnId: ColumnId, columnType: ColumnType) {
    return this.applyLocalTransform({source: this.name, type: 'col-create', address: {columnId: columnId}, argument: columnType})
  }

  destroyColumn(columnId: ColumnId) {
    return this.applyLocalTransform({source: this.name, type: 'col-destroy', address: {columnId: columnId}})
  }

  updateColumnType(columnId: ColumnId, columnType: ColumnType) {
    return this.applyLocalTransform({source: this.name, type: 'col-set-type', address: {columnId: columnId}, argument: columnType})
  }

  getCell(rowId: RowId, colId: ColumnId) : ICell {
    return this.table.getCell(rowId, colId);
  }

  getCellValue(rowId: RowId, colId: ColumnId) : string | number {
    return this.table.getCellValue(rowId, colId);
  }

  updateTextCellValue(rowId: RowId, columnId: ColumnId, cellValue: string) {
    return this.applyLocalTransform({source: this.name, type: 'cell-set-string', address: {rowId: rowId, columnId: columnId}, argument: cellValue})
  }

  updateNumberCellValue(rowId: RowId, columnId: ColumnId, cellValue: number) {
    return this.applyLocalTransform({source: this.name, type: 'cell-set-number', address: {rowId: rowId, columnId: columnId}, argument: cellValue})
  }

  goOffline() {
    this.connection.goOffline();
  }
  
  comeOnline() {
    this.connection.comeOnline();
  }

  /*
   * Assists with bookkeeping to prune transforms that should not be applied.
   */
  _transformTypeAndAddress(transform: ITransform) : string {
    return `${transform.type}:${transform.address.rowId}:${transform.address.columnId}`;
  }

}