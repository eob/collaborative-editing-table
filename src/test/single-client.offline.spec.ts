// Interfaces
import {IConnection, IServer, IClient} from "../services/interfaces";

// Libraries
import {Server} from "../services/server";
import {Client} from "../services/client";
import {LocalSynchronousConnection as Connection} from "../services/local_synchronous_connection";

import 'mocha';
import { assert, expect } from 'chai';
import hat = require('hat');

describe('One Client', () => {
  describe('Offline Behavior', () => {
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

  })
});

