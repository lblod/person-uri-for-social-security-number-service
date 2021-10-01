import bodyParser from 'body-parser';
import { toRDF } from 'jsonld';
import { app, errorHandler } from 'mu';
import { fetchPersonUri } from './database-queries';
import { enrichBody, extractInfoFromTriples } from './jsonld-input';
import { hadTooManyAttemptsWithinTimespan, manageAttemptsData } from './ssn-brute-force-security';

app.use(errorHandler);
app.use(bodyParser.json({ type: 'application/ld+json'}));
app.use(bodyParser.json());

/**
 * Handles the request, regardless of it coming from get or post.
 */
async function handleRequest( req, res, next ) {
  const validContentType = /application\/(ld\+)?json/.test(req.get('content-type'));
  if (!validContentType) {
    res.status(400).send({errors: [{title: "invalid content-type only application/json or application/ld+json are accepted"}]}).end();
  }
  try {
    const body = req.body;
    enrichBody(body);

    // extract triples
    const triples = await toRDF(body, {});
    let { organization, rrn, subject, vendorKey, vendor, dataRequest } = extractInfoFromTriples( triples );

    //basic validation
    if(!vendor || !vendorKey || !rrn || !organization){
      return res
        .status(400)
        .send( JSON.stringify({
          "message": "Invalid request",
          "code": 400
        }));
    }

    else {

      if(await hadTooManyAttemptsWithinTimespan( { vendor, vendorKey } )){
        return res
          .status(429)
          .send( JSON.stringify({
            "message": "Too many failed requests, please try again later.",
            "code": 429
          }));
      }

      //Strip non numeric chars from rrn.
      rrn = rrn.replace( /[^0-9]*/g, '');
      // fetch uri and verify access
      const uri = await fetchPersonUri( { organization, rrn, subject, vendorKey, vendor, dataRequest } );

      if( uri ) {
        // return the response
        await manageAttemptsData( { vendor, vendorKey } );
        res
          .status(200)
          .send( JSON.stringify({
            "@context": "http://lblod.data.gift/contexts/rijksregisternummer-api/context.json",
            uri,
            rrn: formatRRN(rrn),
            "@type": "foaf:Person"
          }) );

      } else {
        await manageAttemptsData( { vendor, vendorKey } );
        res
          .status(404)
          .send( JSON.stringify({
            "message": "You do not have access to this resource, or it does not exist.",
            "code": 404
          }) );
      }
    }
  }
  catch(e) {
    console.error(e);
    next(new Error(e.message));
  }
}

function formatRRN(rrn){
  rrn = rrn.replace( /[^0-9]*/g, '');
  return `${rrn.slice(0, 2)}.${rrn.slice(2, 4)}.${rrn.slice(4, 6)}-${rrn.slice(6, 9)}.${rrn.slice(9, 11)}`;
}

app.get('/', handleRequest);
app.post('/', handleRequest);
