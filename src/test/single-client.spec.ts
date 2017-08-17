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


describe('One Client', () => {
  describe('Under Normal Operation', () => {

    let server: IServer, 
        client: IClient,
        connection: IConnection;
    
    beforeEach(() => {
      server = new Server('Server');  
      connection = new Connection(server);
      client = new Client('Client', connection);    
    });

    afterEach(() => {
      server = null;
      connection = null;
      client = null;
    });

    it(`should start with zero rows and columns`, () => {
      expect(client.rowCount()).equals(0);
      expect(client.columnCount()).equals(0);
      expect(server.table.rowCount()).equals(0);
      expect(server.table.columnCount()).equals(0);
    });

    it(`should create a row`, () => {
      let rowId = hat(); // Randomize  
      client.createRow(rowId);      
      expect(client.rowCount()).equals(1);
      expect(client.getRowIdAtIndex(0)).equals(rowId);      
      expect(server.table.rowCount()).equals(1);
      expect(server.table.getRowIdAtIndex(0)).equals(rowId);

    });

    it(`should destroy a row`, () => {
      let rowId = hat(); // Randomize  
      client.createRow(rowId);
      expect(client.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
      client.destroyRow(rowId);
      expect(client.rowCount()).equals(0);
      expect(server.table.rowCount()).equals(0);
    });

    it(`should move a row`, () => {      
      let A = hat(); // Randomize  
      let B = hat(); // Randomize  
      let C = hat(); // Randomize  

      client.createRow(A);
      client.createRow(B);
      client.createRow(C);
      
      expect(client.getRowIdAtIndex(0)).equals(A);
      expect(client.getRowIdAtIndex(1)).equals(B);
      expect(client.getRowIdAtIndex(2)).equals(C);

      // ABC -> BAC. Start removal and mid insertion.
      client.moveRow(A, 1);
      expect(client.getRowIdAtIndex(0)).equals(B);
      expect(client.getRowIdAtIndex(1)).equals(A);
      expect(client.getRowIdAtIndex(2)).equals(C);

      // BAC -> CBA. End removal and start insertion.
      client.moveRow(C, 0);
      expect(client.getRowIdAtIndex(0)).equals(C);
      expect(client.getRowIdAtIndex(1)).equals(B);
      expect(client.getRowIdAtIndex(2)).equals(A);

      // CBA -> BAC. Start removal & End insertion.
      client.moveRow(C, 2);
      expect(client.getRowIdAtIndex(0)).equals(B);
      expect(client.getRowIdAtIndex(1)).equals(A);
      expect(client.getRowIdAtIndex(2)).equals(C);
    });

    it(`should create a column`, () => {
      let colId = hat();
      let colType:ColumnType = 'text';

      client.createColumn(colId, colType);
      expect(client.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);
      
      expect(client.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType);

    });

    it(`should destroy a column`, () => {
      let colId = hat();
      client.createColumn(colId, "text");
      expect(client.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);
      client.destroyColumn(colId);
      expect(client.columnCount()).equals(0);
      expect(server.table.columnCount()).equals(0);
    });

    it(`should update a column type`, () => {
      let colId = hat();
      let colType : ColumnType= 'text';

      client.createColumn(colId, colType);
      expect(client.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);

      expect(client.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType);

      let colType2 : ColumnType = 'number';
      client.updateColumnType(colId, colType2);
      expect(client.getColumn(colId).columnType.value).equals(colType2);
      expect(server.table.getColumn(colId).columnType.value).equals(colType2);    
    });

    it(`should update a text cell value`, () => {
      let rowId = hat();
      let colId = hat();
      let colType : ColumnType = "text";

      client.createColumn(colId, colType);
      client.createRow(rowId);

      let value = hat();
      client.updateTextCellValue(rowId, colId, value);
      expect(client.getCell(rowId, colId).value.value).equals(value);

      let value2 = hat();
      client.updateTextCellValue(rowId, colId, value2);
      expect(client.getCell(rowId, colId).value.value).equals(value2);
    });

    it(`should update a number cell value`, () => {
      let rowId = hat();
      let colId = hat();
      let colType : ColumnType = "number";

      client.createColumn(colId, colType);
      client.createRow(rowId);

      let value = Math.random();
      client.updateNumberCellValue(rowId, colId, value);
      expect(client.getCell(rowId, colId).value.value).equals(value);

      let value2 = Math.random();
      client.updateNumberCellValue(rowId, colId, value2);
      expect(client.getCell(rowId, colId).value.value).equals(value2);
    });

  });
});