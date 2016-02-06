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
AWS_ACCOUNT_ID=$(jq -r '.AWS_ACCOUNT_ID' config.json)
REGION=$(jq -r '.REGION' config.json)
BUCKET=$(jq -r '.BUCKET' config.json)
MAX_AGE=$(jq -r '.MAX_AGE' config.json)
DDB_TABLE=$(jq -r '.DDB_TABLE' config.json)
DDB_PROFILE_TABLE=$(jq -r '.DDB_PROFILE_TABLE' config.json)
IDENTITY_POOL_NAME=$(jq -r '.IDENTITY_POOL_NAME' config.json)
DEVELOPER_PROVIDER_NAME=$(jq -r '.DEVELOPER_PROVIDER_NAME' config.json)
SNS_TOPIC_U2H_MESSAGE=$(jq -r '.SNS_TOPIC_U2H_MESSAGE' config.json)
SNS_TOPIC_U2D_MESSAGE=$(jq -r '.SNS_TOPIC_U2D_MESSAGE' config.json)
STATEMENT_ID=$(jq -r '.STATEMENT_ID' config.json)

cd iam
if [ -d "edit" ]; then
  rm edit/*
else
  mkdir edit
fi

# Create Lambda Trust Policy for IAM Roles
for f in $(ls -1 trust*); do
  echo "Editing trust from $f begin..."
  sed -e "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" \
      -e "s/<DYNAMODB_TABLE>/$DDB_TABLE/g" \
      -e "s/<DYNAMODB_PROFILE_TABLE>/$DDB_PROFILE_TABLE/g" \
      -e "s/<DYNAMODB_EMAIL_INDEX>/$DDB_EMAIL_INDEX/g" \
      -e "s/<IDENTITY_POOL_ID>/$IDENTITY_POOL_ID/g" \
      -e "s/<REGION>/$REGION/g" \
      $f > edit/$f
  echo "Editing trust from $f end"
done

# Create IAM Roles for Lambda Function
for f in $(ls -1 DF*); do
  role="${f%.*}"
  echo "Creating role $role from $f begin..."
  sed -e "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" \
      -e "s/<DYNAMODB_TABLE>/$DDB_TABLE/g" \
      -e "s/<DYNAMODB_PROFILE_TABLE>/$DDB_PROFILE_TABLE/g" \
      -e "s/<DYNAMODB_EMAIL_INDEX>/$DDB_EMAIL_INDEX/g" \
      -e "s/<IDENTITY_POOL_ID>/$IDENTITY_POOL_ID/g" \
      -e "s/<REGION>/$REGION/g" \
      $f > edit/$f
    trust="trust_policy_lambda.json"
  aws iam create-role --role-name $role --assume-role-policy-document file://edit/$trust
  aws iam update-assume-role-policy --role-name $role --policy-document file://edit/$trust
  aws iam put-role-policy --role-name $role --policy-name $role --policy-document file://edit/$f
  echo "Creating role $role end"
done

cd ..

# Create Lambda Functions
for f in $(ls -1|grep ^DF); do
  echo "Creating function $f begin..."
  cp config.json $f/
  cd $f
  zip -r $f.zip index.js config.json
  aws lambda create-function --function-name ${f} \
      --runtime nodejs \
      --role arn:aws:iam::$AWS_ACCOUNT_ID:role/${f} \
      --handler index.handler \
      --zip-file fileb://${f}.zip \
          --region $REGION
    sleep 1 # To avoid errors
  cd ..
  echo "Creating function $f end"
done

# Create SQS queues for U2H and U2D conversations
# echo "Creating U2H SQS queue begin..."
# aws sqs create-queue --queue-name $SQS_MESSAGE_U2H \
#     --attributes MessageRetentionPeriod=1209600
# sleep 1 # To avoid errors
# echo "Creating U2H SQS queue end"

# echo "Creating U2D SQS queue begin..."
# aws sqs create-queue --queue-name $SQS_MESSAGE_U2D \
#     --attributes MessageRetentionPeriod=345600
# sleep 1 # To avoid errors
# echo "Creating U2D SQS queue end"

# Grant SNS topic "u2d-msg" permission to invoke DFDorkRecvMessage
for f in $(ls -1|grep ^DFDork); do
  echo "Grant permission to SNS topic begin..."
#   aws lambda add-permission --function-name arn:aws:lambda:$REGION:$AWS_ACCOUNT_ID:function:${f} \
  aws lambda add-permission --function-name ${f} \
      --statement-id $STATEMENT_ID \
      --action lambda:InvokeFunction \
      --principal sns.amazonaws.com \
      --source-arn arn:aws:sns:$REGION:$AWS_ACCOUNT_ID:$SNS_TOPIC_U2D_MESSAGE
    sleep 1 # To avoid errors
  echo "Grant permission to SNS topic $f end"
done

rm ./config.json

./deploy.sh
