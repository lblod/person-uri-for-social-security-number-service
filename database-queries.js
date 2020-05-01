import { querySudo } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri, sparqlEscapeString } from 'mu';

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
  const prefixes =
        `PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
         PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
         PREFIX rrn: <http://data.lblod.info/vocabularies/rrn/>
         PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
         PREFIX adms: <http://www.w3.org/ns/adms#>
         PREFIX person: <http://www.w3.org/ns/person#>
         PREFIX lblodlg: <http://data.lblod.info/vocabularies/leidinggevenden/>
         PREFIX org: <http://www.w3.org/ns/org#>
         PREFIX acl: <http://www.w3.org/ns/auth/acl#>
         PREFIX foaf: <http://xmlns.com/foaf/0.1/>
         PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/>
         PREFIX dcterms: <http://purl.org/dc/terms/>`;


  const personSelection =
        `  {
              SELECT DISTINCT ?uri WHERE {
                GRAPH ?public {
                  ?bestuursorgaan besluit:bestuurt ${sparqlEscapeUri(info.organization)}.
                  ?bestuursorgaanInTijd mandaat:isTijdspecialisatieVan ?bestuursorgaan.

                  OPTIONAL {
                    ?bestuursorgaanInTijd lblodlg:heeftBestuursfunctie ?bestuursfunctie.
                  }

                  OPTIONAL {
                    ?verkiezing mandaat:steltSamen ?bestuursorgaanInTijd.
                    ?kandidatenlijst mandaat:behoortTot ?verkiezing.
                    ?kandidatenlijst mandaat:heeftKandidaat ?uri.
                  }
                }

                GRAPH ?loketGraph {
                  OPTIONAL {
                    ?functionaris org:holds ?bestuursfunctie.
                    ?functionaris mandaat:isBestuurlijkeAliasVan ?uri.
                  }
                }

              }
            }

            GRAPH ?loketGraph {
              ?uri a person:Person;
              adms:identifier ?identifier.
              ?identifier skos:notation ${sparqlEscapeString(info.rrn)}.
            }`;

  const accessValidation =
        `GRAPH ?accessGraph {
           ${sparqlEscapeUri(info.vendor)} acl:member ?ssnAgent.
           ?ssnAgent foaf:account ?account.
           ?account muAccount:key ${sparqlEscapeString(info.vendorKey)}.
           ?authorization acl:agent ?ssnAgent.
           ?authorization acl:mode ${sparqlEscapeUri("http://data.lblod.info/codelists/access-modes/read")}.
           ?authorization acl:accessTo ?access.
           ?access dcterms:subject ${sparqlEscapeUri(info.organization)}.
         }`;

  const query = `
      ${prefixes}
      SELECT DISTINCT ?uri WHERE {
       ${personSelection}
       ${accessValidation}
     }`;
  const { results } = await querySudo(query);

  return results.bindings.length && results.bindings[0].uri;
}
