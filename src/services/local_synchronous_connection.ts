// Interfaces
import {IConnection} from "./interfaces"
import {IServer, IClient} from "../services/interfaces";
import {IVectorClock, ITransform} from "../data/interfaces";

// Libraries
import debug = require('debug');
const Log = debug('synctable:connection');
const Error = debug('synctable:connection:error');

export class LocalSynchronousConnection implements IConnection {
  isOnline : boolean;
  server: IServer;
  version: number;
  client: IClient;

  sendBuffer: ITransform[];

  constructor(server: IServer) {
    this.isOnline = false;
    this.server = server;
    this.sendBuffer = [];
    this.version = 0;
    this.server.addConnection(this);
  }

  setClient(client: IClient) {
    this.client = client;
    this.comeOnline();
  }
  
  goOffline() {
    Log(`[${this.client ? this.client.name : 'Unknown'}] Offline`)
    this.isOnline = false;
  }

  comeOnline() {
    Log(`[${this.client ? this.client.name : 'Unknown'}] Online`)    
    this.isOnline = true;
    if (this.server && this.client) {
      this._sendBufferToServer();      
    }
  }

  getClientVersion() : IVectorClock {
    return this.client ? this.client.getVersion() : null;
  }

  getClientId() : string {
    return this.client ? this.client.name : '';    
  }

  sendToServer(transforms: ITransform[]) {
    for (let transform of transforms) {
      this.sendBuffer.push(transform);
    }
    this._sendBufferToServer();
  }

  _sendBufferToServer() {
    if (this.isOnline && this.server) {
      Log(`[${this.client ? this.client.name : 'Unknown'}] Syncing with server - ${this.sendBuffer.length} transforms to send.`)          
      let toSend = Array.from(this.sendBuffer);
      this.server.clientSync(toSend, null, this);
      // The send buffer always grows from the back; so we clip the front
      // This technically isn't necessary since this is all single-threaded..
      this.sendBuffer = this.sendBuffer.slice(toSend.length);
    }
  }

  receiveFromServer(transforms: ITransform[], serverClock: IVectorClock) {
    /*
     * We simulate being offline at the client side by simply ignoring
     * updates that are recieved from the server.
     */
    if (this.isOnline) {
      if (this.client && this.client.onTransformsAvailable) {
        this.client.onTransformsAvailable(transforms, serverClock);
      }
    }
  }

}