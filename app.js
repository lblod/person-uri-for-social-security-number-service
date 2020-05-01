import { app, query, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { enrichBody, extractInfoFromTriples } from './jsonld-input';
import { fetchPersonUri } from './database-queries';
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
    const infoRequest = extractInfoFromTriples( triples );

    // fetch uri and verify access
    const uri = await fetchPersonUri( infoRequest );

    if( uri ) {
      // return the response
      res
        .status(200)
        .send( JSON.stringify({
          "@context":"http://lblod.data.gift/contexts/rijksregisternummer.json",
          uri,
          rrn: infoRequest.rrn,
          "@type": "foaf:Person"
        }) );
    } else {
      res
        .status(404)
        .send( JSON.stringify({
          "message": "You do not have access to this resource, or it does not exist.",
          "code": 404
        }) );
    }
  } catch(e) {
    console.error(e);
    next(new Error(e.message));
  }
}

app.get('/', handleRequest);
app.post('/', handleRequest);
