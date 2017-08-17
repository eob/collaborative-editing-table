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
  describe('Making Conflicting Changes', () => {

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

    it(`should accept the server's last version of a conflicting cell value`, () => {
      let rowId = hat(); // Randomize  
      let colId = hat(); // Randomize  
      let ct :ColumnType = 'text';
      let val1 = hat();
      let val2 = hat();
      let val3 = hat();
      let val4 = hat();

      clientA.createRow(rowId);      
      clientA.createColumn(colId, ct);

      clientA.goOffline();
      clientB.goOffline();

      clientA.updateTextCellValue(rowId, colId, val1);
      clientB.updateTextCellValue(rowId, colId, val2);

      expect(clientA.getCellValue(rowId, colId)).equals(val1);
      expect(clientB.getCellValue(rowId, colId)).equals(val2);

      // The return to connectivity with the server is important here.
      // We'll do the opposite order next.
      clientA.comeOnline();
      clientB.comeOnline(); // Since B is the last to come online, it is the last to write to the cell.

      expect(clientA.getCellValue(rowId, colId)).equals(val2);
      expect(clientB.getCellValue(rowId, colId)).equals(val2);
      expect(server.table.getCellValue(rowId, colId)).equals(val2);

      // Now we'll do the opposite order
      clientA.goOffline();
      clientB.goOffline();

      clientA.updateTextCellValue(rowId, colId, val3);
      clientB.updateTextCellValue(rowId, colId, val4);

      clientB.comeOnline(); 
      clientA.comeOnline(); // Since A is the last to come online, it is the last to write to the cell.

      expect(clientA.getCellValue(rowId, colId)).equals(val3);
      expect(clientB.getCellValue(rowId, colId)).equals(val3);
      expect(server.table.getCellValue(rowId, colId)).equals(val3);

    });

    it(`should accept the server's last version of a conflicting column type`, () => {
      let rowId = hat(); // Randomize  
      let colId = hat(); // Randomize  
      let ct1:ColumnType = 'text';
      let ct2:ColumnType = 'number';
      let ct3:ColumnType = 'text';
      let ct4:ColumnType = 'number';

      clientA.createRow(rowId);      
      clientA.createColumn(colId, ct1);

      clientA.goOffline();
      clientB.goOffline();

      clientA.updateColumnType(colId, ct1);
      clientB.updateColumnType(colId, ct2);

      expect(clientA.getColumn(colId).columnType.value).equals(ct1);
      expect(clientB.getColumn(colId).columnType.value).equals(ct2);

      // The return to connectivity with the server is important here.
      // We'll do the opposite order next.
      clientA.comeOnline();
      clientB.comeOnline(); // Since B is the last to come online, it is the last to write to the cell.

      expect(clientA.getColumn(colId).columnType.value).equals(ct2);
      expect(clientB.getColumn(colId).columnType.value).equals(ct2);
      expect(server.table.getColumn(colId).columnType.value).equals(ct2);

      // Now we'll do the opposite order
      clientA.goOffline();
      clientB.goOffline();

      clientA.updateColumnType(colId, ct3);
      clientB.updateColumnType(colId, ct4);

      expect(clientA.getColumn(colId).columnType.value).equals(ct3);
      expect(clientB.getColumn(colId).columnType.value).equals(ct4);

      clientB.comeOnline(); 
      clientA.comeOnline(); // Since A is the last to come online, it is the last to write to the cell.

      expect(clientA.getColumn(colId).columnType.value).equals(ct3);
      expect(clientB.getColumn(colId).columnType.value).equals(ct3);
      expect(server.table.getColumn(colId).columnType.value).equals(ct3);

    });

    it(`should return undefined when unable to coerce to number`, () => {
      let row1 = hat(); // Randomize  
      let row2 = hat(); // Randomize  
      let row3 = hat(); // Randomize  
      let row4 = hat(); // Randomize  

      let colId = hat(); // Randomize  
      let ct1:ColumnType = 'text';
      let ct2:ColumnType = 'number';
      let ct3:ColumnType = 'text';
      let ct4:ColumnType = 'number';

      clientA.createRow(row1);      
      clientA.createRow(row2);            

      clientA.createColumn(colId, ct1);

      clientA.updateTextCellValue(row1, colId, '0');
      clientA.updateTextCellValue(row2, colId, '3');

      clientA.goOffline();
      clientB.goOffline();

      clientA.createRow(row3);
      clientB.createRow(row4);

      // At this point, thecolumn is of typt text.

      clientA.updateTextCellValue(row3, colId, 'five');
      clientB.updateTextCellValue(row4, colId, '-3.3');

      clientA.updateColumnType(colId, ct1);

      // No change to A.
      expect(clientA.getCellValue(row1, colId)).equals('0');
      expect(clientA.getCellValue(row2, colId)).equals('3');
      expect(clientA.getCellValue(row3, colId)).equals('five');

      clientB.updateColumnType(colId, ct2);
      expect(clientB.getCellValue(row1, colId)).equals(0);
      expect(clientB.getCellValue(row2, colId)).equals(3);
      expect(clientB.getCellValue(row4, colId)).equals(-3.3);

      expect(clientA.getColumn(colId).columnType.value).equals(ct1);
      expect(clientB.getColumn(colId).columnType.value).equals(ct2);

      // The return to connectivity with the server is important here.
      // We'll do the opposite order next.
      clientA.comeOnline();
      clientB.comeOnline(); // Since B is the last to come online, it is the last to write to the cell.

      // At this point, the reigning column type between both is NUMBER.
      expect(clientA.getCellValue(row1, colId)).equals(0);
      expect(clientA.getCellValue(row2, colId)).equals(3);
      expect(clientA.getCellValue(row3, colId)).to.be.undefined;
      expect(clientA.getCellValue(row4, colId)).equals(-3.3);
  
    });
  });
});