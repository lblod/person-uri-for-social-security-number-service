import bodyParser from 'body-parser';
import { toRDF } from 'jsonld';
import _ from 'lodash';
import { app, errorHandler } from 'mu';
import { AGGREGATED_SSN_ACCESS_TYPE, SSN_ACCESS_TYPE } from './constants';
import { fetchPersonUriRegularSSNAccess,
         fetchPersonUriAggregatedSSNAccess,
         getAccessResourceData,
         getAccountData } from './database-queries';
import { enrichBody, extractInfoFromTriples } from './jsonld-input';
import { hadTooManyAttemptsWithinTimespan, manageAttemptsData } from './ssn-brute-force-security';

app.use(errorHandler);
app.use(bodyParser.json({ type: 'application/ld+json'}));
app.use(bodyParser.json());

/**
 * Handles the request, regardless of it coming from get or post.
 */
async function handleRequest( req, res, next ) {

  try {

    const validContentType = /application\/(ld\+)?json/.test(req.get('content-type'));

    if (!validContentType) {
      res
        .status(400)
        .send({
          errors: [{title: "invalid content-type only application/json or application/ld+json are accepted"}]})
        .end();

      return;
    }

    //Extract triples
    const body = req.body;
    enrichBody(body);

    const triples = await toRDF(body, {});
    let { organization, rrn, subject, vendorKey, vendor, dataRequest } = extractInfoFromTriples( triples );

    //Basic body validation
    if(!vendor || !vendorKey || !rrn ){
      res
        .status(400)
        .send( JSON.stringify({
          "message": "Invalid request",
          "code": 400
        }));

      return;
    }

    //Authenticate
    const accountData = await getAccountData(req, vendor, vendorKey);

    if(!accountData.length){
      res
        .status(401)
        .send( JSON.stringify({
          "message": "Unauthorized",
          "code": 401
        }));

      return;
    }

    //Check account integrity
    if(accountData.length > 1 ){
      //For a pair of key en vendor uri (or acm token) we expect only one account
      throw `Multiple accounts found for ${vendor}`;
    }

    const account = accountData[0].account;

    //Block brute forcing of RRN
    if(await hadTooManyAttemptsWithinTimespan({ account })){
      res
        .status(429)
        .send( JSON.stringify({
          "message": "Too many failed requests, please try again later.",
          "code": 429
        }));

      return;
    }

    //Check authorization
    const accessResourceData = await getAccessResourceData(account);

    if(!accessResourceData.length){
      res
        .status(403)
        .send( JSON.stringify({
          "message": "Unauthorized",
          "code": 403
        }));

      return;
    }

    //Check account integrity
    const accessResourceTypes = _.uniq(accessResourceData.map(d => d.accessResourceType));
    if( accessResourceTypes.length > 1 ){
      throw `Multiple AccessResourceTypes for ${account} were found, only one is supported`;
    }

    const accessResourceType = accessResourceTypes[0];

    //Strip non numeric chars from rrn.
    rrn = rrn.replace( /[^0-9]*/g, '');
    let uri = null;

    if(accessResourceType == AGGREGATED_SSN_ACCESS_TYPE){
      uri = await fetchPersonUriAggregatedSSNAccess( { rrn, account, accessResourceData } );
    }

    else if(accessResourceType == SSN_ACCESS_TYPE){
      uri = await fetchPersonUriRegularSSNAccess( { organization, rrn, subject, account} );
    }

    else{
      throw `Unsupported accessResourceType: ${accessResourceType}`;
    }

    if(uri){
      res
        .status(200)
        .send( JSON.stringify({
          "@context": "http://lblod.data.gift/contexts/rijksregisternummer-api/context.json",
          uri,
          rrn: formatRRN(rrn),
          "@type": "foaf:Person"
        }) );
    }

    else {
      res
        .status(404)
        .send( JSON.stringify({
          "message": "You do not have access to this resource, or it does not exist.",
          "code": 404
        }) );
    }

    //After response -to speed up call- manage access data
    await manageAttemptsData( { account } );
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
