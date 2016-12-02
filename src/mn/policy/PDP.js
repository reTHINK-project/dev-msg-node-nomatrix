/**
* Copyright 2016 PT Inovação e Sistemas SA
* Copyright 2016 INESC-ID
* Copyright 2016 QUOBIS NETWORKS SL
* Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
* Copyright 2016 ORANGE SA
* Copyright 2016 Deutsche Telekom AG
* Copyright 2016 Apizee
* Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**/

import PoliciesConnector from './PoliciesConnector';
import fs from 'fs';
/**
 * Holder for a Policy Decision functionality implementation
 */
export default class PDP {

  constructor() {
    console.log("PDP constructor");
    this._policiesConnector = new PoliciesConnector();
    console.log("PDP constructor 2");
    this._policiesFile = "./policies";
    this._loadPolicies();
  }

  permits(msg) {
    //console.log("+[PDP] [permits] ----- POLICY DECISION --- not implemented yet ------");
    var result = this._policiesConnector.authorise(msg);
    console.log("+[PDP] ----- POLICY DECISION: " + result);
    return result;
  }

  _loadPolicies() {
    console.log("+[PDP] loading policies from: " + this._policiesFile);
    let policies = {};
    fs.readFile(this._policiesFile, (err, data) => {
      if ( err )
        console.log("+[PDP] Error while loading policies file:", err);
      else {
        try {
          policies = JSON.parse( data );
          console.log("+[PDP] loaded %s policies: ", Object.keys(policies).length);

          Object.keys(policies).forEach((key) => {
            this._policiesConnector.addPolicy( key, policies[key]);
          });
        } catch (e) {
          console.log("+[PDP] policies file \"%s\" can't be parsed as JSON --> ignoring", this._policiesFile);
        }
      }
    });
  }
}
