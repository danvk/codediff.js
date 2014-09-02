#!/bin/bash
set -o errexit  # early-out if anything fails

# Activate Python virtualenv
source env/bin/activate

# Python tests
grunt test

# dpxdt screenshot tests
dpxdt --imgur_client_id bec0e685e35490b test pdifftests
