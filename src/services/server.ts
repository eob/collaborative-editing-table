// Interfaces
import {IConnection, IServer, ITableService} from "./interfaces"
import {ITable, IVectorClock, ITransform, RowId, ColumnId, ColumnType} from "../data/interfaces";

// Libraries
import {Table} from "../data/table"

import debug = require('debug');
const Log = debug('synctable:server:debug');
const Error = debug('synctable:server:error');
const Trace = debug('synctable:server:trace');

export class Server implements IServer {
  name : string;
  table : Table;
  connections: IConnection[];
  transforms: ITransform[];
  
  constructor(name) {
    this.name = name;
    this.table = new Table(name);
    this.connections = [];
    this.transforms = [];
  }

  addConnection(connection: IConnection) {
    this.connections.push(connection);
  }

  clientSync(transforms: ITransform[], clientVersion: IVectorClock, fromConnection: IConnection) {
    Log(`Received clientSync from ${fromConnection.getClientId()} with ${transforms.length} transforms`);
    for (let transform of transforms) {
      let newVersion = this.table.applyTransform(transform);
      Trace(`transform clock is now ${JSON.stringify(transform.clock.clock)}`);
      transform.clock = newVersion;
      this.transforms.push(transform); 
    }
    this.notifyClients();
  }

  notifyClients() {
    for (let connection of this.connections) {
      let clientVersion = connection.getClientVersion();
      let clientId = connection.getClientId();

      if (clientVersion) {
        Trace(`Push to ${clientId} with clock ${clientVersion.toString()}`);
        let xforms = [];
        for (let transform of this.transforms) {
          if (transform.clock.greaterThan(clientVersion, this.name)) {      
            Trace(`Push ${transform.type} with clock ${transform.clock.toString()}`)
            xforms.push(transform);
          } else {
          }
        }      
        if (xforms.length) {
          Log(`Distributing ${xforms.length} transforms to ${clientId}`);
          connection.receiveFromServer(xforms, this.table.vectorClock);  
        }
      }
    }
  }

}

