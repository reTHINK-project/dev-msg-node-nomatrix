/**
 * The configuration we need to configure to have the tests running.
 * After creating the Configuration Object. All data is available by
 * accessing the fields.
 * @author: Kay Haensge, Steffen Druesedow
 */
export default class Configuration {
  constructor() {

    /**
     *  The Matrix Homeserver of the given domain
     */
    // this.homeserver = "matrix.docker";
    this.homeserver = "matrix2.rethink.com";

    /**
     * The Domain for an external communication
     */
    this.externalruntime = "external.runtime";

    /**
     * The messaging node we connect to.
     * Pattern: <protocoll>://<hostname>:<port>/url/to/connect
     */
    this.messagingnode = "ws://localhost:8001/stub/connect";

  }
}
