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

# Updating Lambda functions
for f in $(ls -1); do
  if [[ $f != DF* ]]; then
    continue
  fi
  echo "Updating function $f begin..."
    cp config.json $f/
  cd $f
  zip -r $f.zip index.js config.json
  aws lambda update-function-code --function-name ${f} --zip-file fileb://${f}.zip --region $REGION
    rm config.json
    rm $f.zip
  cd ..
  echo "Updating function $f end"
done

rm ./config.json
