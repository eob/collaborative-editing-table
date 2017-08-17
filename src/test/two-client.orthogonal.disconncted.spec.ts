// Interfaces
import {IConnection, IServer, IClient} from "../services/interfaces";
import {ColumnType} from "../data/interfaces";

// Libraries
import {Server} from "../services/server";
import {Client} from "../services/client";
import {LocalSynchronousConnection as Connection} from "../services/local_synchronous_connection";

import 'mocha';
import { assert, expect } from 'chai';
import hat = require('hat');

describe('Two Clients', () => {
  describe('Making Disconnectd Orthogonal Changes', () => {

    let server: IServer, 
        clientA: IClient,
        clientB: IClient,
        connectionA: IConnection,
        connectionB: IConnection;
    
    beforeEach(() => {
      server = new Server("Server");

      connectionA = new Connection(server);
      clientA = new Client('Client A', connectionA);    
      
      connectionB = new Connection(server);
      clientB = new Client('Client B', connectionB);    
    });

    afterEach(() => {
      server = null;
      connectionA = null;
      connectionB = null;
      clientA = null;
      clientB = null;
    });

    it(`should sync a row from one to the other`, () => {
      let rowId = hat(); // Randomize  
      let rowId2 = hat(); // Randomize  
      
      connectionB.goOffline();

      clientA.createRow(rowId);      
      expect(clientA.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
      expect(clientB.rowCount()).equals(0);

      clientB.createRow(rowId2);      
      expect(clientA.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
      expect(clientB.rowCount()).equals(1);
    
      connectionA.goOffline();
      connectionB.comeOnline();

      expect(clientA.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(2);
      expect(clientB.rowCount()).equals(2);
      
      connectionA.comeOnline();
      expect(clientA.rowCount()).equals(2);
      expect(server.table.rowCount()).equals(2);
      expect(clientB.rowCount()).equals(2);
    });

    it(`should destroy a row`, () => {
      let rowId = hat(); // Randomize  
      clientA.createRow(rowId);
      expect(clientA.rowCount()).equals(1);
      expect(clientB.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);

      connectionA.goOffline();
      connectionB.goOffline();
      clientA.destroyRow(rowId);
      expect(clientA.rowCount()).equals(0);
      expect(clientB.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);

      connectionA.comeOnline();
      expect(clientA.rowCount()).equals(0);
      expect(server.table.rowCount()).equals(0);

      expect(clientB.rowCount()).equals(1);
      expect(clientB.getRowIdAtIndex(0)).equals(rowId);      
      connectionB.comeOnline();

      expect(clientA.rowCount()).equals(0);
      expect(clientB.rowCount()).equals(0);
      expect(server.table.rowCount()).equals(0);
      expect(clientB.getRowIdAtIndex(0)).to.be.undefined;      
    });

    it(`should move a row`, () => {      
      let A = hat(); // Randomize  
      let B = hat(); // Randomize  
      let C = hat(); // Randomize  
      let D = hat(); // Randomize  
      
      connectionB.goOffline();
      connectionA.goOffline();
      clientA.createRow(A);
      clientA.createRow(B);
      clientA.createRow(C);
      clientA.createRow(D);

      connectionA.comeOnline();
      connectionB.comeOnline();

      expect(clientA.getRowIdAtIndex(0)).equals(A);
      expect(clientA.getRowIdAtIndex(1)).equals(B);
      expect(clientA.getRowIdAtIndex(2)).equals(C);
      expect(clientA.getRowIdAtIndex(3)).equals(D);
      
      expect(clientB.getRowIdAtIndex(0)).equals(A);
      expect(clientB.getRowIdAtIndex(1)).equals(B);
      expect(clientB.getRowIdAtIndex(2)).equals(C);
      expect(clientB.getRowIdAtIndex(3)).equals(D);

      connectionA.goOffline();
      connectionB.goOffline();
      
      // ABC -> BAC. Start removal and mid insertion.
      clientB.moveRow(A, 1);
      clientA.moveRow(C, 3);

      connectionA.comeOnline();
      connectionB.comeOnline();

      expect(clientA.getRowIdAtIndex(0)).equals(B);
      expect(clientA.getRowIdAtIndex(1)).equals(A);
      expect(clientA.getRowIdAtIndex(2)).equals(D);
      expect(clientA.getRowIdAtIndex(3)).equals(C);
      
      expect(clientB.getRowIdAtIndex(0)).equals(B);
      expect(clientB.getRowIdAtIndex(1)).equals(A);
      expect(clientB.getRowIdAtIndex(2)).equals(D);
      expect(clientB.getRowIdAtIndex(3)).equals(C);
    });

    it(`should create a column`, () => {
      let colId = hat();
      let colType:ColumnType = 'text';

      connectionA.goOffline();
      connectionB.goOffline();

      clientA.createColumn(colId, colType);

      expect(clientA.columnCount()).equals(1);
      expect(clientB.columnCount()).equals(0);
      expect(server.table.columnCount()).equals(0);

      connectionA.comeOnline();

      expect(clientA.columnCount()).equals(1);
      expect(clientB.columnCount()).equals(0);
      expect(server.table.columnCount()).equals(1);

      connectionB.comeOnline();

      expect(clientA.columnCount()).equals(1);
      expect(clientB.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);

      expect(clientA.getColumn(colId).columnType.value).equals(colType);
      expect(clientB.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType);
    });

    it(`should destroy a column`, () => {
      let colId = hat();
      clientA.createColumn(colId, "text");
      expect(clientA.columnCount()).equals(1);
      expect(clientB.columnCount()).equals(1);

      connectionB.goOffline();

      expect(server.table.columnCount()).equals(1);
      clientA.destroyColumn(colId);
      expect(clientA.columnCount()).equals(0);
      expect(server.table.columnCount()).equals(0);      
      expect(clientB.columnCount()).equals(1);
      
      connectionB.comeOnline();
      expect(clientB.columnCount()).equals(0);
    });

    it(`should update a column type`, () => {
      let colId = hat();
      let colType : ColumnType= 'text';

      clientB.createColumn(colId, colType);
      expect(clientA.columnCount()).equals(1);
      expect(clientB.columnCount()).equals(1);

      expect(server.table.columnCount()).equals(1);

      expect(clientA.getColumn(colId).columnType.value).equals(colType);
      expect(clientB.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType);

      let colType2 : ColumnType = 'number';

      connectionB.goOffline();
      clientA.updateColumnType(colId, colType2);

      expect(clientA.getColumn(colId).columnType.value).equals(colType2);
      expect(clientB.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType2);    

      connectionB.comeOnline();
      expect(clientB.getColumn(colId).columnType.value).equals(colType2);      
    });

    it(`should update a text cell value`, () => {
      let rowId = hat();
      let colId = hat();
      let colType : ColumnType = "text";

      clientA.createColumn(colId, colType);
      clientB.createRow(rowId);

      let value = hat();
      clientA.updateTextCellValue(rowId, colId, value);
      expect(clientA.getCell(rowId, colId).value.value).equals(value);
      expect(clientB.getCell(rowId, colId).value.value).equals(value);

      connectionA.goOffline();

      let value2 = hat();
      clientB.updateTextCellValue(rowId, colId, value2);
      expect(clientA.getCell(rowId, colId).value.value).equals(value);
      expect(clientB.getCell(rowId, colId).value.value).equals(value2);

      connectionA.comeOnline();
      expect(clientA.getCell(rowId, colId).value.value).equals(value2);            
    });
  });
});