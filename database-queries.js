import { querySudo } from '@lblod/mu-auth-sudo';
import _ from 'lodash';
import { sparqlEscapeDateTime, sparqlEscapeInt, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { PREFIXES, SSN_ACCESS_TYPE } from './constants';
import { parseResult } from './utils';

const ACCESS_GRAPH = process.env.ACCESS_GRAPH || 'http://mu.semte.ch/graphs/ssn-access-control';

/**
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
 * @param info.vendorKey {string} Request information containing
 * the key of the vendor as a string.
 *
 * @param info.vendor {string} Request information containing the URI
 * of the vendor as a string.
 *
 * @return The URI of the person in string format, or null if no
 * person matched the supplied conditions (including access rights).
 */
export async function fetchPersonUri( info ) {
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

          ${sparqlEscapeUri(info.vendor)} acl:member ?ssnAgent.

          ?ssnAgent a muAccount:SSNAgent;
            foaf:account ?account.

          ?account a foaf:OnlineAccount;
            muAccount:salt ?salt.

          BIND( SHA512 ( CONCAT( ${sparqlEscapeString(info.vendorKey)}, STR(?salt) ) ) as ?hashedKey )

          ?account muAccount:key ?hashedKey.

          ?authorization a acl:Authorization;
            acl:agent ?ssnAgent;
            acl:mode ${sparqlEscapeUri("http://data.lblod.info/codelists/access-modes/read")};
            acl:accessTo ?access.

          ?access a ${sparqlEscapeUri(SSN_ACCESS_TYPE)};
            dcterms:subject ${sparqlEscapeUri(info.organization)}.

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
export async function getSSNAttemptsDataForAccount( { vendor, vendorKey } ){
  const query = `
    ${PREFIXES}
    SELECT DISTINCT ?account ?attempts ?lastAttemptAt
    WHERE {
      GRAPH ${ sparqlEscapeUri(ACCESS_GRAPH) } {
        ${sparqlEscapeUri(vendor)} acl:member ?ssnAgent.

        ?ssnAgent a muAccount:SSNAgent;
          foaf:account ?account.

        ?account a foaf:OnlineAccount;
          muAccount:salt ?salt.

        BIND( SHA512 ( CONCAT( ${sparqlEscapeString(vendorKey)}, STR(?salt) ) ) as ?hashedKey )

        ?account a foaf:OnlineAccount;
          muAccount:key ?hashedKey.

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
export async function updateSSNAttemptsDataForAccount( { vendor, vendorKey, attempts, lastAttemptAt } ) {
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
        ${sparqlEscapeUri(vendor)} acl:member ?ssnAgent.

        ?ssnAgent a muAccount:SSNAgent;
          foaf:account ?account.

        ?account a foaf:OnlineAccount;
          muAccount:salt ?salt.

        BIND( SHA512 ( CONCAT( ${sparqlEscapeString(vendorKey)}, STR(?salt) ) ) as ?hashedKey )

        ?account a foaf:OnlineAccount;
          muAccount:key ?hashedKey.

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
export async function clearSSNAttemptsDataForAccount( { vendor, vendorKey } ){
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
        BIND( SHA512 (${sparqlEscapeString(vendorKey + PASSWORD_SALT)}) as ?hashedKey )
        ${sparqlEscapeUri(vendor)} acl:member ?ssnAgent.
        ?ssnAgent foaf:account ?account.
        ?account muAccount:key ?hashedKey.

        OPTIONAL { ?account ext:ssnAttempts ?attempts. }
        OPTIONAL { ?account ext:ssnLastAttemptAt ?lastAttemptAt. }
      }
    }
  `;
  await querySudo(query);
}
