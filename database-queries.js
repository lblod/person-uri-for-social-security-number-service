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
         PREFIX generiek: <https://data.vlaanderen.be/ns/generiek#>
         PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
         PREFIX dataClaim: <http://data.lblod.info/vocabularies/dataClaim/>
         PREFIX rrn: <http://data.lblod.info/vocabularies/rrn/>`;

  const personSelection =
        `GRAPH ?g {
           ?uri a foaf:Person;
             adms:identifier ${sparqlEscapeString(info.rrn)};
             ^mandaat:heeftKandidaat/mandaat:behoortTot/mandaat:steltSamen/generiek:isTijdspecialisatieVan/besluit:bestuurt
               ${sparqlEscapeUri(info.organization)}.
         }`;

  const accessValidation =
        `GRAPH ?h {
           ${sparqlEscapeUri(info.vendor)}
             dataClaim:hasRight ?claim.
           ?claim
             dataClaim:actsOnEntity ${sparqlEscapeUri(info.organization)};
             dataClaim:actsOnData ${sparqlEscapeUri("http://data.lblod.info/codelists/data-rights/social-security-number")};
             dataClaim:accessMode ${sparqlEscapeUri("http://data.lblod.info/codelists/access-modes/read")}.
         }`;

  const results = await querySudo(
     `SELECT ?uri WHERE {
       ${prefixes}
       ${personSelection}
       ${accessValidation}
     }`
  );

  return results.bindings.length && results.bindings[0].uri;
}
