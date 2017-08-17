// Interfaces
import {IVectorClock} from "./interfaces";

export class VectorClock implements IVectorClock {
  clock: Map<string, number>;

  constructor(entries?: IterableIterator<[string, number]>) {
    this.clock = new Map<string, number>(entries);
  }

  entries(): IterableIterator<[string, number]> {
    return this.clock.entries();
  }
  
  set(client: string, version: number) {
    return this.clock.set(client, version);
  }
  
  increment(client: string) {
    if (this.clock.has(client)) {
      this.clock.set(client, this.clock.get(client) + 1);
    } else {
      this.clock.set(client, 1);
    }
    return this.clock.get(client);
  }

  /*
   * For each client in the other clock, update the 
   * value in this clock to that value if it is larger.
   */
  updateWith(other:IVectorClock) {
    for (let client of Array.from(other.clock.keys())) {
      let clientVal = other.clock.get(client);
      let thisVal = this.clock.get(client);
      if ((typeof thisVal == 'undefined') || (thisVal < clientVal)) {
        this.set(client, clientVal);
      }
    }
  }

  toString() : string {
    let s = [];
    for (let client of Array.from(this.clock.keys())) {
      s.push(`${client}:${this.clock.get(client)}`)
    }
    return `<${s.join("; ")}>`;
  }

  /*
   * This is greaterThan other if for every key in Union(this,other)
   * this.key is greater than or equal to other. And for at least one
   * key, we're strictly greater than.
   */
  greaterThan(other: VectorClock, restrictToClient?: string) {
    let thisKeys = new Set(this.clock.keys());
    let otherKeys = new Set(other.clock.keys());
    let keySet = new Set([...Array.from(thisKeys), ...Array.from(otherKeys)]);


    if (restrictToClient) {
      // Restrict the calculation to just the version of this service
      let otherVal = other.clock.get(restrictToClient);
      let thisVal = this.clock.get(restrictToClient);

      // If both undefined, we'll return true.
      if (typeof otherVal == 'undefined') return true;
      if (typeof thisVal == 'undefined') return false;
      return (thisVal > otherVal);

    } else {
      let atLeastOneGreater = false;
      for (let client of Array.from(keySet)) {
        let otherVal = other.clock.get(client);
        let thisVal = this.clock.get(client);
        if (typeof otherVal == 'undefined') {
          otherVal = -1;        
        }

        if (typeof thisVal == 'undefined') {
          return false;
        }


        if (otherVal > thisVal) {
          return false;
        }

        if (thisVal > otherVal) {
          atLeastOneGreater = true;
        }      
      }
      return atLeastOneGreater;
    }    
  }


}