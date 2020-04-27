import context from './jsonld-context';

/**
 * Enriches the body with a type and/or JSON-LD context if it is not
 * in the request itself.  Allows for defaults for non-json-ld aware
 * consumers.
 *
 * @param originalBody {Object} The request body which will be
 * manipulated to contain the necessary information.
 */
export function enrichBody(originalBody) {
  if(! originalBody["@type"]) {
    originalBody["@type"] = "dataRequest:DataRequest";
  }
  if (! originalBody["@context"]) {
    originalBody["@context"] = context;
  }
}

/**
 * Extracts the information we expect from the triples into a
 * key-value like object for easier processing.
 *
 * This function walks through the triples in a silly way.  There may
 * be better approaches for solving this issue.
 *
 * @param triples {Array<Triple>} An array of triples, parsed from the
 * json-ld request.
 *
 * @return Object containing organization, rrn, subject, vendorKey,
 * vendor, dataRequest.  All of these are the `value` from the triple.
 */
export function extractInfoFromTriples( triples ) {
  // find the root (a DataRequest)
  const dataRequest = triples
    .find( (triple) =>
           triple.predicate.value == "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
           && triple.object.value == "http://data.lblod.info/vocabularies/data-request/DataRequest" )
    .subject.value;

  const vendor = triples
    .find( (triple) =>
           triple.subject.value == dataRequest
           && triple.predicate.value == "http://data.lblod.info/vocabularies/data-request/requester" )
    .object.value;

  const vendorKey = triples
    .find( (triple) =>
           triple.subject.value == vendor
           && triple.predicate.value == "http://mu.semte.ch/vocabularies/account/key" )
    .object.value;

  const subject = triples
    .find( (triple) =>
           triple.subject.value == dataRequest
           && triple.predicate.value == "http://purl.org/dc/terms/subject" )
    .object.value;

  const rrn = triples
    .find( (triple) =>
           triple.subject.value == subject
           && triple.predicate.value == "http://www.w3.org/ns/adms#identifier" )
    .object.value;

  const organization = triples
    .find( (triple) =>
           triple.subject.value == subject
           && triple.predicate.value == "schema:memberOf" )
    .object.value;

  return { organization, rrn, subject, vendorKey, vendor, dataRequest };
}
