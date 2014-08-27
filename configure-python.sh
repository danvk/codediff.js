#!/bin/bash
# Configure Python for testing on Travis.
# You shouldn't ever need to run this on your dev box.
set -o errexit
pip install virtualenv
virtualenv env
source env/bin/activate
pip install -r requirements.txt
