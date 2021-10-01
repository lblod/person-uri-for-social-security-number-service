import { querySudo } from '@lblod/mu-auth-sudo';
import _ from 'lodash';
import { sparqlEscapeDateTime, sparqlEscapeInt, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { PREFIXES, SSN_ACCESS_TYPE } from './constants';
import { parseResult } from './utils';

const ACCESS_GRAPH = process.env.ACCESS_GRAPH || 'http://mu.semte.ch/graphs/ssn-access-control';

/**
 * Given a vendor, a vendorKey and a request, we fetch the account related
 * to the provided paramaters.
 * This effectively validates key/vendor set and returns the account
 *
 * @param request {Object} The request object.
 *        Note: in future, this will be used to validate ACM/IDM parameters
 *
 * @param key {string} Request information containing the key of the vendor as a string.
 *
 * @param vendor {string} Request information containing the URI
 * of the vendor as a string.
 *
 * @return The URI of the account
 */
export async function getAccountData(request, vendor, key){
  //TODO: later, for acm integration, we need to parse headers and pass these to acm
  const accountQuery = `
   ${PREFIXES}

   SELECT DISTINCT ?account WHERE {
     GRAPH <http://mu.semte.ch/graphs/ssn-access-control> {

          ${sparqlEscapeUri(vendor)} acl:member ?ssnAgent.

          ?ssnAgent a muAccount:SSNAgent;
            foaf:account ?account.

          ?account a foaf:OnlineAccount;
            muAccount:salt ?salt.

          BIND( SHA512 ( CONCAT( ${sparqlEscapeString(key)}, STR(?salt) ) ) as ?hashedKey )

          ?account a foaf:OnlineAccount;
            muAccount:key ?hashedKey.
     }
   }
  `;

  return parseResult(await querySudo(accountQuery));
}

/**
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * WARNING: expects authentication and authorization being ok.
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 *
 * TODO: use function decoractors to ensure authentication preconditions
 *       are fulfilled. (To avoid accidental mis-use)
 *
 * Queries the database in search for the URI of a person for the
 * supplied info.
 *
 * @param info {Object} Information object retrieved from the request.
 *
 * @param info.organization {string} Request information containing
 * URI of the organization for which the person has been on the list
 * of electables, as a string.
 *
 * @param info.rrn {string} Request information containing identifier
 * of the person (Social security number or Rijksregisternummer) as a
 * string.
 *
 * @param info.account {string} Uri of the account asking for the data
 *
 * @return The URI of the person in string format, or null if no
 * person matched the supplied conditions (including access rights).
 */
export async function fetchPersonUriRegularSSNAccess( info ) {
  const prefixes = PREFIXES;

  const personKieslijstSelection =
        `GRAPH ?public {
           ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(info.organization)}.
           ?bestuursorgaanInTijd mandaat:isTijdspecialisatieVan ?bestuursorgaan.

           ?verkiezing mandaat:steltSamen ?bestuursorgaanInTijd.
           ?kandidatenlijst mandaat:behoortTot ?verkiezing.
           ?kandidatenlijst mandaat:heeftKandidaat ?uri.
         }

         GRAPH ?loketGraph {
           ?uri a person:Person;
             adms:identifier ?identifier.
           ?identifier skos:notation ${sparqlEscapeString(info.rrn)}.
         }`;

  // mandatarissen in loket with new created persons are not added to a kieslijst
  const personMandatarisSelection =
        `GRAPH ?public {
           ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(info.organization)}.
           ?bestuursorgaanInTijd mandaat:isTijdspecialisatieVan ?bestuursorgaan.

           ?bestuursorgaanInTijd org:hasPost ?mandaat.
           ?mandataris org:holds ?mandaat.
           ?mandataris mandaat:isBestuurlijkeAliasVan ?uri.
         }

         GRAPH ?loketGraph {
           ?uri a person:Person;
             adms:identifier ?identifier.
           ?identifier skos:notation ${sparqlEscapeString(info.rrn)}.
         }`;


  const personLeidinggevendeSelection =
        `GRAPH ?public {
           ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(info.organization)}.
           ?bestuursorgaanInTijd mandaat:isTijdspecialisatieVan ?bestuursorgaan.

           ?bestuursorgaanInTijd lblodlg:heeftBestuursfunctie ?bestuursfunctie.
         }

         GRAPH ?loketGraph {
           ?functionaris org:holds ?bestuursfunctie.
           ?functionaris mandaat:isBestuurlijkeAliasVan ?uri.
         }

         GRAPH ?loketGraph {
           ?uri a person:Person;
             adms:identifier ?identifier.
           ?identifier skos:notation ${sparqlEscapeString(info.rrn)}.
         }`;

  const accessValidation =
        `GRAPH ?accessGraph {
           ?ssnAgent foaf:account ${sparqlEscapeUri(info.account)}.
           ?authorization acl:agent ?ssnAgent.
           ?authorization acl:mode ${sparqlEscapeUri("http://data.lblod.info/codelists/access-modes/read")}.
           ?authorization acl:accessTo ?access.
           ?access dcterms:subject ${sparqlEscapeUri(info.organization)}.
         }`;


  const potentialPathsToPersons = [ personKieslijstSelection, personMandatarisSelection, personLeidinggevendeSelection ];

  for(const pathToPerson of potentialPathsToPersons){
    let rrnData = parseResult(await querySudo(buildPersonQueryString(prefixes, accessValidation, pathToPerson)));
    if(rrnData.length && rrnData[0].uri){
      return rrnData.uri;
    }
  }
  return null;
}

function buildPersonQueryString(prefixes, accessValidation, personSelection){
  return `
      ${prefixes}
      SELECT DISTINCT ?uri WHERE {
       ${personSelection}
       ${accessValidation}
     }`;
}

/**
 * Queries the database in search for data related to an SSN get attempt for an account.
 *
 * Why an account?
 *  - Because only accounts have access to SSN data. This is the bruteforce we want to avoid.
 *  - We don't want to penalize all deployments of the Vendor, for one specific erratic account.
 *
 * @param {Object} Information object retrieved from the request, containing { vendor, vendorKey }.
 *
 * @return {Object} { attempts, lastAttemptAt }
 */
export async function getSSNAttemptsDataForAccount( account ){
  //TODO: this needs fine tuning for ACM
  const query = `
    ${PREFIXES}

    SELECT DISTINCT ?account ?attempts ?lastAttemptAt
    WHERE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        BIND( ${sparqlEscapeUri(account)} as ?account)
        ?account a foaf:OnlineAccount.
        ?account ext:ssnAttempts ?attempts.
        ?account ext:ssnLastAttemptAt ?lastAttemptAt.
      }
   }
  `;

  return parseResult(await querySudo(query))[0];
}

/**
 * Updates the  SSN attempt data for an account.
 *
 * @param {Object} Information relevant for the updating of the  data of an account { vendor, vendorKey, attempts, lastAttemptAt }.
 *
 */
export async function updateSSNAttemptsDataForAccount( { account, attempts, lastAttemptAt } ) {
  const query = `
    ${PREFIXES}

    DELETE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        ?account ext:ssnAttempts ?attempts.
        ?account ext:ssnLastAttemptAt ?lastAttemptAt.
      }
    }
    INSERT {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        ?account ext:ssnAttempts ${ sparqlEscapeInt(attempts)}.
        ?account ext:ssnLastAttemptAt ${ sparqlEscapeDateTime(lastAttemptAt) }.
      }
    }
    WHERE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        BIND( ${sparqlEscapeUri(account)} as ?account)
        ?account a foaf:OnlineAccount.

        OPTIONAL { ?account ext:ssnAttempts ?attempts. }
        OPTIONAL { ?account ext:ssnLastAttemptAt ?lastAttemptAt. }
      }
    }
  `;
  await querySudo(query);
}

/**
 * Clears the SSN attempt data for an account.
 *
 * @param {Object} Information relevant for the clearing the  data of an account { vendor, vendorKey }.
 *
 */
export async function clearSSNAttemptsDataForAccount( account ){
  const query = `
   ${PREFIXES}

    DELETE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        ?account ext:ssnAttempts ?attempts.
        ?account ext:ssnLastAttemptAt ?lastAttemptAt.
      }
    }
    WHERE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        BIND( ${sparqlEscapeUri(account)} as ?account)
        ?account a foaf:OnlineAccount.

        OPTIONAL { ?account ext:ssnAttempts ?attempts. }
        OPTIONAL { ?account ext:ssnLastAttemptAt ?lastAttemptAt. }
      }
    }
  `;
  await querySudo(query);
}
