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
  describe('Edge Cases and Adversarial Behavior ', () => {

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

    it(`should ignore a duplicate row creation`, () => {
      let rowId = hat(); // Randomize  
      client.createRow(rowId);
      client.createRow(rowId);
      expect(client.rowCount()).equals(1);
      expect(server.table.rowCount()).equals(1);
    });

    it(`should treat duplicate column creation as an update`, () => {
      let colId = hat();
      let colType:ColumnType = 'text';

      client.createColumn(colId, colType);
      expect(client.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);
      
      expect(client.getColumn(colId).columnType.value).equals(colType);
      expect(server.table.getColumn(colId).columnType.value).equals(colType);

      let colType2:ColumnType = 'number';
      client.createColumn(colId, colType2);

      expect(client.columnCount()).equals(1);
      expect(server.table.columnCount()).equals(1);
      
      expect(client.getColumn(colId).columnType.value).equals(colType2);
      expect(server.table.getColumn(colId).columnType.value).equals(colType2);
    });

    it(`should reject updating column type to invalid type`, () => {
      let colId = hat();
      let colType1 = 'number';
      let colType2 = 'all-digits-of-pi';
      client.createColumn(colId, <any>colType1);

      expect(() => {
        client.updateColumnType(colId, <any>colType2);
      }).to.throw(`Not updating column with invalid type`)
    });

    it(`should reject creating column type to invalid type`, () => {
      let colId = hat();
      let colType = 'all-digits-of-pi';

      expect(() => {
        client.createColumn(colId, <any>colType);
      }).to.throw(`Not creating column with invalid type`)
    });

    // Notes: we except upon these becuase they indicate there might be
    // some problem with synchronization state. Semantics which permit
    // silence in these scenarios might hide synchronization issues.

    it(`should except upon deletion of non-existant row`, () => {
      let rowName = hat();
      expect(() => {
        client.destroyRow(rowName);
      }).to.throw(`Not deleting - row not present ${rowName}`)          
    });

    it(`should except upon deletion of non-existant column `, () => {
      let colName = hat();
      expect(() => {
        client.destroyColumn(colName);
      }).to.throw(`Not deleting - col not present ${colName}`)          
    });

    it(`should except upon update of non-existant cell`, () => {
      let rowId = hat();
      let colId = hat();
      let val = hat();
      expect(() => {
        client.updateTextCellValue(rowId, colId, val);
      }).to.throw(`Not updating - cell not present ${rowId}, ${colId}`)          
      expect(() => {
        client.updateNumberCellValue(rowId, colId, val);
      }).to.throw(`Not updating - cell not present ${rowId}, ${colId}`)          

    });

  });
});