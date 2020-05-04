# person-uri-for-social-security-number-service
Microservice to return an URI of a person, when provided with a social security number (rijksregisternummer).

## Installation
Add the following snippet to your `docker-compose.yml`:

```yml
  person-uri-for-social-security-number-service:
    image: lblod/person-uri-for-social-security-number-service
    environment:
      PASSWORD_SALT: "a-randomly-generated-password-salt"
```
The following environment variables are availible:
 - `PASSWORD_SALT`: a system wide salt to generate correct hashes of the keys [REQUIRED]
 - `ACCESS_GRAPH`: the graph where account data of vendors are stored, defaults to `http://mu.semte.ch/graphs/ssn-access-control`
 - `MAX_CONSECUTIVE_ATTEMPTS_WITHIN_TIMESPAN`: To avoid brute force SSN deduction, the agent is allowed a max amount of attempts within a timespan.
 - `MAX_CONSECUTIVE_ATTEMPTS_TIMESPAN`: The length of the timespan. Defaults to 30 seconds.

Configure the dispatcher by adding the following rule:
```
  match "/person-uri-for-ssn/*path" do
    Proxy.forward conn, path, "http://person-uri-for-social-security-number-service/"
  end
```

## API

### Request
See also: https://lblod.github.io/pages-vendors/#/docs/rijksregisternummer-api


In its simplest form:
```
POST /

Content-Type: 'application/ld+json' (or 'application/json')

payload:

{
    "requester": {
        "uri": "http://data.lblod.info/vendors/8d91c850-f4e8-43f3-b658-6f5ea2c1787a",
        "key": "theKey"
    },
    "person": {
        "rrn": "12.34.56-789.12",
        "organization": "http://data.lblod.info/id/bestuurseenheden/09f5b10fbd078fcb1e0e4910d32e47146a5eb31d8138dcbaec798309e64dd059"
    }
}
```
Notes:
- `"persoon"["rrn"]` does not need formatting.

### Response
```
{
    "@context": "http://lblod.data.gift/contexts/rijksregisternummer.json",
    "uri": {
        "value": "http://data.lblod.info/id/personen/3c30d9ed-eeb0-4ab2-904c-12758330dfbe",
        "type": "uri"
    },
    "rrn": "12345678912",
    "@type": "foaf:Person"
}
```

## Model
### Request model
See [https://lblod.data.gift/vocabularies/ssn-request](https://lblod.data.gift/vocabularies/ssn-request).

Or with a nice visualisaton:
[http://visualdataweb.de/webvowl/#iri=https://lblod.data.gift/vocabularies/ssn-request](http://visualdataweb.de/webvowl/#iri=https://lblod.data.gift/vocabularies/ssn-request)
### ACL model
See [https://lblod.data.gift/vocabularies/ssn-acl](https://lblod.data.gift/vocabularies/ssn-acl).

Or with a nice visualisaton:
[http://visualdataweb.de/webvowl/#iri=https://lblod.data.gift/vocabularies/ssn-acl](http://visualdataweb.de/webvowl/#iri=https://lblod.data.gift/vocabularies/ssn-acl)
