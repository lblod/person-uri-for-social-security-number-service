#!/bin/bash
if [ "$#" -ne 4 ]; then
  echo "The number of parameters is not correct. You need to provide the following: ./rush.sh vendorUri bestuurseenheiduri key passwordSalt"
  exit 1
fi

vendorUri=$1
bestuurseenheiduri=$2
key=$3
passwordSalt=$4
agentUuid=$(cat /proc/sys/kernel/random/uuid)
accountUuid=$(cat /proc/sys/kernel/random/uuid)
aclsUuid=$(cat /proc/sys/kernel/random/uuid)
informationResourceUuid=$(cat /proc/sys/kernel/random/uuid)

query="PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
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
PREFIX dcterms: <http://purl.org/dc/terms/>

INSERT {
  GRAPH <http://mu.semte.ch/graphs/ssn-access-control> {
    <$vendorUri> acl:member <http://data.lblod.info/agents/$agentUuid>.

    <http://data.lblod.info/agents/$agentUuid> a muAccount:SSNAgent.
    <http://data.lblod.info/agents/$agentUuid> foaf:account <http://data.lblod.info/accounts/$accountUuid>.

   <http://data.lblod.info/accounts/$accountUuid> a foaf:OnlineAccount.
   # the non-hashed-key is: \"$key\"
   # salt:\"$passwordSalt\"
   # muAccount:key SHA512(\"$key$passwordSalt\")
   <http://data.lblod.info/accounts/$accountUuid> muAccount:key ?shaKey.

   <http://data.lblod.info/acls/$aclsUuid> acl:agent <http://data.lblod.info/agents/$agentUuid>.
   <http://data.lblod.info/acls/$aclsUuid> a acl:Authorization.
   <http://data.lblod.info/acls/$aclsUuid> acl:mode <http://data.lblod.info/codelists/access-modes/read>.
   <http://data.lblod.info/acls/$aclsUuid> acl:accessTo <http://data.lblod.info/information-resources/$informationResourceUuid>.

   <http://data.lblod.info/information-resources/$informationResourceUuid> a muAccount:SSNAccess.
   <http://data.lblod.info/information-resources/$informationResourceUuid> dcterms:subject <$bestuurseenheiduri>.
  }
} WHERE {
  { SELECT SHA512(\"$key$passwordSalt\") as ?shaKey WHERE {} }.
}"

timestamp=`date "+%Y%m%d%H%M%S"`
filename=$timestamp"-generate-key.sparql"

echo "Creating migration with name $filename"
mkdir -p /data/app/config/migrations/
cd /data/app/config/migrations/
#touch $filename
#echo "config/migrations/$filename" 
echo "$query" >> $filename