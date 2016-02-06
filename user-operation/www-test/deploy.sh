#!/bin/bash

# Check if the AWS CLI is in the PATH
found=$(which aws)
if [ -z "$found" ]; then
  echo "Please install the AWS CLI under your PATH: http://aws.amazon.com/cli/"
  exit 1
fi

# Check if jq is in the PATH
found=$(which jq)
if [ -z "$found" ]; then
  echo "Please install jq under your PATH: http://stedolan.github.io/jq/"
  exit 1
fi

cp ../config.json .

# Read other configuration from config.json
REGION=$(jq -r '.REGION' config.json)
BUCKET=$(jq -r '.BUCKET' config.json)
MAX_AGE=$(jq -r '.MAX_AGE' config.json)
IDENTITY_POOL_ID=$(jq -r '.IDENTITY_POOL_ID' config.json)
DEVELOPER_PROVIDER_NAME=$(jq -r '.DEVELOPER_PROVIDER_NAME' config.json)
TEST_EMAIL=$(jq -r '.TEST_EMAIL' config.json)
TEST_PASSWORD=$(jq -r '.TEST_PASSWORD' config.json)

echo "Updating www content begin..."

cd www
if [ -d "edit" ]; then
  rm edit/*
else
  mkdir edit
fi

for f in $(ls -1 *.*); do
  echo "Updating $f begin..."
  sed -e "s/<REGION>/$REGION/g" \
      -e "s/<IDENTITY_POOL_ID>/$IDENTITY_POOL_ID/g" \
      -e "s/<DEVELOPER_PROVIDER_NAME>/$DEVELOPER_PROVIDER_NAME/g" \
      -e "s/<TEST_EMAIL>/$TEST_EMAIL/g" \
      -e "s/<TEST_PASSWORD>/$TEST_PASSWORD/g" \
      $f > edit/$f
  echo "Updating $f end"
done
echo "Updating www content end"
echo "Sync www content with S3 bucket $BUCKET begin..."
cd edit
aws s3 sync . s3://$BUCKET --cache-control max-age="$MAX_AGE" --acl public-read
cd ../..
echo "Sync www content with S3 bucket $BUCKET end"

rm ./config.json
