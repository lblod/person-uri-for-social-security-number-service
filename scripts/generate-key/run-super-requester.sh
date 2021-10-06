#!/bin/bash
if [ "$#" -ne 4 ]; then
  echo "The number of parameters is not correct. You need to provide the following: ./run.sh vendorUri bestuurseenheidUri key passwordSalt"
  exit 1
fi

VENDOR_URI=$1
SUBJECT=$2
KEY=$3
PASSWORD_SALT=$4
AGENT_UUID=$(cat /proc/sys/kernel/random/uuid)
ACCOUNT_UUID=$(cat /proc/sys/kernel/random/uuid)
ACLS_UUID=$(cat /proc/sys/kernel/random/uuid)
INFORMATION_RESOURCE_UUID=$(cat /proc/sys/kernel/random/uuid)

QUERY="PREFIX org: <http://www.w3.org/ns/org#>
PREFIX acl: <http://www.w3.org/ns/auth/acl#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX muAccount: <http://mu.semte.ch/vocabularies/account/>
PREFIX dcterms: <http://purl.org/dc/terms/>

INSERT {
  GRAPH <http://mu.semte.ch/graphs/ssn-access-control> {
    <$VENDOR_URI> acl:member <http://data.lblod.info/agents/$AGENT_UUID>.

    <http://data.lblod.info/agents/$AGENT_UUID> a muAccount:SSNAgent.
    <http://data.lblod.info/agents/$AGENT_UUID> foaf:account <http://data.lblod.info/accounts/$ACCOUNT_UUID>.

   <http://data.lblod.info/accounts/$ACCOUNT_UUID> a foaf:OnlineAccount.
   # the non-hashed-key is: \"$KEY\"
   # salt:\"$PASSWORD_SALT\"
   # muAccount:key SHA512(\"$KEY$PASSWORD_SALT\")
   <http://data.lblod.info/accounts/$ACCOUNT_UUID> muAccount:key ?shaKey.
   <http://data.lblod.info/accounts/$ACCOUNT_UUID> muAccount:salt \"$PASSWORD_SALT\".

   <http://data.lblod.info/acls/$ACLS_UUID> acl:agent <http://data.lblod.info/agents/$AGENT_UUID>.
   <http://data.lblod.info/acls/$ACLS_UUID> a acl:Authorization.
   <http://data.lblod.info/acls/$ACLS_UUID> acl:mode <http://data.lblod.info/codelists/access-modes/read>.
   <http://data.lblod.info/acls/$ACLS_UUID> acl:accessTo <http://data.lblod.info/information-resources/$INFORMATION_RESOURCE_UUID>.

   <http://data.lblod.info/information-resources/$INFORMATION_RESOURCE_UUID> a muAccount:SuperSSNAccess.
   <http://data.lblod.info/information-resources/$INFORMATION_RESOURCE_UUID> dcterms:subject <$SUBJECT>.
  }
} WHERE {
  { SELECT SHA512(\"$KEY$PASSWORD_SALT\") as ?shaKey WHERE {} }.
}"

TIMESTAMP=`date "+%Y%m%d%H%M%S"`
FILENAME=$TIMESTAMP"-generate-key-sensitive.sparql"

echo "Creating migration with name $FILENAME"
mkdir -p /data/app/config/migrations/
cd /data/app/config/migrations/
echo "$QUERY" >> $FILENAME
