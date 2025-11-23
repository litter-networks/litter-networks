#!/bin/bash
 
sam build
sam deploy --stack-name LNWebAPILambdaLayer --template-file ./template.yaml

