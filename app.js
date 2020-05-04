import { app, query, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { enrichBody, extractInfoFromTriples } from './jsonld-input';
import { fetchPersonUri } from './database-queries';
import { hadTooManyAttemptsWithinTimespan, manageAttemptsData } from './ssn-brute-force-security';
import { toRDF } from 'jsonld';
import * as jsonld from 'jsonld';

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
            rrn: rrn,
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

app.get('/', handleRequest);
app.post('/', handleRequest);
