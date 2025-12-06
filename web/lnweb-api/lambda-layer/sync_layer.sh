#!/bin/bash
# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

 
sam build
sam deploy --stack-name LNWebAPILambdaLayer --template-file ./template.yaml
