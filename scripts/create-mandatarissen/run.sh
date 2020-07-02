#!/bin/bash
#http://data.lblod.info/id/bestuurseenheden/$BESTUURSEENHEID_UUID

if [ "$#" -ne 1 ]; then
  echo "The number of parameters is not correct. You need to provide the following: ./run.sh bestuurseenheidUri"
  exit 1
fi

BESTUURSEENHEID_URI=$1

BESTUURSEENHEID_UUID=$(curl -X POST "http://virtuoso:8890/sparql" \
  --data-urlencode 'format=json' \
  --data-urlencode "query=
    SELECT ?bestuurseenheidUuid
    WHERE { 
      GRAPH ?g {
        <$BESTUURSEENHEID_URI> <http://mu.semte.ch/vocabularies/core/uuid> ?bestuurseenheidUuid .
      }
    }" \
  | jq -r '.results.bindings[0].bestuurseenheidUuid.value')

MANDATE_URI_1=$(curl -X POST "http://virtuoso:8890/sparql" \
  --data-urlencode 'format=json' \
  --data-urlencode "query=
    SELECT ?mandaat
    WHERE { 
      GRAPH ?g {
        ?bestuursorgaan <http://data.vlaanderen.be/ns/besluit#bestuurt> <$BESTUURSEENHEID_URI> .
        ?bestuursorgaanInTijd <http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan> ?bestuursorgaan .
        ?bestuursorgaanInTijd <http://www.w3.org/ns/org#hasPost> ?mandaat .
      }
    }
    LIMIT 1" \
  | jq -r '.results.bindings[0].mandaat.value')

BESTUURSFUNCTIE_URI_2=$(curl -X POST "http://virtuoso:8890/sparql" \
  --data-urlencode 'format=json' \
  --data-urlencode "query=
    SELECT ?bestuursfunctie
    WHERE { 
      GRAPH ?g {
        ?bestuursorgaan <http://data.vlaanderen.be/ns/besluit#bestuurt> <$BESTUURSEENHEID_URI> .
        ?bestuursorgaanInTijd <http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan> ?bestuursorgaan .
        ?bestuursorgaanInTijd <http://data.lblod.info/vocabularies/leidinggevenden/heeftBestuursfunctie> ?bestuursfunctie .
      }
    }
    LIMIT 1" \
  | jq -r '.results.bindings[0].bestuursfunctie.value')

MANDATARIS_UUID_1=$(cat /proc/sys/kernel/random/uuid)
PERSON_UUID_1=$(cat /proc/sys/kernel/random/uuid)
IDENTIFIER_UUID_1=$(cat /proc/sys/kernel/random/uuid)

FUNCTIONARIS_UUID_2=$(cat /proc/sys/kernel/random/uuid)
PERSON_UUID_2=$(cat /proc/sys/kernel/random/uuid)
IDENTIFIER_UUID_2=$(cat /proc/sys/kernel/random/uuid)

QUERY=""

[ ! "$MANDATE_URI_1" == "null" ] && QUERY="$QUERY
# Insert mock mandataris
INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/public> {
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://data.vlaanderen.be/ns/mandaat#Mandataris> .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://www.w3.org/ns/org#holds> <$MANDATE_URI_1> .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://mu.semte.ch/vocabularies/core/uuid> \"$MANDATARIS_UUID_1\" .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://data.vlaanderen.be/ns/mandaat#start> \"2019-05-04T00:00:00Z\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://data.vlaanderen.be/ns/mandaat#status> <http://data.vlaanderen.be/id/concept/MandatarisStatusCode/c301248f-0199-45ca-b3e5-4c596731d5fe> .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan> <http://data.lblod.info/id/personen/$PERSON_UUID_1> .
    <http://data.lblod.info/id/mandatarissen/$MANDATARIS_UUID_1> <http://data.vlaanderen.be/ns/mandaat#einde> \"2021-05-30T00:00:00Z\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  }

  # persoon
  GRAPH <http://mu.semte.ch/graphs/organizations/$BESTUURSEENHEID_UUID/LoketLB-mandaatGebruiker> {
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://mu.semte.ch/vocabularies/core/uuid> \"$PERSON_UUID_1\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://www.w3.org/ns/adms#identifier> <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_1> .
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://data.vlaanderen.be/ns/persoon#gebruikteVoornaam> \"John\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/person#Person> .
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://xmlns.com/foaf/0.1/familyName> \"Doe Mandataris\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_1> <http://xmlns.com/foaf/0.1/name> \"John\" .
  }

  # identificator
  GRAPH <http://mu.semte.ch/graphs/organizations/$BESTUURSEENHEID_UUID/LoketLB-mandaatGebruiker> {
   <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/adms#Identifier> .
   <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_1> <http://www.w3.org/2004/02/skos/core#notation> \"22345678912\" .
   <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_1> <http://mu.semte.ch/vocabularies/core/uuid> \"$IDENTIFIER_UUID_1\" .
  }
}
;"

[ ! "$BESTUURSFUNCTIE_URI_2" == "null" ] && QUERY="$QUERY
# Insert mock leidinggevenden
INSERT DATA {
  # mandataris
  GRAPH <http://mu.semte.ch/graphs/public> {
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://data.lblod.info/vocabularies/leidinggevenden/Functionaris> .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://www.w3.org/ns/org#holds> <$BESTUURSFUNCTIE_URI_2> .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://mu.semte.ch/vocabularies/core/uuid> \"$FUNCTIONARIS_UUID_2\" .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://data.vlaanderen.be/ns/mandaat#start> \"2019-05-04T00:00:00Z\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://data.vlaanderen.be/ns/mandaat#status> <http://data.vlaanderen.be/id/concept/functionarisStatusCode/45b4b155-d22a-4eaf-be3a-97022c6b7fcd> .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan> <http://data.lblod.info/id/personen/$PERSON_UUID_2> .
    <http://data.lblod.info/id/functionarissen/$FUNCTIONARIS_UUID_2> <http://data.vlaanderen.be/ns/mandaat#einde> \"2021-05-30T00:00:00Z\"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
  }

  # persoon
  GRAPH <http://mu.semte.ch/graphs/organizations/$BESTUURSEENHEID_UUID/LoketLB-mandaatGebruiker> {
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://data.vlaanderen.be/ns/persoon#geslacht> <http://publications.europa.eu/resource/authority/human-sex/FEMALE> .
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://data.vlaanderen.be/ns/persoon#gebruikteVoornaam> \"Jack\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://www.w3.org/ns/adms#identifier> <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_2> .
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://xmlns.com/foaf/0.1/name> \"Jack\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/person#Person>.
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://mu.semte.ch/vocabularies/core/uuid> \"$PERSON_UUID_2\" .
    <http://data.lblod.info/id/personen/$PERSON_UUID_2> <http://xmlns.com/foaf/0.1/familyName> \"Doe Leidinggevenden\" .

 }

  # identificator
  GRAPH <http://mu.semte.ch/graphs/organizations/$BESTUURSEENHEID_UUID/LoketLB-mandaatGebruiker> {
    <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/adms#Identifier> .
    <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_2> <http://mu.semte.ch/vocabularies/core/uuid> \"$IDENTIFIER_UUID_2\" .
    <http://data.lblod.info/id/identificatoren/$IDENTIFIER_UUID_2> <http://www.w3.org/2004/02/skos/core#notation> \"42345678912\" .
  }
}"

TIMESTAMP=`date "+%Y%m%d%H%M%S"`
FILENAME=$TIMESTAMP"-create-mandatarissen-sensitive.sparql"

echo "Creating migration with name $FILENAME"
mkdir -p /data/app/config/migrations/
cd /data/app/config/migrations/
echo "$QUERY" >> $FILENAME
