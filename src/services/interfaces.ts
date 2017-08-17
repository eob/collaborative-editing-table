import {ITable, ITransform, IVectorClock, IRow, IColumn, ICell, INumberedIndex, RowId, ColumnId, ColumnType} from "../data/interfaces";

/*
 * Represents hte public interface to a table.
 */
export interface ITableService {
  getRowIdsAndIndices() : INumberedIndex<RowId>;
  getRowIdAtIndex(index: number) : RowId;

  getRowById(rowId: RowId) : IRow;
  createRow(rowId: RowId);
  destroyRow(rowId: RowId);
  moveRow(rowId: RowId, targetIndex: number);
  
  getColumn(colunId: ColumnId) : IColumn;
  createColumn(columnId: ColumnId, columnType: ColumnType)
  destroyColumn(columnId: ColumnId)
  updateColumnType(columnId: ColumnId, columnType: ColumnType)

  getCell(rowId: RowId, columnId: ColumnId) : ICell;
  getCellValue(rowId: RowId, columnId: ColumnId) : string | number;
  updateTextCellValue(rowId: RowId, columnId: ColumnId, cellValue: string)
  updateNumberCellValue(rowId: RowId, columnId: ColumnId, cellValue: number)

  // For testing
  // -----------
  rowCount(): number;
  columnCount(): number;
}

/*
 * Represents the client
 */
export interface IClient extends ITableService {
  // Puts the client in an "offline" state. It can notify the server when
  // going offline, but all further communication with the server is 
  // prohibited while offline.
  goOffline()
  
  // Opposite of goOffline; it can now sync any pending changes with the server.
  comeOnline()  

  // Called when transforms from the server are available, along with the server's current clock
  onTransformsAvailable(transforms: any[], serverClock: IVectorClock);

  // Fetches the client's clock. This is used by the connection class.
  getVersion(): IVectorClock;

  name: string;
  table: any;
}

export interface IServer {
  table: ITableService;

  // The "Endpoint" clients call to sync.
  // - transforms: any new transforms they want to provide
  // - clientVersion: the client's current clock
  // - fromConnection: the connection object this sync is being performed over
  clientSync(transforms: any[], clientVersion: IVectorClock, fromConnection: IConnection);

  // Registers a new client connection with the server
  addConnection(connection: IConnection);
}

/* 
 * Connection from a client to the server.
 * 
 * The methods on this class simulate the wire protocol.
 */
export interface IConnection {
  // Connectivity
  goOffline()
  comeOnline()

  // Methods for the server
  // ----------------------
  
  // "Endpoints" for the server to call to inquire about the remote client
  getClientVersion() : IVectorClock;
  getClientId() : string;
  // Send message to the client
  receiveFromServer(transforms: ITransform[], serverClock: IVectorClock);


  // Methods for the client to call
  // -------------------------------

  // Begin the connection.
  setClient(client: IClient);

  // Sends transforms to server
  sendToServer(transforms: ITransform[]);

}