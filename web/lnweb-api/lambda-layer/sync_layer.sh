#!/bin/bash
# Copyright Clean and Green Communities CIC / Litter Networks
# SPDX-License-Identifier: Apache-2.0

 
sam build
sam deploy --stack-name LNWebAPILambdaLayer --template-file ./template.yaml
