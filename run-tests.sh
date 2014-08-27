#!/bin/bash
set -o errexit  # early-out if anything fails

# Python tests
grunt test

# dpxdt screenshot tests
dpxdt test pdifftests
