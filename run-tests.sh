#!/bin/bash
set -o errexit  # early-out if anything fails

# Activate Python virtualenv
source env/bin/activate

# Python tests
grunt test
