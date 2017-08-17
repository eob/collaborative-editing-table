Table Service - Ted Benson
==========================

This is a demo "Table Service" that provides basic typed row, column and cell 
operations. It supports synchronizing state using operational transforms across
multiple clients. Clients can connect and disconnect at any time and may 
continue operating while disconnected.

Dependencies
------------

- NodeJS
- Typescript
- POSIX environment (test automation script uses `find` and `xargs`)

Setup & Running
---------------

Typescript files are kept in the `src/` directory and compiled Javascript is
kept in the `build/` directory. Assuming NodeJS and Typescript is available,
setup and testing should one-liners.

To setup:
- Run `npm install`

To test:
- Run `npm test`

To test with logging output:
- Run `DEBUG=synctable* npm test`

Design Notes
------------

First of all, this was fun. Thanks.

There are a few ways to handle distributed state in a situation that combines
multiple concurrent users with the the ability to continue editing when 
offline. Since we're still in a client-server mindset and the server lays claim
to ground truth, that simplifies things a bit.

- In SNAPSHOT/STATE based approaches, the server creates a unique version number 
  each time state is modified. Loading any particular version is trivial, 
  but reconciling conflicts can be challenging as the semantics of the edits 
  that resulted in a particular state are lost; only their effects remain. 
  Communicating via snapshots is also prohibitively network intensive (git 
  solves this by separating the blob database from the snapshot lineage) 
  which makes it poor for real-time collaborative apps on questionable 
  network connections. 

- In OP-LOG based approaches, the client and server agree on a common starting
  state and then synchronize only mutations to this state. That makes them
  extremely wire-efficient and thus great for 
  collaborative apps on high-latency connections. Conflicting state mutations 
  can be easier to resolve because more semantics around those mutations are
  captured. These approaches generally also embed within them period snapshots 
  so that the logs don't grow too long.

- OPERATIONAL TRANSFORM is a popular style of lock free, non-blocking, op-log 
  synchronization in which mutations on some shared state are experessed as a
  declarative script of transforms. Clients optimistically apply local transforms
  to their state and then forward them to the server. In response, they get back
  a separate script of "corrective transforms" that should be applied to align the 
  client's state with the server's state. In this way all clients eventually 
  converge to the server's state.

- CONFLICT FREE REPLICATED DATA TYPES might be thought of as a data-structure-first
  approach to distributed state, whereas OT is an open-ended mutation-centric approach.
  CRDTs are a set of extremely constrained data types that are guaranteed to provide 
  convergence across a distributed system. The primitives themselves are basic (e.g. a
  grow-only counter, or add-only set) but they can be combined and composed to create
  more complex structures with the same guarantees (e.g. an add-remove set).

After starting down the CRDT road, I decided to pursue an OT-style approach since it
is the classic approach to this sort of application. The only real points of conflict
resolution occur when the ordered list of rows are concerned: a sequence of inserts,
deletes, and swaps on Client A has to be reconciled against some concurrent sequence
on some disconnected Client B. 

Implementation Notes
--------------------

* **Conflict Resolution Semantics**
The order in which the server recieves transforms is the Canonical Order. The
burden is upon all clients to converge with the resulting server state by 
selectively replaying the transforms of other clients and creating sequences
of "conflict resolution" transforms to repair chains of mutation that stemmed
from a local parent state that (post hoc) turned out to have never actually 
occured on the server.

* **Column Type**
I chose to implement column type as a lens through which data is focused upon
retrieval, rather than a hard-and-fast constraint on the data itself. This has
the benefit of providing "implicit undo" if a user were switch back and forth
between multiple column types. For example, imagine if a "Photo URL" column
type was added. If the user wanted to try it out, we wouldn't want the to find
that we had destroyed all non-URL values when they changed the type back to 
Text.

* **Deletion**
Deletion is performed using a tombstone marker instad of actually removing any
data, with the exception of the row ordering. In general, this simplifies
implementing undo later on.

* **Last Write Wins Registers**
I chose to implement as many elements of storage as I could as LWW Registers
defined by a key that's unique. For example rows are hashed by their ID, not
stored by their current index in the sort order. That simplifies the complexity
of the update logic and also aligns the data storage with the API as provided.

* **OT Logic**
I placed the OT logic in the client so that the server can act as a simple
relay of transforms. Each time the client interacts with the server, it gets
back all transforms that have happened since its last sync.

It then analizes this log against its own actions since the last sync to 
create a final reconciliation set of transforms to play against its own state.

Note about Versioned Values and Vector Clocks
---------------------------------------------

I started out trying to see how far I could get implementing everything as 
a CRDT, but reverted to OT-style state maintenance because it seemed like
a far more straightforward way to maintain the ordered lists.

As a result this implementation uses vector clocks and wraps most values in
a versioning structure... but that shouldn't be necessary if it were to be 
reimplemented from scratch. Any total ordering on transformations (provided 
by the server) along with the source ID of each transformation should suffice.

Improvements
------------

* **Client Initialization.**
  Clients currently initialize with an empty table and then replay all 
  transforms up to the present state. An obvious addition in production 
  would be to download a snapshot of the server's copy of the table 
  (along with current vector clock) upon init.

* **Asyncronous Implementation**
  For simplicity, client-server comms have been implemented synchronously. 
  Moving to an asynchronous setup would require a few small changes, for 
  example slightly more complex magement of the OT send buffers.

* **Undo**
  Undo is tricky in a collaborative editing environment, as the sequence of
  "undone" actions the user expects is their own, but rolling back these
  edits might have impacts on the data they see that appear nonlinear (e.g.
  in the event those operations conflicted with some remote operation).

* **Log Pruning**
  In a running system, the server would occasionally freeze snapshots of
  its data structure and reset its OT logs and vector clock to zero. There
  are a number of simple strategies to do this. The serer can safely delete
  logs older than the oldest vector clock timestamp it's received from its
  clients, for example. (But better client initialization is required for
  this -- see above)
