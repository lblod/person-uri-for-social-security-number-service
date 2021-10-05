# person-uri-for-social-security-number-service
Microservice to return an URI of a person, when provided with a social security number (rijksregisternummer).

## Installation
Add the following snippet to your `docker-compose.yml`:

```yml
  person-uri-for-social-security-number-service:
    image: lblod/person-uri-for-social-security-number-service
```
The following environment variables are availible:
 - `ACCESS_GRAPH`: the graph where account data of vendors are stored, defaults to `http://mu.semte.ch/graphs/ssn-access-control`
 - `MAX_CONSECUTIVE_ATTEMPTS_WITHIN_TIMESPAN`: To avoid brute force SSN deduction, the agent is allowed a max amount of attempts within a timespan. Defaults to 1000 attempts.
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


#### Regular request
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

#### Super request
If an agent has been granted access to ask for a personURI, without specifiying the organisation, the following request can be done.
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
        "rrn": "12.34.56-789.12"
    }
}
```

### Response
```
{
    "@context": "http://lblod.data.gift/contexts/rijksregisternummer-api/context.json",
    "uri":"http://data.lblod.info/id/personen/3c30d9ed-eeb0-4ab2-904c-12758330dfbe",
    "rrn": "12345678912",
    "@type": "foaf:Person"
}
```

## Model
### Request model
See [https://lblod.data.gift/vocabularies/ssn-request](https://lblod.data.gift/vocabularies/ssn-request).

### ACL model
See [https://lblod.data.gift/vocabularies/ssn-acl](https://lblod.data.gift/vocabularies/ssn-acl).

#### Notes

The scope of `muAccount:SSNAccess` is imited to data within a bestuurseenheid
The scope of `muAccount:SuperSSNAccess` is limited to a class type, currently supported `http://data.lblod.info/id/conceptscheme/LocalPoliticianMandateRole` or `http://data.lblod.info/id/conceptscheme/LocalOfficerMandateRole`.

## Scripts

The service offers scripts to create migrations.

### Generate key

Generate a key for a pair of bestuurseenheid and vendor.

```
mu script person-uri-for-social-security-number generate-key-regular-requester <vendorUri> <bestuurseenheidUri> <key> <passwordSalt>
```
Generate a key for an aggregated requester
```
mu script person-uri-for-social-security-number generate-key-super-requester <vendorUri> <http://theTheme> <key> <passwordSalt>
```
Note: `<http://theTheme>` can be either `http://data.lblod.info/id/conceptscheme/LocalPoliticianMandateRole` or `http://data.lblod.info/id/conceptscheme/LocalOfficerMandateRole`

### Create mandatarissen

For a given bestuurseenheid, create a mock mandataris and a mock functionaris if respectively a mandate and a bestuursfunctie are found.

```
mu script person-uri-for-social-security-number create-mandatarissen <bestuurseenheidUri>
```
