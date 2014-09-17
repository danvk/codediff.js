#!/bin/bash
# Configure Python for testing on Travis.
# You shouldn't ever need to run this on your dev box.
set -o errexit
set -x
#sudo pip install virtualenv
#virtualenv env
#source env/bin/activate

pwd

echo 'STARTING NPM INSTALL STEP'
sudo npm install -g $(pwd)
echo 'DONE WITH NPM STEP'

sudo pip install -r requirements.txt
