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

describe('Three Clients', () => {
  describe('Should update a latecoming third with their changes ', () => {

    let server: IServer, 
        clientA: IClient,
        clientB: IClient,
        clientC: IClient,
        connectionA: IConnection,
        connectionB: IConnection,
        connectionC: IConnection;
    
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
      connectionC = null;
      clientA = null;
      clientB = null;
      clientC = null;
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

      connectionC = new Connection(server);
      clientC = new Client('Client C', connectionB);    
      expect(clientC.rowCount()).equals(2);
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
      
      connectionC = new Connection(server);
      clientC = new Client('Client C', connectionB);    
      expect(clientC.rowCount()).equals(0);      
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

      connectionC = new Connection(server);
      clientC = new Client('Client C', connectionB);    
      expect(clientC.getRowIdAtIndex(0)).equals(B);
      expect(clientC.getRowIdAtIndex(1)).equals(A);
      expect(clientC.getRowIdAtIndex(2)).equals(D);
      expect(clientC.getRowIdAtIndex(3)).equals(C);
    });

  });
});