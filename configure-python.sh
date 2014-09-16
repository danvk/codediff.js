#!/bin/bash
# Configure Python for testing on Travis.
# You shouldn't ever need to run this on your dev box.
set -o errexit
#sudo pip install virtualenv
#virtualenv env
#source env/bin/activate
sudo npm install -g
sudo pip install -r requirements.txt
