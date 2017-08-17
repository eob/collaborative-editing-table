// Interfaces
import {IVectorClock, IVersionedValue} from "./interfaces";

// Libraries
import {VectorClock} from "./vector_clock";

/*
 * Wrapper class around the notion of a value at a particular
 * point in time.
 */
export class VersionedValue<T> implements IVersionedValue<T> {
  value: T;
  version: IVectorClock;

  constructor(initialValue: T, vectorClock?:IVectorClock) {
    this.value = initialValue;
    if (vectorClock) {
      this.version = vectorClock;
    } else {
      this.version = new VectorClock();        
    }
  }

  set(value: T, vectorClock: IVectorClock) {
    this.value = value;
    this.version = vectorClock;
  }
}
