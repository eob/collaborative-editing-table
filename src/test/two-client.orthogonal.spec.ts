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
  describe('Making Orthogonal Changes', () => {

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
      clientA.createRow(rowId);      
      expect(clientA.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
      expect(clientB.rowCount()).equals(1);
    });

    it(`should destroy a row`, () => {
      let rowId = hat(); // Randomize  
      clientA.createRow(rowId);
      expect(clientA.rowCount()).equals(1);
      expect(clientB.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
      clientA.destroyRow(rowId);
      expect(clientA.rowCount()).equals(0);
      expect(clientB.rowCount()).equals(0);
      expect(server.table.rowCount()).equals(0);
    });

    it(`should move a row`, () => {      
      let A = hat(); // Randomize  
      let B = hat(); // Randomize  
      let C = hat(); // Randomize  

      clientA.createRow(A);
      clientA.createRow(B);
      clientA.createRow(C);
      
      expect(clientA.getRowIdAtIndex(0)).equals(A);
      expect(clientA.getRowIdAtIndex(1)).equals(B);
      expect(clientA.getRowIdAtIndex(2)).equals(C);

      expect(clientB.getRowIdAtIndex(0)).equals(A);
      expect(clientB.getRowIdAtIndex(1)).equals(B);
      expect(clientB.getRowIdAtIndex(2)).equals(C);


      // ABC -> BAC. Start removal and mid insertion.
      clientB.moveRow(A, 1);

      expect(clientB.getRowIdAtIndex(0)).equals(B);
      expect(clientB.getRowIdAtIndex(1)).equals(A);
      expect(clientB.getRowIdAtIndex(2)).equals(C);

      expect(clientA.getRowIdAtIndex(0)).equals(B);
      expect(clientA.getRowIdAtIndex(1)).equals(A);
      expect(clientA.getRowIdAtIndex(2)).equals(C);


      // BAC -> CBA. End removal and start insertion.
      clientA.moveRow(C, 0);

      expect(clientA.getRowIdAtIndex(0)).equals(C);
      expect(clientA.getRowIdAtIndex(1)).equals(B);
      expect(clientA.getRowIdAtIndex(2)).equals(A);

      expect(clientB.getRowIdAtIndex(0)).equals(C);
      expect(clientB.getRowIdAtIndex(1)).equals(B);
      expect(clientB.getRowIdAtIndex(2)).equals(A);
    

      // CBA -> BAC. Start removal & End insertion.
      clientA.moveRow(C, 2);

      expect(clientA.getRowIdAtIndex(0)).equals(B);
      expect(clientA.getRowIdAtIndex(1)).equals(A);
      expect(clientA.getRowIdAtIndex(2)).equals(C);

      expect(clientB.getRowIdAtIndex(0)).equals(B);
      expect(clientB.getRowIdAtIndex(1)).equals(A);
      expect(clientB.getRowIdAtIndex(2)).equals(C);
    });

    it(`should create a column`, () => {
      let colId = hat();
      let colType:ColumnType = 'text';

      clientA.createColumn(colId, colType);
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

      expect(server.table.columnCount()).equals(1);
      clientA.destroyColumn(colId);
      expect(clientA.columnCount()).equals(0);

      clientB.destroyColumn(colId);
      expect(clientB.columnCount()).equals(0);

      expect(server.table.columnCount()).equals(0);
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
      clientA.updateColumnType(colId, colType2);
      expect(clientA.getColumn(colId).columnType.value).equals(colType2);
      expect(clientB.getColumn(colId).columnType.value).equals(colType2);
      expect(server.table.getColumn(colId).columnType.value).equals(colType2);    
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

      let value2 = hat();
      clientB.updateTextCellValue(rowId, colId, value2);
      expect(clientA.getCell(rowId, colId).value.value).equals(value2);
      expect(clientB.getCell(rowId, colId).value.value).equals(value2);

    });

    it(`should update a number cell value`, () => {
      let rowId = hat();
      let colId = hat();
      let colType : ColumnType = "number";

      clientA.createColumn(colId, colType);
      clientB.createRow(rowId);

      let value = Math.random();
      clientB.updateNumberCellValue(rowId, colId, value);

      expect(clientA.getCell(rowId, colId).value.value).equals(value);
      expect(clientB.getCell(rowId, colId).value.value).equals(value);

      let value2 = Math.random();
      clientA.updateNumberCellValue(rowId, colId, value2);
      expect(clientB.getCell(rowId, colId).value.value).equals(value2);
      expect(clientA.getCell(rowId, colId).value.value).equals(value2);
    });


  });
});