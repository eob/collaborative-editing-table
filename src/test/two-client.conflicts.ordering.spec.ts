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
  describe('Making Row Ordering Changes', () => {

    let server: IServer, 
        clientA: IClient,
        clientB: IClient,
        connectionA: IConnection,
        connectionB: IConnection,
        row1: string,
        row2: string,
        row3: string,
        row4: string,
        row5: string,
        row6: string,
        row7: string;      
    
    beforeEach(() => {
      server = new Server("Server");

      connectionA = new Connection(server);
      clientA = new Client('Client A', connectionA);    
      
      connectionB = new Connection(server);
      clientB = new Client('Client B', connectionB);    

      row1 = 'R1';
      row2 = 'R2';
      row3 = 'R3';
      row4 = 'R4';
      row5 = 'R5';
      row6 = 'R6';
      row7 = 'R7';

      let ct : ColumnType = 'text';
    });

    afterEach(() => {
      server = null;
      connectionA = null;
      connectionB = null;
      clientA = null;
      clientB = null;

      row1 = null;
      row2 = null;
      row3 = null;
      row4 = null;
      row5 = null;
      row6 = null;
      row7 = null;
    });

    it(`should resolve conflicting row order due to disconnected inserts`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.createRow(row3);
      clientB.createRow(row4);
      clientB.createRow(row5);

      clientA.comeOnline();
      clientB.comeOnline();

      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row1);
        expect(x.table.getRowIdAtIndex(1)).equals(row2);
        expect(x.table.getRowIdAtIndex(2)).equals(row3);
        expect(x.table.getRowIdAtIndex(3)).equals(row4);
        expect(x.table.getRowIdAtIndex(4)).equals(row5);
      }
    });

    it(`should resolve conflicting row order due to disconnected inserts (2)`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.createRow(row3);
      clientB.createRow(row4);
      clientB.createRow(row5);

      clientB.comeOnline(); // 1 2 4 5
      clientA.comeOnline(); // 1 2 4 5 3

      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row1);
        expect(x.table.getRowIdAtIndex(1)).equals(row2);
        expect(x.table.getRowIdAtIndex(2)).equals(row4);
        expect(x.table.getRowIdAtIndex(3)).equals(row5);
        expect(x.table.getRowIdAtIndex(4)).equals(row3);
      }
    });
    

    it(`should resolve conflicting row order due to disconnected inserts and deletes`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.createRow(row3); // 1 2 3

      clientB.destroyRow(row2); // 1
      clientB.createRow(row4); // 1 4
      clientB.destroyRow(row1); // 4
      clientB.createRow(row5); // 4 5

      clientA.comeOnline(); // 1 2 3
      clientB.comeOnline(); // 3 4 5

      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row3);
        expect(x.table.getRowIdAtIndex(1)).equals(row4);
        expect(x.table.getRowIdAtIndex(2)).equals(row5);
        expect(x.table.getRowIdAtIndex(3)).is.undefined;
      }
    });

    it(`should resolve conflicting row order due to disconnected inserts and deletes (2)`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);
      clientA.createRow(row3);
      clientA.createRow(row4);
      clientA.createRow(row5);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.destroyRow(row3); // 1 2 3
      clientB.createRow(row6);

      clientB.comeOnline(); // 3 4 5
      clientA.comeOnline(); // 1 2 3
      
      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row1);
        expect(x.table.getRowIdAtIndex(1)).equals(row2);
        expect(x.table.getRowIdAtIndex(2)).equals(row4);
        expect(x.table.getRowIdAtIndex(3)).equals(row5);
        expect(x.table.getRowIdAtIndex(4)).equals(row6);
        expect(x.table.getRowIdAtIndex(5)).is.undefined;
      }
    });

    it(`should resolve conflicting moves`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);
      clientA.createRow(row3);
      clientA.createRow(row4);
      clientA.createRow(row5);
      clientA.createRow(row6);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.moveRow(row1, 3);
      clientB.moveRow(row2, 3);

      clientB.comeOnline(); // 134256
      clientA.comeOnline(); // 342156
      
      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row3);
        expect(x.table.getRowIdAtIndex(1)).equals(row4);
        expect(x.table.getRowIdAtIndex(2)).equals(row2);
        expect(x.table.getRowIdAtIndex(3)).equals(row1);
        expect(x.table.getRowIdAtIndex(4)).equals(row5);
        expect(x.table.getRowIdAtIndex(5)).equals(row6);
      }
    });

    it(`should resolve conflicting moves (2)`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);
      clientA.createRow(row3);
      clientA.createRow(row4);
      clientA.createRow(row5);
      clientA.createRow(row6);

      clientA.goOffline();
      clientB.goOffline();
      
      clientA.moveRow(row1, 4);
      clientB.moveRow(row6, 2);

      clientA.comeOnline(); // 234516
      clientB.comeOnline(); // 236451
      
      // 1263415

      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row2);
        expect(x.table.getRowIdAtIndex(1)).equals(row3);
        expect(x.table.getRowIdAtIndex(2)).equals(row6);
        expect(x.table.getRowIdAtIndex(3)).equals(row4);
        expect(x.table.getRowIdAtIndex(4)).equals(row5);
        expect(x.table.getRowIdAtIndex(5)).equals(row1);
      }
    });

    it(`should resolve conflicting moves and insertions`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);
      clientA.createRow(row3);
      clientA.createRow(row4);

      clientA.goOffline();
      clientB.goOffline();

      clientA.createRow(row5);
      clientA.createRow(row6);
      clientA.moveRow(row5, 2);
      
      clientB.moveRow(row1, 3);

      clientA.comeOnline(); // 123456 -> 125346 -B->     253146 
      clientB.comeOnline(); // 1234 -> 2341 -> 234156 -> 235416
      
      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row2);
        expect(x.table.getRowIdAtIndex(1)).equals(row5);
        expect(x.table.getRowIdAtIndex(2)).equals(row3);
        expect(x.table.getRowIdAtIndex(3)).equals(row1);
        expect(x.table.getRowIdAtIndex(4)).equals(row4);
        expect(x.table.getRowIdAtIndex(5)).equals(row6);
      }
    });

    it(`should resolve conflicting moves and insertions and deletions`, () => {
      let ct : ColumnType = 'text';

      clientA.createRow(row1);
      clientA.createRow(row2);
      clientA.createRow(row3);
      clientA.createRow(row4);

      clientA.goOffline();
      clientB.goOffline();

      clientA.createRow(row5);
      clientA.destroyRow(row2);
      clientA.createRow(row6);
      clientA.moveRow(row5, 2);
      
      clientB.moveRow(row1, 3);

      clientA.comeOnline(); // 123456 -> 13546 -B-> 35416 
      clientB.comeOnline(); // 1234 -> 2341 -A-> 34516
      
      let clients = [clientA, clientB, server];

      for (let x of clients) {      
        expect(x.table.getRowIdAtIndex(0)).equals(row3);
        expect(x.table.getRowIdAtIndex(1)).equals(row5);
        expect(x.table.getRowIdAtIndex(2)).equals(row4);
        expect(x.table.getRowIdAtIndex(3)).equals(row1);
        expect(x.table.getRowIdAtIndex(4)).equals(row6);
        expect(x.table.getRowIdAtIndex(5)).is.undefined
      }
    });

  });
});